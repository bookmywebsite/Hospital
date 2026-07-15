import { prisma } from "../../lib/prisma";
import type { RetrievedChunk } from "./retriever";

export async function upsertChunk(agentId: string, content: string, embedding: number[], source?: string, category?: string) {
  return prisma.knowledgeChunk.upsert({
    where: { id: `${agentId}-${source ?? Math.random().toString(36).slice(2)}` },
    create: { agentId, content, embedding, source, category },
    update: { content, embedding, source, category, updatedAt: new Date() },
  });
}

export async function deleteChunksByAgent(agentId: string) {
  return prisma.knowledgeChunk.deleteMany({ where: { agentId } });
}

export async function similaritySearch(agentId: string, queryEmbedding: number[], topK = 4): Promise<RetrievedChunk[]> {
  const chunks = await prisma.knowledgeChunk.findMany({ where: { agentId }, select: { content: true, source: true, embedding: true } });
  return chunks
    .map((chunk) => ({
      content: chunk.content,
      source: chunk.source ?? undefined,
      embedding: chunk.embedding as number[],
      score: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
