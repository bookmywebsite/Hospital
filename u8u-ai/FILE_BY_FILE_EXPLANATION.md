# File-by-File Explanation

This file explains the most important files in the Hospital AI project and why they exist.

## Root Files

### `package.json`
- Purpose: defines dependencies, scripts, and runtime behavior.
- Key features:
  - `dev`: run Next.js app
  - `voice:dev`: run standalone voice server
  - `dev:full`: run both app and voice server concurrently
- Why it matters: the voice server is separate from the Next.js app, and this file shows how the project is started.

### `next.config.ts`
- Purpose: configures Next.js behavior.
- Important details:
  - external image domains for Clerk auth assets
  - dev origins for ngrok / local testing
  - ignores build-time eslint/type errors
- Why it matters: indicates this app prioritizes deployability over strict build-time checks in CI.

### `prisma/schema.prisma`
- Purpose: defines the database schema.
- Contains core models: `Organization`, `Agent`, `Conversation`, `Lead`, `Patient`, `Appointment`, `CallQueue`, `Message`, `VoiceCall`.
- Why it matters: this is the data model for all CRM and voice operations.

## Voice Core Files

### `voice-server.ts`
- Purpose: standalone WebSocket server for real-time voice streaming.
- What it does:
  - starts HTTP server with health/metrics endpoints
  - starts `ws` server on `/media`
  - forwards connections to `handleWebSocketConnection`
- Importance: persistent WebSockets cannot run reliably on Vercel, so this must run separately in production.

### `src/lib/voice/websocket-handler.ts`
- Purpose: orchestrates streaming audio calls.
- Main responsibilities:
  - session initialization and lifecycle
  - STT buffering and audio routing
  - AI brain invocation
  - TTS streaming back to provider
  - barge-in detection and call closing
- Why it matters: this file is the heart of the voice AI pipeline.

### `src/lib/voice/groq-brain.ts`
- Purpose: runs AI prompt generation and responses.
- Contains:
  - `generateFiller()` for fast acknowledgements
  - `generateResponse()` for full replies
  - `classifyCall()` for lead scoring and summary after call end
- Why it matters: this is the conversational brain and it keeps phone responses short, safe, and medical.

### `src/lib/voice/deepgram-stt.ts`
- Purpose: manages Deepgram live transcription.
- Features:
  - live audio connection setup
  - sending audio chunks
  - event handling for transcripts, errors, and reconnects
  - support for language switching mid-call
- Why it matters: correct STT is the most critical part of the live voice path.

### `src/lib/voice/azure-tts.ts`
- Purpose: converts AI text to speech and streams it in provider-compatible chunks.
- Features:
  - supports `mulaw8k` for Twilio and `pcm16le8k` for Exotel
  - handles chunk pacing and flush behavior
  - retry logic and voice switching
- Why it matters: this file turns chat text into real audio that callers hear.

### `src/lib/voice/language-detection.ts`
- Purpose: detect caller language using Unicode and keyword heuristics.
- Supports: English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia.
- Why it matters: accurate language detection is essential to choosing the right STT and TTS languages.

## Telephony and Communication

### `src/lib/communications/index.ts`
- Purpose: provider abstraction between Twilio and Exotel.
- Functions:
  - `sendSMSMessage`
  - `sendWhatsAppMessage`
  - `makeOutboundCall`
  - `verifyIntegration`
- Why it matters: it hides provider-specific details from higher-level logic.

### `src/lib/twilio.ts`
- Purpose: Twilio helper functions for phone calls and messaging.
- Contains:
  - Twilio client initialization
  - phone formatting
  - greeting TwiML creation
  - AI prompt and outbound call helper functions
- Why it matters: this is the Twilio-specific implementation layer.

## Backend API Routes

### `src/app/api/voice/inbound/route.ts`
- Purpose: inbound call webhook for Twilio voice.
- What it does:
  - creates a conversation record
  - returns TwiML `<Connect><Stream>` to route call into WebSocket server
- Why it matters: this is the entry point for inbound voice.

### `src/app/api/twilio/voice/route.ts`
- Purpose: voice call webhook for Twilio inbound/outbound.
- What it does:
  - identifies agent, lead, and patient
  - creates conversation and call logs
  - returns greeting and Gather instructions if not streaming
- Why it matters: it bridges Twilio telephony with the app’s voice workflow.

### `src/app/api/twilio/voice-streaming/route.ts`
- Purpose: streaming Twilio Media Streams entrypoint.
- What it does:
  - builds TwiML to connect Twilio to WebSocket server
  - sets custom parameters for the session
- Why it matters: it enables low-latency, real-time voice AI calls.

### `src/app/api/voice/status/route.ts`
- Purpose: receives call status callbacks.
- What it does:
  - updates conversation status and call duration
- Why it matters: keeps CRM state accurate after call completion.

### `src/app/api/voice/outbound/connect/route.ts`
- Purpose: outbound call answer webhook.
- What it does:
  - sends TwiML to connect answered outbound call to the WebSocket stream
- Why it matters: it completes the outbound call streaming path.

### `src/app/api/dialer/process/route.ts`
- Purpose: cron endpoint to process outbound call queue.
- What it does:
  - dequeues queued calls
  - enforces maximum parallel calls
  - creates outbound provider call through `communications/index.ts`
- Why it matters: this is the outbound dialing scheduler.

## Application and Auth

### `src/middleware.ts`
- Purpose: Clerk middleware for protected routes.
- What it does:
  - allows public routes like `/sign-in`, `/api/twilio`, `/api/webhooks`
  - protects all other routes behind Clerk auth
- Why it matters: secures the dashboard while leaving telephony webhooks public.

### `src/lib/prisma.ts`
- Purpose: Prisma client singleton setup.
- What it does:
  - creates a shared Prisma client
  - reuses the client in development
  - disconnects gracefully in production
- Why it matters: it is the database access layer for all server code.

## Supporting Files

### `.env.example` / `.env.voice.example`
- Purpose: list required environment variables.
- Contains keys for:
  - PostgreSQL
  - Clerk
  - OpenAI / Groq
  - Twilio / Exotel
  - Deepgram
  - Azure Speech
- Why it matters: correct configuration is critical for production readiness.

### `README.md`
- Purpose: high-level project overview and setup.
- Why it matters: first-place developers look to understand the project.

## Note

Some files are legacy or conditional and may be used only in older voice modes. The main active voice path is the WebSocket-based streaming system in `voice-server.ts` and `src/lib/voice/websocket-handler.ts`.
