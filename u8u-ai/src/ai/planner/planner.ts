
import type { ConversationMemory, HistoryTurn } from "../memory/types";
import type { PlannerDecision } from "./planner.types";
import { getPromptService } from "../llm/prompt.service";
import { getLlmService } from "../llm/llm.service";
import { safeJsonParse } from "../llm/json-parser";
import type { LlmMessage } from "../llm/provider.interface";
import { computeMissingSlots, AppointmentSlots } from "../memory/types";

const PLANNER_MODEL = process.env.PLANNER_MODEL || "llama-3.1-8b-instant";

export async function plan(
  memory: ConversationMemory,
  transcript: string,
  hospitalName: string,
  retrievedContext?: string
): Promise<PlannerDecision> {
  console.log("[Planner] Starting planner decision");
  console.log("[Planner] Input transcript:", transcript);
  console.log("[Planner] Current memory intent:", memory.activeIntent);
  if (retrievedContext) {
    console.log("[Planner] Retrieved context length:", retrievedContext.length);
  }
  
  const startTime = Date.now();
  const promptService = getPromptService();
  const llmService = getLlmService();

  const systemPrompt = promptService.getPrompt("planner", {
    memory,
    hospitalName,
    retrievedContext,
  });

  const messages: LlmMessage[] = [
    { role: "system", content: systemPrompt },
    ...memory.conversationHistory.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user", content: transcript },
  ];

  const response = await llmService.plan(messages, [], {
    model: PLANNER_MODEL,
    maxTokens: 200,
    temperature: 0.4,
    responseFormat: { type: "json_object" },
    toolChoice: "none",
  });

  let plannerOutput: any = {};
  if (response.content) {
    try {
      plannerOutput = safeJsonParse(response.content);
    } catch (e) {
      console.error("[Planner] Failed parse JSON planner response:", response.content, e);
    }
  }

  const toolCall = plannerOutput.toolCall || undefined;
  const intent = plannerOutput.intent || inferIntentFromToolCall(toolCall);
  const secondaryIntent: PlannerDecision["secondaryIntent"] = plannerOutput.secondaryIntent;
  const actions: string[] | undefined = Array.isArray(plannerOutput.actions)
    ? plannerOutput.actions.map(String)
    : undefined;
  const extractedSlots: Record<string, string> | undefined = plannerOutput.extractedSlots;
  const missingSlots: string[] | undefined = Array.isArray(plannerOutput.missingSlots)
    ? plannerOutput.missingSlots.map(String)
    : undefined;
  const requiresRetrieval: boolean = Boolean(plannerOutput.requiresRetrieval);
  const confirmationRequired: boolean = Boolean(plannerOutput.confirmationRequired);
  const confidence = typeof plannerOutput.confidence === "number" ? plannerOutput.confidence : undefined;
  const entities = typeof plannerOutput.entities === "object" && plannerOutput.entities !== null
    ? (plannerOutput.entities as Record<string, string | string[]>)
    : undefined;
  const say: string | undefined = plannerOutput.say?.trim() || undefined;

  const normalizedToolCall = toolCall
    ? {
        name: String(toolCall.name),
        arguments: typeof toolCall.arguments === "object" && toolCall.arguments !== null
          ? toolCall.arguments
          : safeJsonParse(String(toolCall.arguments || "{}")) || {},
      }
    : undefined;

  const stage = typeof plannerOutput.stage === "string" ? plannerOutput.stage : undefined;
  const conversationComplete = Boolean(plannerOutput.conversationComplete);

  const finalExtractedSlots = extractedSlots || (normalizedToolCall ? extractSlotsFromArguments(normalizedToolCall.arguments) : undefined);
  const mergedSlots = mergeSlotSets(memory.filledSlots, finalExtractedSlots);
  const finalMissingSlots = (missingSlots ?? computeMissingSlots(mergedSlots)).map(String);

  console.log(
    "[Planner] Decision:",
    "intent=", intent,
    "stage=", stage,
    "secondaryIntent=", secondaryIntent,
    "tool=", normalizedToolCall?.name || "none",
    "requiresRetrieval=", requiresRetrieval,
    "confirmationRequired=", confirmationRequired,
    "conversationComplete=", conversationComplete,
    "missingSlots=", finalMissingSlots,
  );
  console.log("[Planner] ExtractedSlots=", finalExtractedSlots);
  console.log("[Planner] Actions=", actions);
  console.log("[Planner] Entities=", entities);
  console.log("[Planner] Raw planner output=", plannerOutput);
  console.log("[Planner] Latency:", Date.now() - startTime, "ms");

  return {
    intent,
    secondaryIntent,
    actions,
    stage,
    conversationComplete,
    confidence,
    entities,
    extractedSlots: finalExtractedSlots,
    missingSlots: finalMissingSlots,
    requiresRetrieval,
    confirmationRequired,
    toolCall: normalizedToolCall,
    say,
    plannerReason: response.content ? `parsed ${typeof response.content}` : undefined,
  };
}

function inferIntentFromToolCall(toolCall: { name: string; arguments: Record<string, unknown> } | undefined) {
  if (!toolCall?.name) return undefined;
  switch (toolCall.name) {
    case "book_appointment":
      return "appointment_booking";
    case "reschedule_appointment":
      return "appointment_reschedule";
    case "cancel_appointment":
      return "appointment_cancel";
    case "lookup_doctor":
      return "doctor_info";
    case "hospital_faq_lookup":
      return "general_inquiry";
    case "transfer_to_reception":
      return "transfer_to_reception";
    case "transfer_to_emergency":
      return "emergency";
    default:
      return undefined;
  }
}

function extractSlotsFromArguments(args: Record<string, unknown>): Record<string, string> | undefined {
  const extracted: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string" && value.trim() !== "") {
      extracted[key] = value.trim();
    }
  }
  return Object.keys(extracted).length > 0 ? extracted : undefined;
}

function mergeSlotSets(base: AppointmentSlots, updates?: Record<string, string>): AppointmentSlots {
  if (!updates) return { ...base };
  return { ...base, ...updates };
}

export async function composeToolReply(
  memory: ConversationMemory,
  hospitalName: string,
  toolName: string,
  toolResult: unknown
): Promise<string> {
  const llm = getLlmService();
  const prompt = getPromptService();
  return await llm.composeToolReply(
    prompt.getPrompt("planner", { memory, hospitalName }),
    toolName,
    toolResult,
    memory.language
  );
}

export async function summarize(history: HistoryTurn[]): Promise<string> {
  const llm = getLlmService();
  return await llm.summarize(history);
}
