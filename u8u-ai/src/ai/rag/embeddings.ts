/**
 * Groq doesn't serve an embeddings endpoint, so this calls a separate provider.
 * Defaults to OpenAI's text-embedding-3-small (1536 dims) — swap the fetch below
 * for Cohere/local if you'd rather not add a second API key. Whatever you pick,
 * keep the dimension consistent with what's already stored in KnowledgeChunk.embedding,
 * or existing chunks and new queries won't compare meaningfully.
 */

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;

export async function embed(text: string): Promise<number[]> {
  if (!EMBEDDING_API_KEY) {
    throw new Error(
      "EMBEDDING_API_KEY (or OPENAI_API_KEY) is not set — required for RAG retrieval and knowledge ingestion.",
    );
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Embedding request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.data[0].embedding as number[];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
