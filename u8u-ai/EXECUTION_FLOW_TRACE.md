# Execution Flow Trace

This trace follows the exact runtime path for voice calls and core app workflows.

## 1. Startup Flow

### Web App Startup
- `npm install` installs dependencies.
- `npm run dev` starts Next.js.
- Next.js loads `src/app/layout.tsx` and route handlers lazily.
- `src/middleware.ts` applies Clerk auth to protected routes.
- `src/lib/prisma.ts` initializes Prisma client.

### Voice Server Startup
- `npm run voice:dev` executes `npx ts-node voice-server.ts`.
- `voice-server.ts` starts an HTTP server and a WebSocket server on `/media`.
- Incoming WebSocket connections are routed to `handleWebSocketConnection` in `src/lib/voice/websocket-handler.ts`.

## 2. Inbound Call Flow

1. Patient calls hospital number.
2. Twilio or Exotel sends webhook to a public API route.
3. The app route determines the provider and builds response.

### For Twilio Media Streams
- Call reaches `src/app/api/twilio/voice-streaming/route.ts`.
- It builds TwiML `<Connect><Stream url="${WSS}/media">`.
- Twilio opens a WebSocket to the voice server.

### For endpoint-based streaming
- Call reaches `src/app/api/voice/inbound/route.ts`.
- It creates a `Conversation` record in the database.
- It returns TwiML stream directives to connect to the WebSocket server.

4. Twilio begins sending media events over WebSocket.

## 3. WebSocket Connection Flow

1. `voice-server.ts` accepts the WebSocket connection.
2. `handleWebSocketConnection()` attaches event listeners.
3. Each socket `message` is processed by `handleWebSocketMessage()`.

Key event types:
- `start`: call session initialization
- `media`: inbound audio data
- `stop`: call ended
- `mark`: playback and provider event acknowledgements

## 4. Session Initialization (`start` event)

`handleWebSocketMessage()` identifies `streamSid` and provider.

`initializeSession()` creates `SessionState` containing:
- `ws`, `sessionId`, `callSid`
- `organizationId`, `language`, `provider`
- `stt`, `tts`, `brain` placeholders
- `audioQueue`, `exotelOutBuffer`, state flags

It also recovers orphan audio if audio arrived before `start`.

Then it initializes:
- `DeepgramLiveSTT` instance
- `AzureLiveTTS` instance
- `GroqDualBrain` instance

It starts Deepgram STT with `stt.start()`.

For Exotel, it also starts keep-alive marks.

It creates a `Conversation` record in the database if one does not exist.

## 5. Audio Flow (`media` event)

1. Incoming `media` payload is base64 decoded.
2. The handler buffers audio if STT is not ready.
3. When ready, it appends to `exotelInBuffer`.
4. It slices out fixed frame sizes:
   - `320` bytes for Twilio `mulaw`
   - `640` bytes for Exotel `linear16`
5. It calls `stt.sendAudio(chunk)`.

Key behavior:
- If the bot is speaking and not barge-in, audio is queued.
- If the caller interrupts, barge-in detection is triggered.

## 6. STT and Transcript Handling

`DeepgramLiveSTT`:
- opens a live connection with Deepgram
- listens for `Open`, `Transcript`, `Error`, `Close`
- sends audio via `connection.send()`
- emits transcripts to `onTranscript`

On each transcript event:
- if `isFinal`, `processUserSpeech()` is called
- the handler logs transcript and confidence
- barge-in detection may trigger if caller speaks while agent is still speaking

## 7. AI Brain Flow

`processUserSpeech()`:
- extracts contact info and appointment hints from the text
- updates `session.appointmentData`, `contactEmail`, `contactName`
- may store phone/email into leads
- runs `session.brain.generateResponse(transcript)`
- runs `session.brain.generateFiller(transcript)` in parallel

`GroqDualBrain` does:
- quick filler response with `llama-3.1-8b-instant`
- full answer with `llama-3.1-8b-instant`
- emergency detection and safe medical rules

The AI response is typically:
- short and conversational
- hospital-focused
- compliant with medical safety rules

## 8. TTS Flow

`AzureLiveTTS.speak()`:
- initializes Azure speech synthesizer
- streams audio chunks as they are synthesized
- buffers and chunks audio to provider-specific sizes
- sends audio to the provider via `sendAudioToProvider()`

Provider behavior:
- Twilio expects 20ms / 320 byte `mulaw` packets
- Exotel expects 100ms / 3200 byte `pcm16le8k` packets

After TTS finishes:
- `waitForExotelFlush()` waits for Exotel buffers to drain
- `sendMarkToProvider(session, 'response-complete')` notifies provider

## 9. Call Ending Flow

`stop` event or socket close triggers `endCall(session)`:
- clears timers
- stops `DeepgramLiveSTT`
- closes `AzureLiveTTS`
- flushes Exotel outbound buffer
- generates call analysis with `brain.classifyCall()`
- updates `Conversation` with `status`, `summary`, `sentiment`, `endedAt`
- updates leads and patient records
- removes the session from `SESSION_MAP`

## 10. Outbound Dialer Flow

1. `src/app/api/dialer/process/route.ts` is called by cron.
2. It validates calling hours and concurrency.
3. It selects queued `CallQueue` items.
4. It calls `makeOutboundCall()` from `src/lib/communications/index.ts`.
5. The provider creates an outbound call to the target number.
6. When answered, Twilio hits `src/app/api/voice/outbound/connect/route.ts`.
7. That route connects the call to the WebSocket server.

## 11. Database Objects in Flow

Key records:
- `Conversation`: active voice/chat session
- `Lead` / `Patient`: contact records
- `CallQueue`: outbound dialer queue
- `CallLog`: call event history
- `Appointment`: booked appointments
- `Message`: saved chat or voice transcripts

Call creation path:
- inbound: create `Conversation`, optionally `Lead`/`Patient`
- outbound: update `CallQueue` and `CallLog`
- during call: save transcripts in `Conversation` and `Message`
- end call: update `Conversation.status` and lead scoring

## 12. Summary

The execution flow is a chain of events from telephony provider → API webhook → voice WebSocket → STT → AI → TTS → provider. The app maintains state in `SessionState`, persists records in Prisma, and uses a dedicated voice server to host the persistent streaming layer.
