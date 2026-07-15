import { embed } from "./embeddings";
import { upsertChunk, deleteChunksByAgent } from "./vector-store";

export async function indexText(agentId: string, texts: Array<{ content: string; source?: string; category?: string }>) {
  await deleteChunksByAgent(agentId);

  for (const item of texts) {
    const embedding = await embed(item.content);
    await upsertChunk(agentId, item.content, embedding, item.source, item.category);
  }
}
