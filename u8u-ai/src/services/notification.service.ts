import { prisma } from "../lib/prisma";

export async function sendSms(phone: string, message: string) {
  // Placeholder: implement real SMS provider integration.
  console.log("[Notification] sendSms", phone, message);
  return { success: true };
}

export async function sendEmail(email: string, subject: string, body: string) {
  // Placeholder: implement real email provider integration.
  console.log("[Notification] sendEmail", email, subject, body);
  return { success: true };
}
