
import type { SessionState } from "../../lib/voice/websocket-handler";
import type { ConversationMemory } from "../memory/types";

export interface AgentCallbacks {
  speak: (text: string) => Promise<void>;
  endCall: (delayMs?: number) => void;
}

export interface AgentTurnResult {
  handled: boolean;
  response?: string;
}

export interface AgentConfig {
  organizationId?: string;
  session: SessionState;
  memory: ConversationMemory;
}
