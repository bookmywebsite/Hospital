import type { SupportedLanguage } from "../../lib/voice/language-detection";

export type Intent =
  | "appointment_booking"
  | "appointment_reschedule"
  | "appointment_cancel"
  | "doctor_info"
  | "hospital_timing"
  | "insurance"
  | "emergency"
  | "transfer_to_reception"
  | "lab_reports"
  | "billing"
  | "medical_packages"
  | "general_inquiry"
  | "greeting"
  | "goodbye"
  | "unknown";

export interface AppointmentSlots {
  patientName?: string;
  phone?: string;
  department?: string;
  doctorId?: string;
  /** ISO string — output of chrono-node parsing, kept as string so it's JSON-safe in memory/DB */
  scheduledAt?: string;
  reason?: string;
  [key: string]: string | undefined;
}

/** Fields required before `appointment.tool.ts` will execute a booking. */
export const REQUIRED_FOR_BOOKING: (keyof AppointmentSlots)[] = [
  "patientName",
  "phone",
  "department",
  "scheduledAt",
];

export interface PendingConfirmation {
  kind: "book_appointment" | "reschedule_appointment" | "cancel_appointment";
  payload: AppointmentSlots;
  promptedAt: number;
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

export interface ToolCallRecord {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  at: number;
}

export interface ConversationMemory {
  sessionId: string; // = session.callSid
  language: SupportedLanguage;
  languageLocked: boolean;

  activeIntent: Intent;
  previousIntents: Intent[];
  stage: string;
  conversationComplete: boolean;

  filledSlots: AppointmentSlots;
  slotConfidence: Record<string, number>;
  entities: Record<string, string | string[]>;

  conversationHistory: HistoryTurn[];
  conversationSummary?: string;
  lastAssistantQuestion?: string;
  retrievedChunks?: string[];

  pendingConfirmation?: PendingConfirmation;

  lastTool?: ToolCallRecord;
  lastToolResult?: unknown;
  lastAppointment?: AppointmentSlots & { appointmentId?: string };
}

export function createEmptyMemory(sessionId: string, language: SupportedLanguage): ConversationMemory {
  return {
    sessionId,
    language,
    languageLocked: false,
    activeIntent: "unknown",
    previousIntents: [],
    stage: "idle",
    conversationComplete: false,
    filledSlots: {},
    slotConfidence: {},
    entities: {},
    conversationHistory: [],
    lastTool: undefined,
    lastToolResult: undefined,
    lastAppointment: undefined,
  };
}

export function computeMissingSlots(slots: AppointmentSlots): (keyof AppointmentSlots)[] {
  return REQUIRED_FOR_BOOKING.filter((key) => !slots[key]);
}
