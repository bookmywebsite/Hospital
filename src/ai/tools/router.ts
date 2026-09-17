import type { Tool, ToolContext } from "./types";
import { getTool } from "./registry";

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export async function executeToolCall(toolCall: ToolCall, ctx: ToolContext) {
  const tool = getTool(toolCall.name);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolCall.name}`);
  }

  return await tool.execute(toolCall.arguments, ctx);
}
