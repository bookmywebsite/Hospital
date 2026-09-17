import type { SessionState } from "../../lib/voice/websocket-handler";
import type { Prisma } from "@prisma/client";
import type { PlannerDecision } from "../planner/planner.types";
import { prisma } from "../../lib/prisma";
import {
  getOrCreateMemory,
  recordTurn,
  mergeSlots,
  setIntent,
  setPendingConfirmation,
  clearPendingConfirmation,
  setLastAssistantQuestion,
  setStage,
  setRetrievedChunks,
  setLastTool,
  setLastToolResult,
  setConversationComplete,
  maybeRefreshSummary,
} from "../memory/memory.service";
import { getEntityExtractor, type ExtractedEntities } from "../conversation/entity-extractor";
import { plan, composeToolReply, summarize } from "../planner/planner";
import { retrieve, formatRetrievedContext, RETRIEVAL_INTENTS } from "../rag/retriever";
import { executeToolCall, type ToolCall } from "../tools/router";
import type { ToolContext } from "../tools/types";
import type { ConversationMemory, ToolCallRecord } from "../memory/types";
import type { AgentCallbacks } from "../agent/agent.types";

const HOSPITAL_NAME = process.env.HOSPITAL_NAME || "the hospital";

export async function handleConversationTurn(
  session: SessionState,
  transcript: string,
  callbacks: AgentCallbacks,
): Promise<{ handled: boolean; response?: string }> {
  const memory = getOrCreateMemory(session);

  recordTurn(memory, {
    role: "user",
    content: transcript,
    ts: Date.now(),
  });

  // ============================================================
  // DETERMINISTIC CONFIRMATION HANDLING
  // ============================================================
  // IMPORTANT:
  // Handle explicit confirmation BEFORE calling the LLM planner.
  // This prevents Groq JSON/tool planning from failing on simple
  // confirmation messages such as "yes", "correct", "haan", etc.
  // ============================================================

  if (memory.pendingConfirmation && isExplicitAffirmation(transcript)) {
    console.log(
      "[ConversationManager] Explicit confirmation detected",
      {
        kind: memory.pendingConfirmation.kind,
        transcript,
      },
    );

    const pendingToolCall =
      buildToolCallFromPendingConfirmation(memory);

    if (pendingToolCall) {
      console.log(
        "[ConversationManager] Executing pending tool:",
        pendingToolCall.name,
      );

      clearPendingConfirmation(memory);

      let toolResult: unknown;

      try {
        toolResult = await executeToolCallWithRetry(
          pendingToolCall,
          {
            session,
            memory,
            plannerDecision: {
              intent: memory.activeIntent,
              say: undefined,
              toolCall: pendingToolCall,
              confirmationRequired: false,
              requiresRetrieval: false,
              stage: "executing",
              conversationComplete: false,
              extractedSlots: {},
              missingSlots: [],
              actions: [],
              entities: {},
            } as PlannerDecision,
            ...callbacks,
          },
          2,
        );

        if (toolResult === undefined) {
          throw new Error("Tool returned undefined.");
        }
      } catch (err) {
        toolResult = {
          success: false,
          error: "tool_execution_failed",
          message: err instanceof Error ? err.message : String(err),
        };

        console.error(
          "[ConversationManager] Pending confirmation tool execution failed:",
          pendingToolCall.name,
          err,
        );
      }

      const toolRecord: ToolCallRecord = {
        name: pendingToolCall.name,
        arguments: pendingToolCall.arguments,
        result: toolResult,
        at: Date.now(),
      };

      setLastTool(memory, toolRecord);
      setLastToolResult(memory, toolResult);

      // Transfers should not continue into normal speech handling.
      if (
        pendingToolCall.name === "transfer_to_reception" ||
        pendingToolCall.name === "transfer_to_emergency"
      ) {
        return { handled: true };
      }

      let finalResponse: string;

      if (
        typeof toolResult === "object" &&
        toolResult !== null &&
        "success" in toolResult &&
        !(toolResult as any).success
      ) {
        finalResponse =
          "I'm sorry, I'm having trouble completing that request right now. Could you please try again or ask something else?";
      } else {
        finalResponse = await composeToolReply(
          memory,
          HOSPITAL_NAME,
          pendingToolCall.name,
          toolResult,
        );
      }

      setLastAssistantQuestion(memory, finalResponse);

      recordTurn(memory, {
        role: "assistant",
        content: finalResponse,
        ts: Date.now(),
      });

      await maybeRefreshSummary(memory, summarize);
      await persistMemorySnapshot(session, memory);

      await callbacks.speak(finalResponse);

      return {
        handled: true,
        response: finalResponse,
      };
    }

    console.warn(
      "[ConversationManager] Confirmation received but no pending tool could be built.",
    );

    clearPendingConfirmation(memory);
  }

  // ============================================================
  // NORMAL CONVERSATION FLOW
  // ============================================================

  const entityExtractor = getEntityExtractor();

  const extractedEntities =
    await entityExtractor.extract(
      transcript,
      memory.language,
    );

  mergeSlots(
    memory,
    normalizeEntitiesToSlots(extractedEntities),
  );

  let decision = await plan(
    memory,
    transcript,
    HOSPITAL_NAME,
    undefined,
  );

  if (decision.intent) {
    setIntent(memory, decision.intent);
  }

  if (decision.extractedSlots) {
    mergeSlots(memory, decision.extractedSlots);
  }

  // ============================================================
  // CONFIRMATION STATE
  // ============================================================

  if (decision.confirmationRequired) {
    const confirmationKind =
      getConfirmationKind(decision.intent);

    if (confirmationKind) {
      setPendingConfirmation(memory, {
        kind: confirmationKind,
        payload: {
          ...memory.filledSlots,
        },
        promptedAt: Date.now(),
      });

      console.log(
        "[ConversationManager] Pending confirmation set:",
        confirmationKind,
      );
    }
  } else {
    clearPendingConfirmation(memory);
  }

  // ============================================================
  // RAG / KNOWLEDGE RETRIEVAL
  // ============================================================

  if (
    decision.requiresRetrieval ||
    (decision.intent &&
      RETRIEVAL_INTENTS.has(decision.intent))
  ) {
    const agentId =
      session.organizationId ||
      process.env.DEFAULT_ORGANIZATION_ID!;

    try {
      const chunks = await retrieve(
        transcript,
        agentId,
      );

      const retrievedChunks = chunks.map(
        (chunk) => chunk.content,
      );

      setRetrievedChunks(
        memory,
        retrievedChunks,
      );

      memory.lastKnowledgeLookup = Date.now();

      const retrievedContext =
        formatRetrievedContext(chunks);

      const retrievalDecision = await plan(
        memory,
        transcript,
        HOSPITAL_NAME,
        retrievedContext,
      );

      decision = mergePlannerDecisions(
        decision,
        retrievalDecision,
      );

      if (
        decision.intent &&
        decision.intent !== memory.activeIntent
      ) {
        setIntent(
          memory,
          decision.intent,
        );
      }

      if (decision.requiresRetrieval) {
        decision.toolCall = undefined;
      }
    } catch (err) {
      console.error(
        "[ConversationManager] Retrieval failed:",
        err,
      );

      decision.requiresRetrieval = false;

      if (!decision.say) {
        decision.say =
          "I'm sorry, I couldn't access our knowledge base at the moment.";
      }
    }
  }

  // ============================================================
  // UPDATE MEMORY STATE
  // ============================================================

  if (decision.stage) {
    setStage(
      memory,
      decision.stage,
    );
  }

  if (
    typeof decision.conversationComplete ===
    "boolean"
  ) {
    setConversationComplete(
      memory,
      decision.conversationComplete,
    );
  }

  // ============================================================
  // TOOL EXECUTION
  // ============================================================

  let finalResponse = decision.say;

  const toolCall =
    decision.toolCall &&
    validateToolCall(
      decision.toolCall,
      memory,
    )
      ? decision.toolCall
      : undefined;

  if (decision.toolCall && !toolCall) {
    console.warn(
      "[ConversationManager] Invalid Tool",
      {
        tool: decision.toolCall,
        memorySlots: memory.filledSlots,
        missing: decision.missingSlots,
      },
    );
  }

  if (toolCall) {
    let toolResult: unknown;

    try {
      toolResult =
        await executeToolCallWithRetry(
          toolCall,
          {
            session,
            memory,
            plannerDecision: decision,
            ...callbacks,
          },
          2,
        );

      if (toolResult === undefined) {
        throw new Error(
          "Tool returned undefined.",
        );
      }
    } catch (err) {
      const errorResult = {
        success: false,
        error: "tool_execution_failed",
        message:
          err instanceof Error
            ? err.message
            : String(err),
      };

      toolResult = errorResult;

      console.error(
        "[ConversationManager] Tool execution failed after retries:",
        toolCall.name,
        err,
      );
    }

    const toolRecord: ToolCallRecord = {
      name: toolCall.name,
      arguments: toolCall.arguments,
      result: toolResult,
      at: Date.now(),
    };

    setLastTool(
      memory,
      toolRecord,
    );

    setLastToolResult(
      memory,
      toolResult,
    );

    if (
      toolCall.name ===
        "transfer_to_reception" ||
      toolCall.name ===
        "transfer_to_emergency"
    ) {
      return {
        handled: true,
      };
    }

    if (
      typeof toolResult === "object" &&
      toolResult !== null &&
      "success" in toolResult &&
      !(toolResult as any).success
    ) {
      finalResponse =
        "I'm sorry, I'm having trouble completing that request right now. Could you please try again or ask something else?";
    } else {
      finalResponse =
        await composeToolReply(
          memory,
          HOSPITAL_NAME,
          toolCall.name,
          toolResult,
        );
    }
  }

  // ============================================================
  // FINAL RESPONSE
  // ============================================================

  if (!finalResponse) {
    finalResponse =
      "Sorry, could you say that again?";
  }

  setLastAssistantQuestion(
    memory,
    finalResponse,
  );

  recordTurn(memory, {
    role: "assistant",
    content: finalResponse,
    ts: Date.now(),
  });

  await maybeRefreshSummary(
    memory,
    summarize,
  );

  await persistMemorySnapshot(
    session,
    memory,
  );

  await callbacks.speak(
    finalResponse,
  );

  return {
    handled: true,
    response: finalResponse,
  };
}

