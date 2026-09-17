import { prisma } from "../../lib/prisma";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const lookupDoctorTool = {
    name: "lookup_doctor",
    description: "Look up doctors by department or name, optionally filtered by availability on a given date. Use for 'which doctors do you have in Cardiology' or 'is Dr. Sharma available Thursday'.",
    parameters: {
    type: "object",

    properties: {

        department: {
            type: "string",
            description: "Department name"
        },

        doctorName: {
            type: "string",
            description: "Doctor name"
        },

        date: {
            type: "string",
            description: "ISO date"
        },

    },

    additionalProperties: false,

},
    execute: async (args, ctx) => {
        const { session } = ctx;
        const organizationId = session.organizationId || process.env.DEFAULT_ORGANIZATION_ID;
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
        const dayName = DAY_NAMES[new Date(args.date).getDay()];
        const available = doctors.filter((doctor) => {
            if (!doctor.availability || typeof doctor.availability !== "object")
                return true;
            const avail = doctor.availability;
            const dayAvail = avail[dayName];
            return dayAvail?.isAvailable !== false;
        });
        return { doctors: available, filteredBy: dayName };
    },
};
