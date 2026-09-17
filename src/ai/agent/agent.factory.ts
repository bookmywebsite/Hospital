
import { getAgentService } from "./agent.service";
import { getLlmService } from "../llm/llm.service";
import { getPromptService } from "../llm/prompt.service";
import { getEntityExtractor } from "../conversation/entity-extractor";
import { getContextService } from "../context/context.service";
import { getResponseGenerator } from "./response-generator";

export class AgentFactory {
  static initialize(): void {
    getLlmService();
    getPromptService();
    getEntityExtractor();
    getContextService();
    getResponseGenerator();
    getAgentService();
    console.log("[AgentFactory] All services initialized");
  }
}
