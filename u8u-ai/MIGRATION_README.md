# AI_HOSPITAL — RAG/Agent Migration: What's Actually In This Zip

This is your repo with the hardcoded appointment flow replaced by a planner + tool-registry
agent, applied and syntax-checked — not just a plan this time.

## New files (15)

```
src/ai/memory/types.ts              ConversationMemory, AppointmentSlots, Intent types
src/ai/memory/memory.service.ts     load/merge/summarize memory (lives on session.memory)
src/ai/planner/planner.types.ts     PlannerDecision type
src/ai/planner/planner.ts           the single Groq function-calling call per turn
src/ai/prompts/planner.prompt.ts    system prompt builder (slot rules, confirmation rules)
src/ai/tools/types.ts               Tool / ToolContext interfaces
src/ai/tools/registry.ts            wires every tool + exposes Groq tool defs
src/ai/tools/appointment.tool.ts    book / reschedule / cancel — real Prisma writes
src/ai/tools/doctor.tool.ts         doctor/department lookup
src/ai/tools/transfer.tool.ts       reception + emergency transfer (deduped)
src/ai/tools/hospital-faq.tool.ts   wraps the RAG retriever as a tool
src/ai/rag/embeddings.ts            embed() + cosineSimilarity() — needs an API key, see below
src/ai/rag/retriever.ts             searches KnowledgeChunk (already in your schema, was unused)
src/ai/conversation/agent-turn.ts   handleAgentTurn() — the single entry point
scripts/ingest-knowledge.ts         populates KnowledgeChunk from a JSON file
```

## Modified files (3)

- **`src/lib/voice/websocket-handler.ts`** — the `switch (session.step)` block (old lines
  1127–1585: `main_menu` / `ask_name` / `ask_phone` / `ask_department` / `ask_date` / `confirm`)
  is gone. In its place: the `language_selection` gate is kept as-is (it's STT/TTS provider
  switching, not conversation logic — deliberately not migrated, see the earlier migration
  plan doc, §9 Phase 5), and everything else now calls `handleAgentTurn()`. One import line
  added. Nothing else in the file was touched — STT, TTS, Exotel plumbing, barge-in handling,
  silence timers, all untouched.
- **`tsconfig.voice.json`** — added `src/ai/**/*.ts` to `include` so the new layer is part of
  the voice build.
- **`prisma/schema.prisma`** — two additive, nullable fields: `KnowledgeChunk.category` (optional
  pre-filter for retrieval) and `Conversation.state` (Json snapshot of memory, for reconnect
  durability). Both are safe to add with `prisma db push` / `prisma migrate dev` — no data loss,
  no existing column touched.

## What I verified vs. what I couldn't

**Verified:** every file type-checks with `tsc --noEmit --noResolve` (catches real syntax
errors; `--noResolve` just skips module resolution since `node_modules` isn't installed in
this sandbox). Brace/paren balance of the edited file matches the original file's baseline.
The appointment-booking DB logic in `appointment.tool.ts` is your own pre-existing logic
(previously inline at old line ~1954-2006), lifted, not rewritten — I only added a `patient.upsert`
instead of `patient.create` so a repeat caller doesn't violate the `[organizationId, phone]`
unique constraint.

**Not verified (I don't have your credentials or a running DB/Redis/Exotel line to test
against):** an actual live call end-to-end, Groq's exact tool-call response shape against
your installed `groq-sdk` version (I typed planner.ts's message array as `any[]` rather than
guess a namespace path that might not match your version), and whether `llama-3.3-70b-versatile`
is the right model/latency tradeoff for your Groq plan — swap `PLANNER_MODEL` env var if not.

## Before you run it

1. **Install deps, generate the Prisma client, push the schema:**
   ```
   npm install
   npx prisma generate
   npx prisma db push   # or: npx prisma migrate dev --name add-category-and-conversation-state
   ```
2. **Set an embeddings API key** — Groq doesn't serve embeddings, so RAG needs a separate
   provider. `src/ai/rag/embeddings.ts` defaults to OpenAI's `text-embedding-3-small`:
   ```
   EMBEDDING_API_KEY=sk-...      # or reuse OPENAI_API_KEY if you already have one
   ```
   If you'd rather not add a second API key, swap the `fetch` call in `embeddings.ts` for
   Cohere or a local model — same function signature, nothing else needs to change.
3. **Populate the knowledge base** (currently empty in your DB):
   ```
   npx tsx scripts/ingest-knowledge.ts path/to/knowledge.json <organizationId>
   ```
   `knowledge.json` is an array of `{ "content": "...", "source": "..." }` — see the comment
   at the top of the script for the exact shape.
4. **Run the voice server as usual:** `npm run voice:dev`.

## What I'd genuinely test before calling this production-ready

- A real call through the full booking flow (name → phone → department → date → confirm →
  `book_appointment` tool fires) against your actual Groq key, to confirm tool-call arguments
  come back the shape `planner.ts` expects.
- Language switching mid-call still working now that `main_menu`'s language-menu prompt is
  gone — the planner should offer the same three options conversationally, but the exact
  wording will differ from the old hardcoded `languageMenu` object. Worth listening to a test
  call in each language.
- Latency: one Groq call per turn plus, when a tool fires, a second `composeToolReply` call.
  That second call only happens on tool-calling turns (booking, transfer, lookup), not every
  turn — but measure it on your infra before trusting it on a live line.

## What's deliberately still using the old code path

Per the phased plan: `language_selection` and the reception/emergency `transfer_pending` early
return (old line 955, untouched) are still handled by the pre-existing code, not the agent.
Both are transport-level gates (switching STT/TTS locale; closing the socket after a transfer
intent is recorded) rather than conversational decisions, so folding them into the planner
buys you very little and adds risk. If you want them agentic too, that's Phase 5 in the earlier
plan — flag it and I'll do that pass next.
