import { prisma } from "../lib/prisma";
import type { AppointmentSlots } from "../ai/memory/types";

interface BookAppointmentResult {
  success: boolean;
  appointmentId?: string;
  error?: string;
}

interface RescheduleAppointmentResult {
  success: boolean;
  appointmentId?: string;
  error?: string;
}

interface CancelAppointmentResult {
  success: boolean;
  appointmentId?: string;
  error?: string;
}

export async function bookAppointment(payload: AppointmentSlots): Promise<BookAppointmentResult> {
  const { patientName, phone, department, scheduledAt, reason } = payload;

  if (!patientName || !phone || !department || !scheduledAt) {
    return { success: false, error: "missing_required_fields" };
  }

  const organizationId = process.env.DEFAULT_ORGANIZATION_ID;
  if (!organizationId) {
    return { success: false, error: "missing_organization_id" };
  }

  const patient = await prisma.patient.upsert({
    where: { organizationId_phone: { organizationId, phone } },
    update: { fullName: patientName || undefined },
    create: { organizationId, fullName: patientName, phone },
  });

  const departmentRecord = await prisma.department.upsert({
    where: { organizationId_name: { organizationId, name: department } },
    update: {},
    create: { organizationId, name: department },
  });

  const appointment = await prisma.appointment.create({
    data: {
      organizationId,
      patientId: patient.id,
      departmentId: departmentRecord.id,
      scheduledAt: new Date(scheduledAt),
      appointmentType: "OPD",
      status: "SCHEDULED",
      bookedVia: "VOICE_AI",
      notes: reason ?? undefined,
    },
  });

  return { success: true, appointmentId: appointment.id };
}

export async function rescheduleAppointment(appointmentId: string, scheduledAt: string): Promise<RescheduleAppointmentResult> {
  if (!appointmentId || !scheduledAt) {
    return { success: false, error: "missing_required_fields" };
  }

  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { scheduledAt: new Date(scheduledAt), status: "RESCHEDULED" },
  });

  return { success: true, appointmentId: appointment.id };
}

export async function cancelAppointment(appointmentId: string): Promise<CancelAppointmentResult> {
  if (!appointmentId) {
    return { success: false, error: "missing_required_fields" };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED" },
  });

  return { success: true, appointmentId };
}
