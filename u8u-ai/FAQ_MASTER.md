# FAQ Master for Hospital AI

This FAQ summarizes key questions and answers for the project.

## General

Q: What is this project?
A: A hospital voice automation system combining a Next.js dashboard, real-time voice streaming, AI-driven responses, and telephony integration to automate patient calls.

Q: Which telephony providers are supported?
A: Twilio and Exotel.

Q: Why is there a separate voice server?
A: Because long-lived WebSocket audio connections need a persistent server, which serverless platforms often do not support reliably.

Q: What language and frameworks are used?
A: TypeScript, Next.js, React, Tailwind CSS, Prisma, WebSocket, and Node.js.

## Voice and AI

Q: How does the live voice call work?
A: Caller audio arrives via telephony provider, is streamed to a WebSocket voice server, transcribed with Deepgram, passed to Groq for AI response, and spoken back through Azure TTS.

Q: How does the system avoid long voice latency?
A: It uses a dual-brain response strategy: a fast filler response for immediate feedback and a longer full response delivered after AI generation.

Q: How are interruptions handled?
A: The system detects caller speech during bot playback and uses barge-in logic to pause/clear audio and process the new user input.

Q: Does it support multiple languages?
A: Yes, the system can detect and switch languages for Indian regional languages via `language-detection.ts` and STT/TTS configuration.

Q: How does the AI avoid giving wrong medical advice?
A: The AI is instructed to be cautious, escalate emergencies, avoid diagnoses, and pass complex questions to human staff.

## Telephony

Q: How does Twilio integration work?
A: Twilio uses `MediaStreams` to send call audio to the voice server and receives audio back as TTS through TwiML.

Q: How does Exotel integration work?
A: Exotel connects to the voice server through a WebSocket endpoint and streams raw PCM audio while receiving synthesized audio chunks.

Q: What if the provider sends unsupported audio format?
A: The voice server expects `mulaw8k` for Twilio and `pcm16le8k` for Exotel. Mismatched encoding will break STT/TTS handling.

## Database and CRM

Q: What data is stored in the database?
A: Leads, patients, appointments, conversations, treatments, departments, users, and voice call summaries.

Q: What ORM is used?
A: Prisma.

Q: How are conversations classified?
A: After call end, the AI classifies the call and updates conversation analytics and lead status.

## Deployment

Q: Can this run in production?
A: Yes, with a public web app host for the dashboard and a dedicated voice server with WSS support.

Q: What environment variables are required?
A: Database credentials, Clerk keys, Deepgram, Azure Speech, Groq, Twilio, Exotel, voice server URL, and app URL.

Q: Can the web app and voice server run on the same host?
A: They can run on the same machine if the host supports multiple ports and process management, but they are logically separated.

## Failures and debugging

Q: Call audio is not reaching the server. What do I check?
A: Verify `VOICE_WS_SERVER_URL`, webhook URLs, public access, and websocket upgrades.

Q: Transcripts are empty. What do I check?
A: Deepgram API key, audio packet format, STT readiness, and Deepgram connection logs.

Q: AI response is not spoken back.
A: Check Azure Speech credentials, provider audio queueing, and the TTS output format.

Q: Why are appointments not created?
A: Check session metadata extraction, appointment field parsing, and DB write permissions.

## Security

Q: Is patient data safe?
A: The system uses secure services and must be deployed with HTTPS/WSS, secure env vars, and database protections.

Q: Are webhooks protected?
A: Public webhooks should be restricted if possible, but the app relies on correct route configuration and secure telephony provider settings.

Q: How is auth handled for the dashboard?
A: Clerk authentication wraps protected pages and APIs, with middleware protecting routes.

## Extensibility

Q: Can we add more providers?
A: Yes, provider abstraction in `src/lib/communications/index.ts` makes it possible to add new telephony adapters.

Q: Can this support SMS follow-ups?
A: Yes, the platform already includes SMS/WhatsApp modules and can be extended for SMS confirmations.

Q: Can we add human handoff?
A: Yes, by adding explicit transfer logic in the voice flow and connecting calls to live agents.

## Summary

This FAQ covers the most important aspects of the Hospital AI system: architecture, live voice flow, telephony integration, database storage, deployment, and common failure modes. Use this as a quick reference for understanding and explaining the project.
