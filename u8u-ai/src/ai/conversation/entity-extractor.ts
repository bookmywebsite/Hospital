
import { getLlmService } from "../llm/llm.service";
import type { SupportedLanguage } from "../../lib/voice/language-detection";

export interface ExtractedEntities {
  patientName?: string;
  phone?: string;
  email?: string;
  department?: string;
  doctorName?: string;
  scheduledAt?: string;
  symptoms?: string;
  insurance?: string;
  language?: SupportedLanguage;
}

export class EntityExtractor {
  async extract(transcript: string, language: SupportedLanguage = "en-IN"): Promise<ExtractedEntities> {
    const llm = getLlmService();
    const raw = await llm.extractEntities(transcript, language);
    return this.normalize(raw);
  }

  private normalize(raw: Record<string, unknown>): ExtractedEntities {
    const entities: ExtractedEntities = {};
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

let extractorInstance: EntityExtractor | null = null;
export function getEntityExtractor(): EntityExtractor {
  if (!extractorInstance) {
    extractorInstance = new EntityExtractor();
  }
  return extractorInstance;
}
