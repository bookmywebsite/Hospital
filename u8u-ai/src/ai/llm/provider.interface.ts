
export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
}

export interface LlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: LlmToolDefinition[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  responseFormat?: { type: "json_object" };
}

export interface LlmCompletionResponse {
  content?: string;
  toolCalls?: LlmToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LlmProvider {
  complete(messages: LlmMessage[], options?: LlmCompletionOptions): Promise<LlmCompletionResponse>;
}
