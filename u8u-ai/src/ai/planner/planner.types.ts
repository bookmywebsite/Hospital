import type { Intent } from "../memory/types";

export interface PlannerInput {
  transcript: string;
  hospitalName: string;
  retrievedContext?: string;
}

export interface PlannerDecision {
  /** The spoken reply, if the planner answered directly without a tool call. */
  say?: string;
  /** Present when the model chose to call a tool instead of answering directly. */
  toolCall?: { name: string; arguments: Record<string, unknown> };
  /** Best-effort intent tag for this turn, used for retrieval routing and analytics. */
  intent?: Intent;
  /** Secondary intent when the user asks for more than one thing in a single turn. */
  secondaryIntent?: Intent | string;
  /** Alternative action list for multi-intent turns. */
  actions?: string[];
  /** Planner stage label for the current conversational lifecycle. */
  stage?: string;
  /** Whether the planner considers the conversation complete. */
  conversationComplete?: boolean;
  /** Slot values the model extracted from this turn's transcript (name, phone, department, date). */
  extractedSlots?: Record<string, string>;
  /** Confidence score of the intent classification */
  confidence?: number;
  /** Entities extracted from the transcript */
  entities?: Record<string, string | string[]>;
  /** Missing required slots for the current intent */
  missingSlots?: string[];
  /** The planner thinks this turn needs retrieval before answering. */
  requiresRetrieval?: boolean;
  /** The planner thinks the current action requires explicit confirmation. */
  confirmationRequired?: boolean;
  /** Explanation of the planner's decision for debugging */
  plannerReason?: string;
}
