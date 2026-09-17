export class ResponseGenerator {
    async generate(decision, memory, hospitalName) {
        if (decision.say) {
            return decision.say;
        }
        return "Okay, let's help with that.";
    }
}
let rgInstance = null;
export function getResponseGenerator() {
    if (!rgInstance) {
        rgInstance = new ResponseGenerator();
    }
    return rgInstance;
}
