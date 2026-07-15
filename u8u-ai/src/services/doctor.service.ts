import { prisma } from "../lib/prisma";

interface DoctorSearchArgs {
  department?: string;
  doctorName?: string;
  date?: string;
}

export async function searchDoctors(args: DoctorSearchArgs) {
  const organizationId = process.env.DEFAULT_ORGANIZATION_ID;
  if (!organizationId) {
    throw new Error("Missing organization ID");
  }

  const doctors = await prisma.doctor.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(args.department ? { department: { name: { equals: args.department, mode: "insensitive" } } } : {}),
      ...(args.doctorName ? { name: { contains: args.doctorName, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      name: true,
      specialization: true,
      availability: true,
      department: { select: { name: true } },
    },
    take: 10,
  });

  if (!args.date) {
    return { doctors };
  }

  const dayName = new Date(args.date).toLocaleDateString("en-US", { weekday: "long" });
  const available = doctors.filter((doctor) => {
    if (!doctor.availability || typeof doctor.availability !== "object") return true;
    const avail = doctor.availability as Record<string, { isAvailable?: boolean }>;
    return avail[dayName]?.isAvailable !== false;
  });

  return { doctors: available, filteredBy: dayName };
}
