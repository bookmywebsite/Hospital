import { getGroqProvider } from "./groq.provider";
import { getPromptService } from "./prompt.service";
import { safeJsonParse } from "./json-parser";
export class LlmService {
    provider;
    promptService;
    constructor(provider, promptService) {
        this.provider = provider || getGroqProvider();
        this.promptService = promptService || getPromptService();
    }
    async plan(messages, tools, options) {
        return this.provider.complete(messages, {
            ...options,
            tools,
            toolChoice: "auto",
        });
    }
    async summarize(history) {
        const messages = [
            { role: "system", content: this.promptService.getPrompt("summary") },
            {
                role: "user",
                content: history.map((t) => t.role + ": " + t.content).join("\n"),
            },
        ];
        const response = await this.provider.complete(messages, {
            model: "openai/gpt-oss-20b",
            maxTokens: 80,
            temperature: 0.2,
        });
        return response.content || "";
    }
    async composeToolReply(systemPrompt, toolName, toolResult, language) {
        const messages = [
            { role: "system", content: systemPrompt },
            {
                role: "system",
                content: "Tool " + toolName + " just ran with this result: " + JSON.stringify(toolResult) + ". Compose a short spoken reply in " + language + ".",
            },
        ];
        const response = await this.provider.complete(messages, {
            maxTokens: 120,
            temperature: 0.4,
        });
        return response.content || "";
    }
    async extractEntities(transcript, language) {
        const messages = [
            {
                role: "system",
                content: this.promptService.getPrompt("entity", { language }),
            },
            { role: "user", content: transcript },
        ];
        const response = await this.provider.complete(messages, {
            model: "openai/gpt-oss-20b",
            maxTokens: 200,
            temperature: 0.3,
            responseFormat: { type: "json_object" },
        });
        return safeJsonParse(response.content || "{}");
    }
}
let llmServiceInstance = null;
export function getLlmService() {
    if (!llmServiceInstance) {
        llmServiceInstance = new LlmService();
    }
    return llmServiceInstance;
}
