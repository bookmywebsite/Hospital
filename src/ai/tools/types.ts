import type { SessionState } from "../../lib/voice/websocket-handler";
import type { ConversationMemory } from "../memory/types";

/**
 * Transport-level actions (speak / end call) are injected rather than imported,
 * because safeSpeak/waitForExotelFlush/sendMarkToProvider are private to
 * websocket-handler.ts. This keeps tool files transport-agnostic and unit-testable
 * without a live WebSocket/Exotel/TTS stack.
 */
import type { PlannerDecision } from "../planner/planner.types";

export interface ToolContext {
  session: SessionState;
  memory: ConversationMemory;
  plannerDecision?: PlannerDecision;
  speak: (text: string) => Promise<void>;
  /** Ends the call after any queued audio has flushed. */
  endCall: (delayMs?: number) => void;
}

export interface JSONSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[]; [key: string]: unknown }>;
  required?: string[];
  [key: string]: unknown;
}

export interface Tool<Args = Record<string, unknown>, Result = unknown> {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (args: Args, ctx: ToolContext) => Promise<Result>;
}
