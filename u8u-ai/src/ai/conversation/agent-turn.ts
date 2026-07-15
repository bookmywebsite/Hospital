import type { SessionState } from "../../lib/voice/websocket-handler";
import type { AgentTurnCallbacks } from "./agent-turn";
import { handleConversationTurn as manageConversationTurn } from "./conversation-manager";

export interface AgentTurnResult {
  handled: boolean;
  response?: string;
}

export interface AgentTurnCallbacks {
  speak: (text: string) => Promise<void>;
  endCall: (delayMs?: number) => void;
}

export async function handleAgentTurn(
  session: SessionState,
  transcript: string,
  callbacks: AgentTurnCallbacks,
): Promise<AgentTurnResult> {
  return manageConversationTurn(session, transcript, callbacks);
}
