
import type { ConversationMemory } from "../memory/types";
import type { ExtractedEntities } from "../conversation/entity-extractor";
import { retrieve } from "../rag/retriever";

export interface ConversationContext {
  history: Array<{ role: string; content: string }>;
  summary?: string;
  language: string;
  activeIntent?: string;
  slots: Record<string, unknown>;
  entities: ExtractedEntities;
  toolOutputs: Record<string, unknown>;
  retrievedDocs?: string;
  hospitalName: string;
}

export class ContextService {
  async build(memory: ConversationMemory, entities: ExtractedEntities, orgId?: string): Promise<ConversationContext> {
    const ctx: ConversationContext = {
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
        } catch (e) {
          console.warn("[ContextService] Retrieve failed:", e);
        }
      }
    }
    return ctx;
  }

  private shouldRetrieve(memory: ConversationMemory): boolean {
    const retrieveIntents = new Set(["hospital_faq", "doctor_info", "general_inquiry"]);
    return retrieveIntents.has(memory.activeIntent || "");
  }

  private getLastUserMsg(memory: ConversationMemory): string | undefined {
    const reversed = [...memory.conversationHistory].reverse();
    const last = reversed.find((m) => m.role === "user");
    return last?.content;
  }
}

let ctxServiceInstance: ContextService | null = null;
export function getContextService(): ContextService {
  if (!ctxServiceInstance) {
    ctxServiceInstance = new ContextService();
  }
  return ctxServiceInstance;
}
