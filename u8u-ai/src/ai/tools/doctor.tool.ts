import { searchDoctors } from "../../services/doctor.service";
import type { Tool, ToolContext } from "./types";

interface LookupDoctorArgs {
  department?: string;
  doctorName?: string;
  date?: string; // ISO date — filters by weekday availability
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const lookupDoctorTool: Tool<LookupDoctorArgs> = {
  name: "lookup_doctor",
  description:
    "Look up doctors by department or name, optionally filtered by availability on a given date. Use for 'which doctors do you have in Cardiology' or 'is Dr. Sharma available Thursday'.",
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
  execute: async (args, ctx: ToolContext) => {
    return await searchDoctors({
      department: args.department,
      doctorName: args.doctorName,
      date: args.date,
    });
  },
};
