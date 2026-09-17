import { createEmptyMemory, computeMissingSlots, } from "./types";
/**
 * Memory lives on the session object itself (`session.memory`), same lifecycle
 * as the old `session.step` / `session.appointmentData` fields — no new store,
 * no new infra. This just adds a typed, single-object shape instead of scattered
 * fields, and gives it real merge/summary behaviour.
 */
export function getOrCreateMemory(session) {
    const anySession = session;
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
export function recordTurn(memory, turn) {
    memory.conversationHistory.push(turn);
    // Keep the raw history bounded — same 20-turn cap GroqDualBrain already uses,
    // so token usage doesn't grow unbounded on long calls.
    const MAX_TURNS = 20;
    if (memory.conversationHistory.length > MAX_TURNS) {
        memory.conversationHistory = memory.conversationHistory.slice(-MAX_TURNS);
    }
}
export function mergeSlots(memory, updates) {
    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== null && value !== "") {
            memory.filledSlots[key] = value;
        }
    }
}
export function setIntent(memory, intent) {
    if (memory.activeIntent !== intent) {
        memory.previousIntents.push(memory.activeIntent);
    }
    memory.activeIntent = intent;
}
export function getMissingSlots(memory) {
    return computeMissingSlots(memory.filledSlots);
}
export function lockLanguage(memory, language) {
    memory.language = language;
    memory.languageLocked = true;
}
/**
 * Refresh the rolling summary every N turns instead of every turn, to save
 * tokens on a live call. `summarize` is injected so this module doesn't need
 * its own Groq client — planner.ts passes its summarizer in.
 */
export async function maybeRefreshSummary(memory, summarize, everyNTurns = 6) {
    if (memory.conversationHistory.length === 0)
        return;
    if (memory.conversationHistory.length % everyNTurns !== 0)
        return;
    try {
        memory.conversationSummary = await summarize(memory.conversationHistory);
    }
    catch (err) {
        // Summary is an optimization, never block the turn on it.
        console.error("[Memory] Summary refresh failed:", err);
    }
}
