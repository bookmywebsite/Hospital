/** Fields required before `appointment.tool.ts` will execute a booking. */
export const REQUIRED_FOR_BOOKING = [
    "patientName",
    "phone",
    "department",
    "scheduledAt",
];
export function createEmptyMemory(sessionId, language) {
    return {
        sessionId,
        language,
        languageLocked: false,
        activeIntent: "unknown",
        previousIntents: [],
        filledSlots: {},
        entities: {},
        conversationHistory: [],
    };
}
export function computeMissingSlots(slots) {
    return REQUIRED_FOR_BOOKING.filter((key) => !slots[key]);
}