function validateToolCall(toolCall: ToolCall, memory: ConversationMemory): boolean {
  const args = toolCall.arguments || {};
  const hasString = (value: unknown): value is string =>
    typeof value === "string" && value.trim() !== "";
  const anyNonEmptyArg = Object.values(args).some(hasString);

  switch (toolCall.name) {
    case "book_appointment": {
      const patientName = hasString(args.patientName)
        ? args.patientName
        : memory.filledSlots.patientName;
      const phone = hasString(args.phone) ? args.phone : memory.filledSlots.phone;
      const department = hasString(args.department)
        ? args.department
        : memory.filledSlots.department;
      const scheduledAt = hasString(args.scheduledAt)
        ? args.scheduledAt
        : memory.filledSlots.scheduledAt;
      return Boolean(patientName && phone && department && scheduledAt);
    }
    case "reschedule_appointment": {
      const scheduledAt = hasString(args.scheduledAt);
      const appointmentId =
        hasString(args.appointmentId) || Boolean(memory.lastAppointment?.appointmentId);
      return Boolean(scheduledAt && appointmentId);
    }
    case "cancel_appointment": {
      const appointmentId =
        hasString(args.appointmentId) || Boolean(memory.lastAppointment?.appointmentId);
      return Boolean(appointmentId);
    }
    case "lookup_doctor": {
      return anyNonEmptyArg;
    }
    case "hospital_faq_lookup": {
      return anyNonEmptyArg;
    }
    case "transfer_to_reception":
    case "transfer_to_emergency": {
      return true;
    }
    default:
      return false;
  }
}

