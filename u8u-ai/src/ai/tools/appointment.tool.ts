import { bookAppointment, rescheduleAppointment, cancelAppointment } from "../../services/appointment.service";
import type { Tool, ToolContext } from "./types";
import type { AppointmentSlots } from "../memory/types";

interface BookArgs {
  patientName: string;
  phone: string;
  department: string;
  scheduledAt: string; // ISO
  reason?: string;
}

interface RescheduleArgs {
  appointmentId?: string; // if omitted, uses memory.lastAppointment.appointmentId
  scheduledAt: string; // ISO
}

interface CancelArgs {
  appointmentId?: string;
}

/**
 * Same patient-then-department-then-appointment sequence that used to run
 * inline in websocket-handler.ts (the "CREATE REAL APPOINTMENT IN DATABASE"
 * block, previously gated on `session.step === "completed"`). Logic unchanged;
 * only extracted so it's reusable from the planner's tool calls and testable
 * on its own.
 */
async function createAppointment(args: BookArgs, ctx: ToolContext) {
  const { session } = ctx;

  if (!session.organizationId && !process.env.DEFAULT_ORGANIZATION_ID) {
    throw new Error("Missing organizationId — cannot save appointment");
  }
  const organizationId = session.organizationId || process.env.DEFAULT_ORGANIZATION_ID!;

  // Dedupe on (organizationId, phone) instead of always creating a new row —
  // the schema already has a unique constraint here that plain `.create()` would violate
  // on a repeat caller.
  const patient = await prisma.patient.upsert({
    where: { organizationId_phone: { organizationId, phone: args.phone } },
    update: { fullName: args.patientName },
    create: {
      organizationId,
      fullName: args.patientName,
      phone: args.phone,
    },
  });

  const department = await prisma.department.upsert({
    where: { organizationId_name: { organizationId, name: args.department } },
    update: {},
    create: { organizationId, name: args.department },
  });

  const appointment = await prisma.appointment.create({
    data: {
      organizationId,
      patientId: patient.id,
      departmentId: department.id,
      scheduledAt: new Date(args.scheduledAt),
      appointmentType: "OPD",
      status: "SCHEDULED",
      bookedVia: "VOICE_AI",
      notes: args.reason || session.fullTranscript,
    },
  });

  if (session.conversationId) {
    await prisma.conversation
      .update({
        where: { id: session.conversationId },
        data: { patientId: patient.id },
      })
      .catch(() => null);
  }

  return { patientId: patient.id, departmentId: department.id, appointment };
}

export const bookAppointmentTool: Tool<BookArgs> = {
  name: "book_appointment",
  description:
    "Book a new appointment once patientName, phone, department, and scheduledAt are all known and the patient has confirmed.",
  parameters: {
    type: "object",
    properties: {
      patientName: { type: "string", description: "Patient's full name" },
      phone: { type: "string", description: "10-digit mobile number" },
      department: { type: "string", description: "Department or specialty, e.g. Cardiology" },
      scheduledAt: { type: "string", description: "ISO 8601 date-time" },
      reason: { type: "string", description: "Reason for visit / symptoms, if mentioned" },
    },
    required: ["patientName", "phone", "department", "scheduledAt"],
  },
  execute: async (args, ctx) => {
    const result = await bookAppointment(args);

    if (result.success && result.appointmentId) {
      ctx.memory.lastAppointment = {
        patientName: args.patientName,
        phone: args.phone,
        department: args.department,
        scheduledAt: args.scheduledAt,
        appointmentId: result.appointmentId,
      };
      ctx.memory.pendingConfirmation = undefined;
    }

    return result;
  },
};

export const rescheduleAppointmentTool: Tool<RescheduleArgs> = {
  name: "reschedule_appointment",
  description: "Change the date/time of the patient's existing appointment.",
  parameters: {
    type: "object",
    properties: {
      appointmentId: { type: "string", description: "Appointment ID, if known" },
      scheduledAt: { type: "string", description: "New ISO 8601 date-time" },
    },
    required: ["scheduledAt"],
  },
  execute: async (args, ctx) => {
    const appointmentId = args.appointmentId || ctx.memory.lastAppointment?.appointmentId;
    if (!appointmentId) {
      return { success: false, error: "no_existing_appointment" };
    }

    const result = await rescheduleAppointment(appointmentId, args.scheduledAt);
    if (result.success) {
      if (ctx.memory.lastAppointment) {
        ctx.memory.lastAppointment.scheduledAt = args.scheduledAt;
      }
      ctx.memory.pendingConfirmation = undefined;
    }
    return result;
  },
};

export const cancelAppointmentTool: Tool<CancelArgs> = {
  name: "cancel_appointment",
  description: "Cancel the patient's existing appointment.",
  parameters: {
    type: "object",
    properties: {
      appointmentId: { type: "string", description: "Appointment ID, if known" },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    const appointmentId = args.appointmentId || ctx.memory.lastAppointment?.appointmentId;
    if (!appointmentId) {
      return { success: false, error: "no_existing_appointment" };
    }

    const result = await cancelAppointment(appointmentId);
    if (result.success) {
      ctx.memory.pendingConfirmation = undefined;
    }

    return result;
  },
};
