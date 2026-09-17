import { prisma } from "../../lib/prisma";
import { embed, cosineSimilarity } from "./embeddings";
const RELEVANCE_FLOOR = 0.7;
/**
 * In-memory cosine similarity over KnowledgeChunk.embedding (Float[]).
 * Fine up to a few thousand chunks. If the knowledge base grows past that,
 * migrate the column to pgvector + an ivfflat/hnsw index and replace the
 * `findMany` + JS sort below with a `<=>` ORDER BY in raw SQL — same return
 * shape, so nothing calling retrieve() needs to change.
 */
export async function retrieve(query, agentId, topK = 4) {
    const queryEmbedding = await embed(query);
    const chunks = await prisma.knowledgeChunk.findMany({
        where: { agentId },
        select: { content: true, source: true, embedding: true },
    });
    return chunks
        .map((c) => ({
        content: c.content,
        source: c.source ?? undefined,
        score: cosineSimilarity(queryEmbedding, c.embedding),
    }))
        .filter((c) => c.score > RELEVANCE_FLOOR)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}
export function formatRetrievedContext(chunks) {
    if (chunks.length === 0)
        return "";
    return chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n");
}
/** Intents where retrieval is worth the extra round-trip; everything else skips it. */
export const RETRIEVAL_INTENTS = new Set([
    "doctor_info",
    "hospital_timing",
    "insurance",
    "lab_reports",
    "billing",
    "medical_packages",
    "general_inquiry",
]);
