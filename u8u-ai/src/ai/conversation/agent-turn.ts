import type { SessionState } from "../../lib/voice/websocket-handler";

export interface AgentTurnResult {
  handled: boolean;
  response?: string;
}

export async function handleAgentTurn(
  session: SessionState,
  transcript: string,
  callbacks: {
    speak: (text: string) => Promise<void>;
    endCall: (delayMs?: number) => void;
  },
): Promise<AgentTurnResult> {
  const { handleConversationTurn: manageConversationTurn } = await import("./conversation-manager");
  return manageConversationTurn(session, transcript, callbacks);
}
