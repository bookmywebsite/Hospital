import { getOrCreateMemory, recordTurn, maybeRefreshSummary } from "../memory/memory.service";
import { getEntityExtractor } from "../conversation/entity-extractor";
import { getContextService } from "../context/context.service";
import { plan, composeToolReply, summarize } from "../planner/planner";
import { getTool } from "../tools/registry";
import { prisma } from "../../lib/prisma";
import { isEmergency } from "../../lib/voice/language-detection";
export class AgentService {
    async process(transcript, session, callbacks) {
        const memory = getOrCreateMemory(session);
        if (isEmergency(transcript)) {
            const tool = getTool("transfer_to_emergency");
            if (tool) {
                await tool.execute({ reason: transcript }, {
                    session,
                    memory,
                    ...callbacks,
                });
                return { handled: true };
            }
        }
        recordTurn(memory, { role: "user", content: transcript, ts: Date.now() });
        const entityExtractor = getEntityExtractor();
        const entities = await entityExtractor.extract(transcript, session.language);
        const contextService = getContextService();
        const context = await contextService.build(memory, entities, session.organizationId);
        this.mergeEntities(memory, entities);
        const decision = await plan(memory, transcript, context.hospitalName, context.retrievedDocs);
        let finalResponse;
        if (decision.toolCall) {
            const tool = getTool(decision.toolCall.name);
            if (tool) {
                const result = await tool.execute(decision.toolCall.arguments, {
                    session,
                    memory,
                    ...callbacks,
                });
                if (tool.name === "transfer_to_reception" || tool.name === "transfer_to_emergency") {
                    return { handled: true };
                }
                finalResponse = await composeToolReply(memory, context.hospitalName, tool.name, result);
            }
        }
        else if (decision.say) {
            finalResponse = decision.say;
        }
        else {
            finalResponse = "I'm sorry, could you repeat that?";
        }
        recordTurn(memory, { role: "assistant", content: finalResponse, ts: Date.now() });
        await maybeRefreshSummary(memory, summarize);
        await this.persistMemory(session, memory);
        await callbacks.speak(finalResponse);
        return { handled: true, response: finalResponse };
    }
    mergeEntities(memory, entities) {
        for (const [k, v] of Object.entries(entities)) {
            if (v && !memory.filledSlots[k]) {
                memory.filledSlots[k] = v;
            }
        }
        if (entities.language && !memory.languageLocked) {
            memory.language = entities.language;
        }
    }
    async persistMemory(session, memory) {
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
                        conversationSummary: memory.conversationSummary || null,
                    },
                    detectedIntent: memory.activeIntent,
                    detectedLanguage: memory.language,
                },
            });
        }
        catch (e) {
            console.error("[AgentService] Persist failed:", e);
        }
    }
}
let agentServiceInstance = null;
export function getAgentService() {
    if (!agentServiceInstance) {
        agentServiceInstance = new AgentService();
    }
    return agentServiceInstance;
}
