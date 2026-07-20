import { bookAppointment, rescheduleAppointment, cancelAppointment } from "../../services/appointment.service";
import type { Tool, ToolContext } from "./types";
import type { AppointmentSlots } from "../memory/types";
import { prisma } from "../../lib/prisma";

interface BookArgs extends AppointmentSlots {
  patientName: string;
  phone: string;
  department: string;
  scheduledAt: string; // ISO
  email?: string;
}

interface RescheduleArgs {
  appointmentId?: string; // if omitted, uses memory.lastAppointment.appointmentId
  scheduledAt: string; // ISO
}

interface CancelArgs {
  appointmentId?: string;
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
      email: { type: "string", description: "Patient's email address, if mentioned" },
    },
    required: ["patientName", "phone", "department", "scheduledAt"],
  },
  execute: async (args, ctx) => {
    const result = await bookAppointment(args, ctx.session.organizationId, {
      language: ctx.session.language,
    });

    if (result.success && result.appointmentId) {
      ctx.memory.lastAppointment = {
        patientName: args.patientName,
        phone: args.phone,
        department: args.department,
        scheduledAt: args.scheduledAt,
        email: args.email,
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
