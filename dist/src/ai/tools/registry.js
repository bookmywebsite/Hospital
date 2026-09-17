import { bookAppointmentTool, rescheduleAppointmentTool, cancelAppointmentTool } from "./appointment.tool";
import { lookupDoctorTool } from "./doctor.tool";
import { transferToReceptionTool, transferToEmergencyTool } from "./transfer.tool";
import { hospitalFaqLookupTool } from "./hospital-faq.tool";
export const toolRegistry = {
    [bookAppointmentTool.name]: bookAppointmentTool,
    [rescheduleAppointmentTool.name]: rescheduleAppointmentTool,
    [cancelAppointmentTool.name]: cancelAppointmentTool,
    [lookupDoctorTool.name]: lookupDoctorTool,
    [transferToReceptionTool.name]: transferToReceptionTool,
    [transferToEmergencyTool.name]: transferToEmergencyTool,
    [hospitalFaqLookupTool.name]: hospitalFaqLookupTool,
};
/** Groq's `tools` array shape — bind every registered tool to every planner call. */
export function getToolDefinitionsForGroq() {
    return Object.values(toolRegistry).map((tool) => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        },
    }));
}
/**
 * Adding a new hospital service tool (billing, lab reports, etc.) means adding
 * one file + one line here — the planner never changes, matching the goal in
 * the original migration request.
 */
export function getTool(name) {
    return toolRegistry[name];
}
