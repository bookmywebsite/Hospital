import { getLlmService } from "../llm/llm.service";
export class EntityExtractor {
    async extract(transcript, language = "en-IN") {
        const llm = getLlmService();
        const raw = await llm.extractEntities(transcript, language);
        return this.normalize(raw);
    }
    normalize(raw) {
        const entities = {};
        if (raw.patientName && typeof raw.patientName === "string") {
            entities.patientName = raw.patientName.trim();
        }
        if (raw.phone && typeof raw.phone === "string") {
            const cleaned = raw.phone.replace(/\D/g, "");
            if (cleaned.length >= 10) {
                entities.phone = cleaned.slice(-10);
            }
        }
        return entities;
    }
}
let extractorInstance = null;
export function getEntityExtractor() {
    if (!extractorInstance) {
        extractorInstance = new EntityExtractor();
    }
    return extractorInstance;
}