function isExplicitAffirmation(transcript: string): boolean {
  const normalized = transcript.toLowerCase().trim();
  return /\b(yes|yeah|yep|correct|right|confirmed|confirm|haan|haudu|bilkul|theek hai|sahi hai)\b/.test(
    normalized,
  );
}

function buildToolCallFromPendingConfirmation(memory: ConversationMemory): ToolCall | undefined {
  if (!memory.pendingConfirmation) return undefined;
  switch (memory.pendingConfirmation.kind) {
    case "book_appointment":
      return {
        name: "book_appointment",
        arguments: {
          patientName: memory.filledSlots.patientName,
          phone: memory.filledSlots.phone,
          department: memory.filledSlots.department,
          scheduledAt: memory.filledSlots.scheduledAt,
          reason: memory.filledSlots.reason,
          email: memory.filledSlots.email,
        },
      };
    case "reschedule_appointment":
      return {
        name: "reschedule_appointment",
        arguments: {
          appointmentId: memory.lastAppointment?.appointmentId,
          scheduledAt: memory.filledSlots.scheduledAt,
        },
      };
    case "cancel_appointment":
      return {
        name: "cancel_appointment",
        arguments: {
          appointmentId: memory.lastAppointment?.appointmentId,
        },
      };
    default:
      return undefined;
  }
}

