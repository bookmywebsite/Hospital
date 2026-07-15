import type { SessionState } from "../../lib/voice/websocket-handler";
import type { SupportedLanguage } from "../../lib/voice/language-detection";
import {
  type ConversationMemory,
  type AppointmentSlots,
  type Intent,
  type HistoryTurn,  type PendingConfirmation,
  type ToolCallRecord,  createEmptyMemory,
  computeMissingSlots,
} from "./types";

/**
 * Memory lives on the session object itself (`session.memory`), same lifecycle
 * as the old `session.step` / `session.appointmentData` fields — no new store,
 * no new infra. This just adds a typed, single-object shape instead of scattered
 * fields, and gives it real merge/summary behaviour.
 */
export function getOrCreateMemory(session: SessionState): ConversationMemory {
  const anySession = session as SessionState & { memory?: ConversationMemory };

  if (!anySession.memory) {
    anySession.memory = createEmptyMemory(session.callSid, session.language);

    // One-time backfill from the legacy fields, so a call that started before
    // this migration (or a call still touching legacy code during the phased
    // rollout in the migration plan) doesn't lose what's already been said.
    if (session.appointmentData) {
      anySession.memory.filledSlots = {
        patientName: session.appointmentData.patientName,
        department: session.appointmentData.department,
        scheduledAt: session.appointmentData.scheduledAt?.toISOString(),
        reason: session.appointmentData.symptoms,
      };
    }
    if (session.callerNumber) {
      anySession.memory.filledSlots.phone = session.callerNumber;
    }
  }

  return anySession.memory;
}

export function recordTurn(memory: ConversationMemory, turn: HistoryTurn): void {
  memory.conversationHistory.push(turn);

  // Keep the raw history bounded — same 20-turn cap GroqDualBrain already uses,
  // so token usage doesn't grow unbounded on long calls.
  const MAX_TURNS = 20;
  if (memory.conversationHistory.length > MAX_TURNS) {
    memory.conversationHistory = memory.conversationHistory.slice(-MAX_TURNS);
  }
}

export function mergeSlots(memory: ConversationMemory, updates: Partial<AppointmentSlots>): void {
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null && value !== "") {
      (memory.filledSlots as Record<string, unknown>)[key] = value;
    }
  }
}

export function setIntent(memory: ConversationMemory, intent: Intent): void {
  if (memory.activeIntent !== intent) {
    memory.previousIntents.push(memory.activeIntent);
  }
  memory.activeIntent = intent;
}

export function overwriteSlots(memory: ConversationMemory, updates: Partial<AppointmentSlots>): void {
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      (memory.filledSlots as Record<string, unknown>)[key] = value;
    }
  }
}

export function clearSlot(memory: ConversationMemory, slot: keyof AppointmentSlots): void {
  delete memory.filledSlots[slot];
  delete memory.slotConfidence[slot as string];
}

export function setPendingConfirmation(memory: ConversationMemory, pendingConfirmation: PendingConfirmation): void {
  memory.pendingConfirmation = pendingConfirmation;
}

export function clearPendingConfirmation(memory: ConversationMemory): void {
  memory.pendingConfirmation = undefined;
}

export function setLastAssistantQuestion(memory: ConversationMemory, question: string): void {
  memory.lastAssistantQuestion = question;
}

export function setStage(memory: ConversationMemory, stage: string): void {
  memory.stage = stage;
}

export function setSlotConfidence(memory: ConversationMemory, confidences: Record<string, number>): void {
  memory.slotConfidence = {
    ...memory.slotConfidence,
    ...confidences,
  };
}

export function setRetrievedChunks(memory: ConversationMemory, chunks: string[]): void {
  memory.retrievedChunks = chunks;
}

export function setLastTool(memory: ConversationMemory, toolCall: ToolCallRecord): void {
  memory.lastTool = toolCall;
}

export function setLastToolResult(memory: ConversationMemory, result: unknown): void {
  memory.lastToolResult = result;
}

export function setConversationComplete(memory: ConversationMemory, complete: boolean): void {
  memory.conversationComplete = complete;
}

export function resetMemory(memory: ConversationMemory): void {
  memory.activeIntent = "unknown";
  memory.previousIntents = [];
  memory.stage = "idle";
  memory.conversationComplete = false;
  memory.filledSlots = {};
  memory.slotConfidence = {};
  memory.entities = {};
  memory.conversationHistory = [];
  memory.conversationSummary = undefined;
  memory.lastAssistantQuestion = undefined;
  memory.retrievedChunks = undefined;
  memory.pendingConfirmation = undefined;
  memory.lastTool = undefined;
  memory.lastToolResult = undefined;
  memory.lastAppointment = undefined;
}

export function getMissingSlots(memory: ConversationMemory) {
  return computeMissingSlots(memory.filledSlots);
}

export function lockLanguage(memory: ConversationMemory, language: SupportedLanguage): void {
  memory.language = language;
  memory.languageLocked = true;
}

/**
 * Refresh the rolling summary every N turns instead of every turn, to save
 * tokens on a live call. `summarize` is injected so this module doesn't need
 * its own Groq client — planner.ts passes its summarizer in.
 */
export async function maybeRefreshSummary(
  memory: ConversationMemory,
  summarize: (history: HistoryTurn[]) => Promise<string>,
  everyNTurns = 6,
): Promise<void> {
  if (memory.conversationHistory.length === 0) return;
  if (memory.conversationHistory.length % everyNTurns !== 0) return;

  try {
    memory.conversationSummary = await summarize(memory.conversationHistory);
  } catch (err) {
    // Summary is an optimization, never block the turn on it.
    console.error("[Memory] Summary refresh failed:", err);
  }
}
