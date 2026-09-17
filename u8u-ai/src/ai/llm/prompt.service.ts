
import type { ConversationMemory } from "../memory/types";

type PromptType = "planner" | "summary" | "entity" | "response" | "intent" | "toolReply";

export interface PromptContext {
  memory?: ConversationMemory;
  hospitalName?: string;
  retrievedContext?: string;
  language?: string;
  toolName?: string;
  toolResult?: unknown;
}

export class PromptService {
  getPrompt(type: PromptType, context: PromptContext = {}): string {
    switch (type) {
      case "planner":
        return this.buildPlannerPrompt(
          context.memory!,
          context.hospitalName || "the hospital",
          context.retrievedContext
        );
      case "summary":
        return this.buildSummaryPrompt();
      case "toolReply":
        return this.buildToolReplyPrompt(
          context.memory!,
          context.hospitalName || "the hospital",
          context.toolName!,
          context.toolResult!
        );
      case "entity":
        return this.buildEntityPrompt(context.language || "en-IN");
      case "response":
        return this.buildResponsePrompt(context.language || "en-IN");
      case "intent":
        return this.buildIntentPrompt();
      default:
        throw new Error("Unknown prompt type: " + type);
    }
  }

  private buildPlannerPrompt(
    memory: ConversationMemory,
    hospitalName: string,
    retrievedContext?: string
  ): string {
    const missing = this.getMissingSlots(memory);
    const lastAssistantMessage = memory.conversationHistory
      .slice()
      .reverse()
      .find((turn) => turn.role === "assistant")?.content;
    const currentStage = memory.pendingConfirmation
      ? "awaiting_confirmation"
      : memory.activeIntent === "appointment_booking"
      ? missing.length > 0
        ? `collecting_${String(missing[0])}`
        : "ready_to_confirm"
      : "idle";
    const lastToolName = memory.lastTool?.name ?? "none";

    let prompt = "You are the planning engine for a hospital voice assistant on a live phone call.\n";
    prompt += "IMPORTANT: Return ONLY valid JSON. Never return markdown, explanations, or any text before or after the JSON object.\n";
    prompt += "The exact JSON schema is:\n";
    prompt += "{\n";
    prompt += "  \"intent\": \"...\",\n";
    prompt += "  \"secondaryIntent\": null,\n";
    prompt += "  \"stage\": \"idle\",\n";
    prompt += "  \"conversationComplete\": false,\n";
    prompt += "  \"actions\": [],\n";
    prompt += "  \"requiresRetrieval\": false,\n";
    prompt += "  \"confirmationRequired\": false,\n";
    prompt += "  \"say\": \"...\",\n";
    prompt += "  \"toolCall\": null,\n";
    prompt += "  \"extractedSlots\": {},\n";
    prompt += "  \"missingSlots\": [],\n";
    prompt += "}\n";
    prompt += "Respond ONLY in " + memory.language + ". Keep replies short and natural like a voice receptionist.\n\n";
    prompt += "CURRENT CONVERSATION STATE:\n";
    prompt += `Active Intent: ${memory.activeIntent}\n`;
    prompt += `Current Stage: ${currentStage}\n`;
    prompt += `Waiting For Confirmation: ${Boolean(memory.pendingConfirmation)}\n`;
    prompt += `Last Tool: ${lastToolName}\n`;
    prompt += `Last Assistant Message: ${lastAssistantMessage ? `\"${lastAssistantMessage}\"` : "none"}\n\n`;
    prompt += "KNOWN SO FAR (never ask for these again):\n";
    prompt += JSON.stringify(memory.filledSlots, null, 2) + "\n\n";
    prompt += "STILL MISSING FOR AN APPOINTMENT:\n";
    prompt += missing.length > 0 ? JSON.stringify(missing) : "nothing, all required info is present";
    prompt += "\n\n";
    if (memory.conversationSummary) {
      prompt += "CONVERSATION SO FAR: " + memory.conversationSummary + "\n";
    }
    if (retrievedContext) {
      prompt += "RELEVANT HOSPITAL KNOWLEDGE:\n" + retrievedContext + "\n";
    }
    prompt += "\nRULES:\n";
    prompt += "- Never use IVR phrases such as main menu or press 1. Speak naturally.\n";
    prompt += "- Never ask for information already present in KNOWN SO FAR.\n";
    prompt += "- Never change the active intent unless the user clearly switches topics. If active intent is appointment_booking, continue collecting appointment slots.\n";
    prompt += "- If the previous assistant message was asking for confirmation and the user replies with yes/yeah/correct/haan/haudu/right, call book_appointment immediately. Do not ask for confirmation again.\n";
    prompt += "- If the user replies no/incorrect/change date/change doctor/change phone after a confirmation prompt, update the relevant slot or ask what should be changed instead of asking confirmation again.\n";
    prompt += "- If the user gives a correction for an earlier slot, overwrite the existing slot value.\n";
    prompt += "- If the user provides all required appointment details in one turn, do not ask another missing question. Confirm the details or proceed to booking if already confirmed.\n";
    prompt += "- If the user asks multiple questions or requests in one utterance, include secondaryIntent or actions and handle both.\n";
    prompt += "- Return a stage field describing the current conversation phase (e.g. greeting, collecting_name, collecting_phone, waiting_confirmation, booking, finished).\n";
    prompt += "- Use conversationComplete=true only when the caller has finished and the call can be closed naturally.\n";
    prompt += "- Only call lookup_doctor if doctorName, department, or specialty is available.\n";
    prompt += "- Only call book_appointment if patientName, phone, department, scheduledAt, and confirmation are all present.\n";
    prompt += "- Only call reschedule_appointment or cancel_appointment if the caller has explicitly confirmed the action and the appointment is known.\n";
    prompt += "- If the user asks about hospital timing, insurance, parking, policies, packages, or lab tests, set requiresRetrieval=true and use retrieval before answering.\n";
    prompt += "- If you choose toolCall, keep say short. The tool result will be used to generate the spoken reply.\n";
    prompt += "- If information is missing for a booking, ask a single missing question.\n";
    prompt += "- Do not invent or hallucinate names, phone numbers, dates, departments, or confirmation responses.\n";
    prompt += "- Do not output XML or provider-specific function markup.\n";
    prompt += "- The only allowed tool-call representation is the JSON object in toolCall. toolCall must be null when no execution is required.\n";
    prompt += "- Only answer directly in say when no toolCall is appropriate.\n";
    prompt += "- After booking, rescheduling, or cancelling an appointment, ask 'Anything else I can help you with?' and only end the call after the user says no or goodbye.\n";
    prompt += "- If the utterance is only a greeting, acknowledgment, or thanks, do not treat it as a new booking intent.\n";
    prompt += "- The only allowed tool-call representation is the JSON object in toolCall.\n";
    return prompt;
  }

