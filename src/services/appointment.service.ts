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

// export async function bookAppointment(payload: AppointmentSlots): Promise<BookAppointmentResult> {
//   const { patientName, phone, department, scheduledAt, reason } = payload;
export async function bookAppointment(
  payload: AppointmentSlots,
  organizationId?: string,
  options?: { language?: string },
): Promise<BookAppointmentResult> {
  const { patientName, phone, department, scheduledAt, reason, email } = payload;

  if (!patientName || !phone || !department || !scheduledAt) {
    return { success: false, error: "missing_required_fields" };
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return {
      success: false,
      error: "invalid_phone",
    };
  }
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "invalid_email" };
  }
  const orgId = organizationId || process.env.DEFAULT_ORGANIZATION_ID;
  if (!orgId) {
    return { success: false, error: "missing_organization_id" };
  }
  const appointmentDate = new Date(scheduledAt);

  if (Number.isNaN(appointmentDate.getTime())) {
    return {
      success: false,
      error: "invalid_date",
    };
  }
  const preferredLanguage = options?.language?.split("-")[0]?.toUpperCase();
  try{
  return await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.upsert({
      where: { organizationId_phone: { organizationId: orgId, phone } },
      update: {
        fullName: patientName || undefined,
        email: email || undefined,
        preferredLanguage: preferredLanguage || undefined,
      },
      create: {
        organizationId: orgId,
        fullName: patientName,
        phone,
        email: email || null,
        preferredLanguage: preferredLanguage || "EN",
        source: "VOICE_AI",
      },
    });
    const normalizedDepartment = department
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const departmentRecord = await tx.department.upsert({
      where: { organizationId_name: { organizationId: orgId, name: normalizedDepartment } },
      update: {},
      create: { organizationId: orgId, name: normalizedDepartment },
    });
    const existing = await tx.appointment.findFirst({
      where: {
        patientId: patient.id,
        scheduledAt: appointmentDate,
        status: {
          not: "CANCELLED",
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: "duplicate_appointment",
      };
    }
    const appointment = await tx.appointment.create({
      data: {
        organizationId: orgId,
        patientId: patient.id,
        departmentId: departmentRecord.id,
        scheduledAt: appointmentDate,
        appointmentType: "OPD",
        status: "SCHEDULED",
        bookedVia: "VOICE_AI",
        notes: reason ?? undefined,
      },
    });

    return { success: true, appointmentId: appointment.id };
  });
}
  catch(err){

console.error(err);

return{

success:false,

error:"database_error"

};
}
}
export async function rescheduleAppointment(
  appointmentId: string,
  scheduledAt: string,
): Promise<RescheduleAppointmentResult> {
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