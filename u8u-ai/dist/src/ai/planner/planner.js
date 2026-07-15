import { getPromptService } from "../llm/prompt.service";
import { getLlmService } from "../llm/llm.service";
import { getToolDefinitionsForGroq } from "../tools/registry";
import { safeJsonParse } from "../llm/json-parser";
const PLANNER_MODEL = process.env.PLANNER_MODEL || "llama-3.3-70b-versatile";
export async function plan(memory, transcript, hospitalName, retrievedContext) {
    const promptService = getPromptService();
    const llmService = getLlmService();
    const systemPrompt = promptService.getPrompt("planner", {
        memory,
        hospitalName,
        retrievedContext,
    });
    const messages = [
        { role: "system", content: systemPrompt },
        ...memory.conversationHistory.map((turn) => ({
            role: turn.role,
            content: turn.content,
        })),
        { role: "user", content: transcript },
    ];
    const response = await llmService.plan(messages, getToolDefinitionsForGroq(), {
        model: PLANNER_MODEL,
        maxTokens: 200,
        temperature: 0.4,
    });
    const toolCall = response.toolCalls?.[0];

    if (toolCall?.function) {

        let args: Record<string, unknown> = {};

        try {

            args = safeJsonParse(
                toolCall.function.arguments || "{}"
            );

        } catch (e) {

            console.error(
                "[Planner] Failed parse tool args:",
                toolCall.function.arguments,
                e
            );

        }

        return {

            toolCall: {

                name: toolCall.function.name,

                arguments: args,

            },

        };

    }

    /*
    |--------------------------------------------------------------------------
    | XML fallback
    |--------------------------------------------------------------------------
    */

    if (response.content) {

        const match = response.content.match(
            /<function=([a-zA-Z0-9_]+)(\{[\s\S]*\})<\/function>/
        );

        if (match) {

            try {

                return {

                    toolCall: {

                        name: match[1],

                        arguments: safeJsonParse(match[2]),

                    },

                };

            } catch (e) {

                console.error(
                    "[Planner] XML fallback parse failed",
                    e
                );

            }

        }

    }

    return {

        say: response.content?.trim() || undefined,

    };
}
export async function composeToolReply(memory, hospitalName, toolName, toolResult) {
    const llm = getLlmService();
    const prompt = getPromptService();
    return await llm.composeToolReply(prompt.getPrompt("planner", { memory, hospitalName }), toolName, toolResult, memory.language);
}
export async function summarize(history) {
    const llm = getLlmService();
    return await llm.summarize(history);
}
