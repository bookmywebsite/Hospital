import type { Tool, ToolContext } from "./types";
import { retrieve, formatRetrievedContext } from "../rag/retriever";

interface FaqArgs {
  question: string;
}

/**
 * Used by the planner when the question isn't about the caller's own
 * appointment — hospital timings, insurance, parking, policies, etc.
 * Returns raw context; the planner composes the actual spoken sentence so
 * responses stay in the 1-2 sentence voice-call format instead of reading
 * knowledge-base text verbatim.
 */
export const hospitalFaqLookupTool: Tool<FaqArgs> = {
  name: "hospital_faq_lookup",
  description:
    "Retrieve relevant hospital knowledge (timings, insurance, parking, policies, packages, lab info, etc.) to answer a general question. Do not use for appointment booking/reschedule/cancel or doctor lookup — use those tools instead.",
  parameters: {
    type: "object",
    properties: { question: { type: "string", description: "The caller's question, verbatim" } },
    required: ["question"],
  },
  execute: async (args, ctx: ToolContext) => {
    const agentId = ctx.session.organizationId || process.env.DEFAULT_ORGANIZATION_ID!;
    const chunks = await retrieve(args.question, agentId);
    return { context: formatRetrievedContext(chunks), chunkCount: chunks.length };
  },
};