  private buildSummaryPrompt(): string {
    return "Summarize this hospital call conversation so far in 1-2 sentences.";
  }

  private buildToolReplyPrompt(
    memory: ConversationMemory,
    hospitalName: string,
    toolName: string,
    toolResult: unknown
  ): string {
    return "Tool " + toolName + " just ran with this result: " + JSON.stringify(toolResult) + ". Compose a short spoken reply in " + memory.language + ".";
  }

  private buildEntityPrompt(language: string): string {
    return "Extract entities from this hospital call transcript. Respond ONLY in JSON.";
  }

  private buildResponsePrompt(language: string): string {
    return "You are a hospital voice assistant. Respond in " + language + " in 1-2 short sentences.";
  }

  private buildIntentPrompt(): string {
    return "Classify caller's intent: appointment_booking, doctor_info, hospital_faq, emergency, transfer_to_reception, general_inquiry.";
  }

  private getMissingSlots(memory: ConversationMemory): Array<keyof typeof memory.filledSlots> {
    const required = ["patientName", "phone", "department", "scheduledAt"] as const;
    return required.filter((slot) => !memory.filledSlots[slot]);
  }
}

let promptServiceInstance: PromptService | null = null;
export function getPromptService(): PromptService {
  if (!promptServiceInstance) {
    promptServiceInstance = new PromptService();
  }
  return promptServiceInstance;
}