async function persistMemorySnapshot(session: SessionState, memory: ConversationMemory) {
  if (!session.conversationId) return;

  const conversationState = {
    activeIntent: memory.activeIntent ?? null,
    stage: memory.stage ?? null,
    conversationComplete: memory.conversationComplete ?? false,
    filledSlots: memory.filledSlots ?? {},
    slotConfidence: memory.slotConfidence ?? {},
    entities: memory.entities ?? {},
    conversationHistory: memory.conversationHistory ?? [],
    conversationSummary: memory.conversationSummary ?? null,
    retrievedChunks: memory.retrievedChunks ?? [],
    pendingConfirmation: memory.pendingConfirmation ?? null,
    lastTool: memory.lastTool
      ? {
          name: memory.lastTool.name,
          arguments: memory.lastTool.arguments,
          result: memory.lastTool.result,
          at: memory.lastTool.at,
        }
      : null,
    lastToolResult: memory.lastToolResult ?? null,
    language: memory.language ?? null,
    lastAppointment: memory.lastAppointment
      ? {
          patientName: memory.lastAppointment.patientName ?? null,
          department: memory.lastAppointment.department ?? null,
          phone: memory.lastAppointment.phone ?? null,
          email: memory.lastAppointment.email ?? null,
          scheduledAt: memory.lastAppointment.scheduledAt ?? null,
          appointmentId: memory.lastAppointment.appointmentId ?? null,
        }
      : null,
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await prisma.conversation.update({
        where: { id: session.conversationId },
        data: {
          state: conversationState as unknown as Prisma.InputJsonObject,
          detectedIntent: memory.activeIntent,
          detectedLanguage: memory.language,
        },
      });
      break;
    } catch (err) {
      if (attempt === 3) {
        console.error(
          "[ConversationManager] Failed to persist memory snapshot after retries:",
          err,
        );
      } else {
        await delay(500 * attempt);
      }
    }
  }
}
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
function getConfirmationKind(intent?: string) {
  switch (intent) {
    case "appointment_booking":
      return "book_appointment";
    case "appointment_reschedule":
      return "reschedule_appointment";
    case "appointment_cancel":
      return "cancel_appointment";
    default:
      return undefined;
  }
}

function normalizeEntitiesToSlots(entities: ExtractedEntities) {
  const slots: Record<string, string> = {};
  if (entities.patientName) slots.patientName = entities.patientName;
  if (entities.phone) slots.phone = entities.phone;
  if (entities.email) slots.email = entities.email;
  if (entities.department) slots.department = entities.department;
  if (entities.doctorName) slots.doctorName = entities.doctorName;
  if (entities.scheduledAt) slots.scheduledAt = entities.scheduledAt;
  if (entities.symptoms) slots.reason = entities.symptoms;
  if (entities.insurance) slots.insurance = entities.insurance;
  return slots;
}
function mergePlannerDecisions(
  previous: PlannerDecision,
  current: PlannerDecision,
): PlannerDecision {
  return {
    ...previous,

    ...current,

    extractedSlots: {
      ...(previous.extractedSlots ?? {}),
      ...(current.extractedSlots ?? {}),
    },

    actions: [...(previous.actions ?? []), ...(current.actions ?? [])],

    missingSlots: current.missingSlots?.length ? current.missingSlots : previous.missingSlots,

    toolCall: current.toolCall ?? previous.toolCall,

    entities: {
      ...(previous.entities ?? {}),
      ...(current.entities ?? {}),
    },
  };
}
async function executeToolCallWithRetry(
  toolCall: ToolCall,
  ctx: ToolContext,
  attempts: number,
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await executeToolCall(toolCall, ctx);
    } catch (err) {
      lastError = err;
      console.warn(
        `[ConversationManager] Tool call attempt ${attempt} failed for ${toolCall.name}`,
        err,
      );
      if (attempt < attempts) {
        await delay(250 * attempt);
      }
    }
  }
  throw lastError;
}
