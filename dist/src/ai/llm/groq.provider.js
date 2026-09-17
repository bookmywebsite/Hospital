import Groq from "groq-sdk";
const DEFAULT_PLANNER_MODEL = "llama-3.3-70b-versatile";
export class GroqProvider {
    client;
    constructor(apiKey) {
        this.client = new Groq({
            apiKey: apiKey || process.env.GROQ_API_KEY,
        });
    }
    async complete(messages, options) {
        const response = await this.client.chat.completions.create({
            model: options?.model || DEFAULT_PLANNER_MODEL,
            messages: messages as any,
            max_tokens: options?.maxTokens || 200,
            temperature: options?.temperature ?? 0.4,

            ...(options?.tools?.length
                ? {
                    tools: options.tools as any,
                    tool_choice: options.toolChoice ?? "auto",
                }
                : {}),

            ...(options?.responseFormat
                ? { response_format: options.responseFormat as any }
                : {}),
        });
        const choice = response.choices[0]?.message;
        return {
            content: choice?.content || undefined,
            toolCalls: choice?.tool_calls?.map((tc) => ({
                id: tc.id,
                type: tc.type,
                function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                },
            })),
            usage: response.usage
                ? {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens,
                }
                : undefined,
        };
    }
}
let groqProviderInstance = null;
export function getGroqProvider() {
    if (!groqProviderInstance) {
        groqProviderInstance = new GroqProvider();
    }
    return groqProviderInstance;
}
