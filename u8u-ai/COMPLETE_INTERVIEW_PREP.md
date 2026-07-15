# Complete Interview Preparation for Hospital AI

This document prepares you to explain, defend, and extend the Hospital AI system.

## Key Concepts to Master

### Architecture
- hybrid Next.js app + standalone voice WebSocket server
- PRS: presentation, request, state, streaming
- why real-time WebSocket is needed for telephony audio
- separation of concern between dashboard APIs and voice session handling

### Core services
- Clerk for authentication
- Prisma with PostgreSQL for CRM data
- Twilio / Exotel for inbound/outbound telephony
- Deepgram for STT
- Azure Speech for TTS
- Groq for conversational AI and classification

### Data flow
- inbound call arrives at telephony provider
- provider sends audio to Next.js or directly to voice server
- voice server transcribes, classifies, generates response, and streams back audio
- database stores conversations, leads, appointments, and call logs

## System Design Questions

### 1. Why a separate voice server?
- serverless hosts cannot keep reliable, long-lived WebSocket connections
- telephony streams require low-latency, bidirectional audio
- isolating voice logic reduces risk to the web app and avoids timeouts

### 2. How does the system support multiple providers?
- provider abstraction in `src/lib/communications/index.ts`
- Twilio uses TwiML `<Stream>` with mu-law audio
- Exotel uses raw PCM audio over WebSocket
- both providers are normalized to the same AI and STT flow

### 3. How is real-time speech handled?
- Deepgram live transcription receives audio chunks in near real time
- transcripts are processed when `speech_final` arrives
- AI generates filler and full responses in parallel to avoid latency
- Azure TTS streams audio back to callers in provider-compatible chunks

### 4. How do you handle interruptions?
- barge-in detection pauses or clears the bot audio when the caller speaks
- `clearProviderAudio()` removes current output from provider playback
- the system waits for a stable final transcript before switching to caller input

## Deep Technical Questions

### 1. Describe `SessionState` and live state lifecycle.
- stored in `SESSION_MAP` keyed by `sessionId`
- contains provider metadata, audio buffers, timers, AI/STT instances, lead/patient info
- session starts on `start` event and ends on `stop`
- on cleanup, `endCall()` writes summaries and closes all resources

### 2. Explain the role of `groq-brain.ts`.
- builds two prompts: filler and full response
- uses Groq SDK with `assistant` and `tool` style message definitions
- generates a safe AI answer and classifies calls for outcome scoring

### 3. What is the database schema’s focus?
- hospital CRM with leads, patients, appointments, treatments, and conversations
- voice-related models: `Conversation`, `Appointment`, `Lead`, `Organization`, `User`
- persistent analytics for call outcomes and agent state

## Behavioral / Product Questions

### 1. Why use AI in hospital calls?
- to answer routine patient questions automatically
- to book appointments through voice
- to screen and qualify leads before human handoff
- to support 24/7 engagement with minimal staffing overhead

### 2. What are the safety concerns?
- medical advice must be handled carefully
- avoid giving definitive diagnoses
- provide escalation to a human for emergencies
- ensure patient data is secured in transit and at rest

### 3. How would you improve this system?
- add a human transfer path for complex cases
- augment with explicit appointment confirmation and SMS follow-up
- implement a Redis-backed session store for horizontal scaling
- add monitoring and alerting for voice server health and API errors

## Practice Answers

### Explain the voice workflow in 90 seconds.
The system uses a separate WebSocket voice server to receive live audio from Twilio or Exotel. Inbound caller audio is sent to Deepgram for transcription, then to Groq for AI response generation. The AI answer is streamed as audio back through Azure Speech, while the call is tracked in PostgreSQL through Prisma. This architecture keeps low-latency voice streaming separate from the dashboard and webhook handling.

### How is appointment booking automated?
The voice session extracts appointment hints from transcripts and session metadata. If the call identifies a patient name, preferred date/time, or department, it can create an `Appointment` record and update the lead or patient. The AI is prompted to ask necessary appointment scheduling questions.

### What makes this system production-ready?
Key strengths are the provider-agnostic telephony abstraction, real-time voice server for WebSocket streaming, typed Prisma ORM, and separation of responsibilities. The system also includes emergency detection, session tracking, and lead classification to ensure call quality.

## Mock Interview Questions

1. How would you handle a telephony provider outage?
2. What would you change to support voice multitenancy harder?
3. Explain how the system handles multilingual callers.
4. What are the main failure points in the live voice path?
5. How does the system ensure transcripts are accurate enough?
6. Describe the difference between the web app and the voice server.
7. How would you secure the voice server?
8. If call latency is high, where do you investigate first?
9. How does the AI avoid giving wrong medical advice?
10. How would you add callback/sms confirmation after an appointment is booked?

## Cheat Sheet

### Critical files
- `voice-server.ts`
- `src/lib/voice/websocket-handler.ts`
- `src/lib/voice/deepgram-stt.ts`
- `src/lib/voice/azure-tts.ts`
- `src/lib/voice/groq-brain.ts`
- `src/lib/communications/index.ts`
- `src/app/api/twilio/voice-streaming/route.ts`
- `src/app/api/exotel/voicebot/wss/route.ts`
- `prisma/schema.prisma`

### Important flows
- inbound Twilio call → `/api/twilio/voice-streaming`
- outbound dialer → `/api/dialer/process/route.ts`
- Exotel voice bot → `/api/exotel/voicebot/wss`
- voice WebSocket connect → `handleWebSocketConnection`
- call end → `endCall()` + DB writes

## Summary

This preparation document helps you talk through the Hospital AI system confidently. Focus on the split between web APIs and real-time voice streaming, the telephony provider abstraction, AI orchestration, and the database-backed CRM model.
