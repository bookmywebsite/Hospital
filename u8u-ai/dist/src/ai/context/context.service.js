import { retrieve } from "../rag/retriever";
export class ContextService {
    async build(memory, entities, orgId) {
        const ctx = {
            history: memory.conversationHistory,
            summary: memory.conversationSummary,
            language: memory.language,
            activeIntent: memory.activeIntent,
            slots: memory.filledSlots,
            entities,
            toolOutputs: {},
            hospitalName: process.env.HOSPITAL_NAME || "the hospital",
        };
        if (this.shouldRetrieve(memory)) {
            const lastUserMsg = this.getLastUserMsg(memory);
            if (lastUserMsg) {
                try {
                    const docs = await retrieve(lastUserMsg, orgId || process.env.DEFAULT_ORGANIZATION_ID || "");
                    if (docs.length > 0) {
                        ctx.retrievedDocs = docs.map((d) => d.content).join("\n---\n");
                    }
                }
                catch (e) {
                    console.warn("[ContextService] Retrieve failed:", e);
                }
            }
        }
        return ctx;
    }
    shouldRetrieve(memory) {
        const retrieveIntents = new Set(["hospital_faq", "doctor_info", "general_inquiry"]);
        return retrieveIntents.has(memory.activeIntent || "");
    }
    getLastUserMsg(memory) {
        const reversed = [...memory.conversationHistory].reverse();
        const last = reversed.find((m) => m.role === "user");
        return last?.content;
    }
}
let ctxServiceInstance = null;
export function getContextService() {
    if (!ctxServiceInstance) {
        ctxServiceInstance = new ContextService();
    }
    return ctxServiceInstance;
}
