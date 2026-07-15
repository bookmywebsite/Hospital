import { prisma } from "../../lib/prisma";
import { getOrCreateMemory, recordTurn, mergeSlots, setIntent, maybeRefreshSummary } from "../memory/memory.service";
import { plan, composeToolReply, summarize } from "../planner/planner";
import { getTool } from "../tools/registry";
import { retrieve, formatRetrievedContext, RETRIEVAL_INTENTS } from "../rag/retriever";
import { isEmergency } from "../../lib/voice/language-detection";
const HOSPITAL_NAME = process.env.HOSPITAL_NAME || "the hospital";
/**
 * Single entry point that replaces the entire `switch (session.step)` block
 * in websocket-handler.ts. Call this instead of branching on session.step —
 * see the migration plan, Phase 3, for the exact call sites to replace.
 */
export async function handleAgentTurn(session, transcript, callbacks) {
    const memory = getOrCreateMemory(session);
    // Emergency is a hard pre-check, not a planner decision — same as the
    // existing isEmergency() gate, kept unconditional for safety.
    if (isEmergency(transcript)) {
        const tool = getTool("transfer_to_emergency");
        const ctx = { session, memory, ...callbacks };
        await tool.execute({ reason: transcript }, ctx);
        return { handled: true };
    }
    recordTurn(memory, { role: "user", content: transcript, ts: Date.now() });
    // Retrieval: only for intents where hospital knowledge helps, and only
    // once we already know roughly what this turn is about (cheap heuristic
    // pre-check; the planner call below still does the authoritative intent
    // read and can call hospital_faq_lookup itself if this pre-check misses).
    let retrievedContext;
    if (RETRIEVAL_INTENTS.has(memory.activeIntent)) {
        const agentId = session.organizationId || process.env.DEFAULT_ORGANIZATION_ID;
        const chunks = await retrieve(transcript, agentId);
        retrievedContext = formatRetrievedContext(chunks);
    }
    const decision = await plan(memory, transcript, HOSPITAL_NAME, retrievedContext);
    if (decision.intent)
        setIntent(memory, decision.intent);
    if (decision.extractedSlots)
        mergeSlots(memory, decision.extractedSlots);
    let finalResponse = decision.say;
    if (decision.toolCall) {
        const tool = getTool(decision.toolCall.name);
        if (!tool) {
            console.error("[Agent] Planner requested unknown tool:", decision.toolCall.name);
            finalResponse = "I'm sorry, could you repeat that?";
        }
        else {
            const ctx = { session, memory, ...callbacks };
            const result = await tool.execute(decision.toolCall.arguments, ctx);
            memory.lastTool = { name: tool.name, arguments: decision.toolCall.arguments, result, at: Date.now() };
            // Transfer tools already spoke + ended the call inside execute().
            if (tool.name === "transfer_to_reception" || tool.name === "transfer_to_emergency") {
                return { handled: true };
            }
            finalResponse = await composeToolReply(memory, HOSPITAL_NAME, tool.name, result);
        }
    }
    if (!finalResponse) {
        finalResponse = "Sorry, could you say that again?";
    }
    recordTurn(memory, { role: "assistant", content: finalResponse, ts: Date.now() });
    await maybeRefreshSummary(memory, summarize);
    await persistMemorySnapshot(session, memory);
    await callbacks.speak(finalResponse);
    return { handled: true, response: finalResponse };
}
/**
 * Best-effort snapshot to Conversation.state so a dropped/reconnected call
 * can resume with filledSlots/activeIntent intact instead of starting over.
 * Never blocks or fails the turn — this is durability, not correctness.
 */
async function persistMemorySnapshot(session, memory) {
    if (!session.conversationId)
        return;
    try {
        await prisma.conversation.update({
            where: { id: session.conversationId },
            data: {
                state: {
                    activeIntent: memory.activeIntent,
                    filledSlots: memory.filledSlots,
                    entities: memory.entities,
                    conversationSummary: memory.conversationSummary ?? null,
                },
                detectedIntent: memory.activeIntent,
                detectedLanguage: memory.language,
            },
        });
    }
    catch (err) {
        console.error("[Agent] Failed to persist memory snapshot:", err);
    }
}
