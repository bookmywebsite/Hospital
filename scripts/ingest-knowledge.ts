/**
 * Populates KnowledgeChunk with hospital knowledge so the RAG retriever in
 * src/ai/rag/retriever.ts has something to search. The table already exists
 * in prisma/schema.prisma — nothing to migrate to run this.
 *
 * Usage: npx tsx scripts/ingest-knowledge.ts <path-to-knowledge.json>
 *
 * knowledge.json shape:
 * [
 *   { "content": "OPD timings are 9 AM to 5 PM, Monday to Saturday.", "source": "timings.md" },
 *   { "content": "We accept Star Health, HDFC Ergo, and cashless...", "source": "insurance.md" }
 * ]
 *
 * Each entry becomes one chunk — keep entries focused (one fact/topic per
 * entry) rather than pasting whole documents in as a single chunk; retrieval
 * quality depends on chunks being small enough that a single chunk is either
 * clearly relevant or clearly not.
 */

import fs from "fs";
import { prisma } from "../src/lib/prisma.ts";
import { embed } from "../src/ai/rag/embeddings.ts";

interface KnowledgeEntry {
  content: string;
  source?: string;
}

async function main() {
  const filePath = process.argv[2];
  const agentId = process.argv[3] || process.env.DEFAULT_ORGANIZATION_ID;

  if (!filePath || !agentId) {
    console.error(
      "Usage: npx tsx scripts/ingest-knowledge.ts <knowledge.json> [agentId]\n" +
        "(agentId defaults to DEFAULT_ORGANIZATION_ID env var)",
    );
    process.exit(1);
  }

  const entries: KnowledgeEntry[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log(`Ingesting ${entries.length} chunks for agent ${agentId}...`);

  for (const [i, entry] of entries.entries()) {
    const embedding = await embed(entry.content);

    await prisma.knowledgeChunk.create({
      data: {
        agentId,
        agentName: agentId, // required field on this model; kept equal to agentId if no separate display name is tracked
        content: entry.content,
        source: entry.source,
        embedding,
      },
    });

    console.log(`  [${i + 1}/${entries.length}] ingested`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
