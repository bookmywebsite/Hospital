import type { SessionState } from "../../lib/voice/websocket-handler";
import type { AgentTurnCallbacks } from "./agent-turn";
import type { PlannerDecision } from "../planner/planner.types";
import { prisma } from "../../lib/prisma";
import { getOrCreateMemory, recordTurn, mergeSlots, setIntent, setPendingConfirmation, clearPendingConfirmation, setLastAssistantQuestion, setStage, setRetrievedChunks, setLastTool, setLastToolResult, setConversationComplete, maybeRefreshSummary } from "../memory/memory.service";
import { plan, composeToolReply, summarize } from "../planner/planner";
import { retrieve, formatRetrievedContext, RETRIEVAL_INTENTS } from "../rag/retriever";
import { executeToolCall, type ToolCall } from "../tools/router";
import type { ConversationMemory, ToolCallRecord } from "../memory/types";
import { isEmergency } from "../../lib/voice/language-detection";

const HOSPITAL_NAME = process.env.HOSPITAL_NAME || "the hospital";

export async function handleConversationTurn(
  session: SessionState,
  transcript: string,
  callbacks: AgentTurnCallbacks,
): Promise<{ handled: boolean; response?: string }> {
  const memory = getOrCreateMemory(session);

  if (isEmergency(transcript)) {
    await executeToolCall({ name: "transfer_to_emergency", arguments: { reason: transcript } }, { session, memory, plannerDecision: undefined, ...callbacks });
    return { handled: true };
  }

  recordTurn(memory, { role: "user", content: transcript, ts: Date.now() });

  let decision = await plan(memory, transcript, HOSPITAL_NAME, undefined);

  if (decision.intent) {
    setIntent(memory, decision.intent);
  }
  if (decision.extractedSlots) {
    mergeSlots(memory, decision.extractedSlots);
  }

  if (decision.confirmationRequired) {
    const confirmationKind = getConfirmationKind(decision.intent);
    if (confirmationKind) {
      setPendingConfirmation(memory, {
        kind: confirmationKind,
        payload: { ...memory.filledSlots },
        promptedAt: Date.now(),
      });
    }
  } else {
    clearPendingConfirmation(memory);
  }

  if (decision.requiresRetrieval || (decision.intent && RETRIEVAL_INTENTS.has(decision.intent))) {
    const agentId = session.organizationId || process.env.DEFAULT_ORGANIZATION_ID!;
    const chunks = await retrieve(transcript, agentId);
    const retrievedChunks = chunks.map((chunk) => chunk.content);
    setRetrievedChunks(memory, retrievedChunks);
    const retrievedContext = formatRetrievedContext(chunks);
    decision = await plan(memory, transcript, HOSPITAL_NAME, retrievedContext);
  }

  if (decision.stage) {
    setStage(memory, decision.stage);
  }
  if (typeof decision.conversationComplete === "boolean") {
    setConversationComplete(memory, decision.conversationComplete);
  }

  let finalResponse = decision.say;

  if (decision.toolCall) {
    const toolResult = await executeToolCall(
      decision.toolCall,
      { session, memory, plannerDecision: decision, ...callbacks }
    );
    const toolRecord: ToolCallRecord = {
      name: decision.toolCall.name,
      arguments: decision.toolCall.arguments,
      result: toolResult,
      at: Date.now(),
    };
    setLastTool(memory, toolRecord);
    setLastToolResult(memory, toolResult);

    if (decision.toolCall.name === "transfer_to_reception" || decision.toolCall.name === "transfer_to_emergency") {
      return { handled: true };
    }

    finalResponse = await composeToolReply(memory, HOSPITAL_NAME, decision.toolCall.name, toolResult);
  }

  if (!finalResponse) {
    finalResponse = "Sorry, could you say that again?";
  }

  setLastAssistantQuestion(memory, finalResponse);
  recordTurn(memory, { role: "assistant", content: finalResponse, ts: Date.now() });
  await maybeRefreshSummary(memory, summarize);
  await persistMemorySnapshot(session, memory);

  await callbacks.speak(finalResponse);
  return { handled: true, response: finalResponse };
}

async function persistMemorySnapshot(
  session: SessionState,
  memory: ConversationMemory,
) {
  if (!session.conversationId) return;

  const conversationState = {
    activeIntent: memory.activeIntent ?? null,
    stage: memory.stage ?? null,
    conversationComplete: memory.conversationComplete ?? false,
    filledSlots: memory.filledSlots ?? {},
    slotConfidence: memory.slotConfidence ?? {},
    entities: memory.entities ?? {},
    conversationSummary: memory.conversationSummary ?? null,
    language: memory.language ?? null,
    lastTool: memory.lastTool
      ? {
          name: memory.lastTool.name,
          at: memory.lastTool.at,
        }
      : null,
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

  try {
    await prisma.conversation.update({
      where: { id: session.conversationId },
      data: {
        state: conversationState,
        detectedIntent: memory.activeIntent,
        detectedLanguage: memory.language,
      },
    });
  } catch (err) {
    console.error("[ConversationManager] Failed to persist memory snapshot:", err);
  }
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
