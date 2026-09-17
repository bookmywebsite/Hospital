export class PromptService {
    getPrompt(type, context = {}) {
        switch (type) {
            case "planner":
                return this.buildPlannerPrompt(context.memory, context.hospitalName || "the hospital", context.retrievedContext);
            case "summary":
                return this.buildSummaryPrompt();
            case "toolReply":
                return this.buildToolReplyPrompt(context.memory, context.hospitalName || "the hospital", context.toolName, context.toolResult);
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
    buildPlannerPrompt(memory, hospitalName, retrievedContext) {
        const missing = this.getMissingSlots(memory);
        let prompt = "You are the front-desk voice assistant at " + hospitalName + ", on a live phone call.\n";
        prompt += "Respond ONLY in " + memory.language + ". Keep replies to 1-2 short sentences.\n\n";
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
        prompt += "- Never ask for information already present in KNOWN SO FAR.\n";
        prompt += "- Before calling book_appointment, first ask the caller to confirm the details.\n";
        prompt += "- If caller describes emergency symptoms, call transfer_to_emergency immediately.\n";
        return prompt;
    }
    buildSummaryPrompt() {
        return "Summarize this hospital call conversation so far in 1-2 sentences.";
    }
    buildToolReplyPrompt(memory, hospitalName, toolName, toolResult) {
        return "Tool " + toolName + " just ran with this result: " + JSON.stringify(toolResult) + ". Compose a short spoken reply in " + memory.language + ".";
    }
    buildEntityPrompt(language) {
        return "Extract entities from this hospital call transcript. Respond ONLY in JSON.";
    }
    buildResponsePrompt(language) {
        return "You are a hospital voice assistant. Respond in " + language + " in 1-2 short sentences.";
    }
    buildIntentPrompt() {
        return "Classify caller's intent: appointment_booking, doctor_info, hospital_faq, emergency, transfer_to_reception, general_inquiry.";
    }
    getMissingSlots(memory) {
        const required = ["patientName", "phone", "department", "scheduledAt"];
        return required.filter((slot) => !memory.filledSlots[slot]);
    }
}
let promptServiceInstance = null;
export function getPromptService() {
    if (!promptServiceInstance) {
        promptServiceInstance = new PromptService();
    }
    return promptServiceInstance;
}
