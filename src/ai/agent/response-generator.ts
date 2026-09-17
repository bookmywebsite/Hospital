
import type { PlannerDecision } from "../planner/planner.types";
import type { ConversationMemory } from "../memory/types";

export class ResponseGenerator {
  async generate(decision: PlannerDecision, memory: ConversationMemory, hospitalName: string): Promise<string> {
    if (decision.say) {
      return decision.say;
    }
    return "Okay, let's help with that.";
  }
}

let rgInstance: ResponseGenerator | null = null;
export function getResponseGenerator(): ResponseGenerator {
  if (!rgInstance) {
    rgInstance = new ResponseGenerator();
  }
  return rgInstance;
}
