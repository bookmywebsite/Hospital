
import type {
  LlmProvider,
  LlmMessage,
  LlmCompletionOptions,
  LlmToolDefinition,
} from "./provider.interface";
import { getGroqProvider } from "./groq.provider";
import { getPromptService } from "./prompt.service";
import { safeJsonParse } from "./json-parser";

export class LlmService {
  private provider: LlmProvider;
  private promptService: ReturnType<typeof getPromptService>;

  constructor(
    provider?: LlmProvider,
    promptService?: ReturnType<typeof getPromptService>
  ) {
    this.provider = provider || getGroqProvider();
    this.promptService = promptService || getPromptService();
  }

  async plan(
    messages: LlmMessage[],
    tools: LlmToolDefinition[],
    options?: Omit<LlmCompletionOptions, "tools">
  ) {
    return this.provider.complete(messages, {
      ...options,
      tools,
      toolChoice: "auto",
    });
  }

  async summarize(history: Array<{ role: string; content: string }>): Promise<string> {
    const messages: LlmMessage[] = [
      { role: "system", content: this.promptService.getPrompt("summary") },
      {
        role: "user",
        content: history.map((t) => t.role + ": " + t.content).join("\n"),
      },
    ];

    const response = await this.provider.complete(messages, {
      model: "llama-3.1-8b-instant",
      maxTokens: 80,
      temperature: 0.2,
    });

    return response.content || "";
  }

  async composeToolReply(
    systemPrompt: string,
    toolName: string,
    toolResult: unknown,
    language: string
  ): Promise<string> {
    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: "Tool " + toolName + " just ran with this result: " + JSON.stringify(toolResult) + ". Compose a short spoken reply in " + language + ".",
      },
    ];

    const response = await this.provider.complete(messages, {
      maxTokens: 200,
      temperature: 0.4,
    });

    return response.content || "";
  }

  async extractEntities(transcript: string, language: string): Promise<Record<string, unknown>> {
    const messages: LlmMessage[] = [
      {
        role: "system",
        content: this.promptService.getPrompt("entity", { language }),
      },
      { role: "user", content: transcript },
    ];

    const response = await this.provider.complete(messages, {
      model: "llama-3.1-8b-instant",
      maxTokens: 300,
      temperature: 0.3,
      responseFormat: { type: "json_object" },
    });

    return safeJsonParse(response.content || "{}");
  }
}

let llmServiceInstance: LlmService | null = null;
export function getLlmService(): LlmService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LlmService();
  }
  return llmServiceInstance;
}
