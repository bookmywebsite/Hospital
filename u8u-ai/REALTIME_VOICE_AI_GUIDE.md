# Real-Time Voice AI Guide

This guide explains the voice AI internals in detail, including audio flow, WebSocket events, and service behavior.

## Why Real-Time Voice AI?

The project converts phone calls into an AI conversation in real time. That means:
- caller speech is transcribed immediately
- the AI responds quickly
- responses are converted to audio and played back live

This is more complex than chat because it requires continuous streaming and low latency.

## Core Components

### `voice-server.ts`
- hosts WebSocket server on `/media`
- receives streaming media from telephony providers
- forwards WebSocket messages to `handleWebSocketConnection`

### `websocket-handler.ts`
- main controller for live call sessions
- receives events: `start`, `media`, `stop`, `mark`
- manages state and buffers
- launches STT, AI, and TTS pipelines

### `deepgram-stt.ts`
- live transcription engine for inbound audio
- handles connection, keepalive, reconnection
- converts audio chunks into transcripts

### `azure-tts.ts`
- synthesis engine for outgoing AI speech
- streams audio chunks to Twilio/Exotel
- ensures proper packet pacing and size

### `groq-brain.ts`
- conversational AI engine
- generates immediate ‘filler’ and full answer
- classifies call after completion

## Audio Encoding and Packet Flow

### Twilio audio format
- uses `mulaw8k`
- packet target: 320 bytes
- every packet is ~40ms of audio
- reason: Twilio Media Streams frames are 8kHz mu-law

### Exotel audio format
- uses `linear16` PCM16 at 8kHz
- packet target: 640 bytes for STT input
- outgoing chunk target: 3200 bytes for 100ms of audio
- reason: Exotel expects raw PCM frames with minimum sizes

### Buffering Strategy
- new audio is appended to `session.exotelInBuffer`
- buffer is sliced into fixed-size frames before STT
- if STT is not ready, audio is queued in `session.audioQueue`

### Loop prevention
- while bot speaks, caller audio is queued instead of immediately processed
- if caller interrupts with a strong transcript, barge-in is detected
- barge-in stops the current TTS and processes the caller speech immediately

## WebSocket Events

### `start`
- initializes session state
- sets `provider`, `language`, `agentId`, `organizationId`
- starts Deepgram STT and Azure TTS
- optionally creates a `Conversation` record

### `media`
- carries base64 audio payload
- decoded buffer is either queued or sent to STT
- Twilio and Exotel use different payload fields and event keys

### `stop`
- call is ending
- triggers `endCall()` cleanup
- stops STT/TTS, flushes buffers, writes analysis

### `mark`
- provider acknowledges playback progress or response end
- `response-complete` means AI audio finished playing

## STT Pipeline

### Connection lifecycle
- `DeepgramLiveSTT.start()` opens Deepgram live connection
- on `Open`, it sets `sttReady = true`
- keepalive interval calls `connection.keepAlive()` every 8 seconds
- on failure, it schedules exponential backoff reconnects

### Transcript processing
- `LiveTranscriptionEvents.Transcript` events deliver text
- handler distinguishes `isFinal` or `speech_final`
- final transcript triggers `processUserSpeech()`

### Language switching
- `changeLanguage()` can stop STT and reopen with a new language
- audio is buffered while switching
- voice language is locked after repeated confident detections

## AI Pipeline

### Conversation and intent
- `processUserSpeech()` extracts contact email, name, appointment hints, intent
- appointment-related fields are stored in session state
- language detection may change the session language

### Dual-brain response
- `generateFiller()` produces a fast acknowledgement
- `generateResponse()` produces the actual answer
- filler is spoken first while the full response is generated
- this reduces perceived latency for callers

### Emergency detection
- both `groq-brain.ts` and `language-detection.ts` detect emergencies
- if emergency keywords are present, the system responds with urgent guidance and may require human transfer

## TTS Pipeline

### Streaming TTS
- `AzureLiveTTS.speak(text)` starts synthesis
- Azure emits `synthesizing` audio data events
- audio is buffered into `audioQueue`
- chunks are sent to provider at a steady pace

### Provider-specific behavior
- Twilio: 20ms pacing and `mulaw8k` chunks
- Exotel: 100ms pacing and `pcm16le8k` chunks
- Exotel requires padding to meet minimum chunk sized and alignment

### Failure handling
- TTS retries on websocket not ready errors
- if errors occur, the call continues gracefully when possible

## Barge-in Detection

### How it works
- if caller speech arrives while agent is speaking
- high-confidence final transcript triggers `bargeInDetected`
- current bot TTS may be cleared with `clearProviderAudio()`
- user speech is processed immediately

### Why it matters
- live voice systems must handle interruptions naturally
- without it, callers feel cut off or ignored

## Call Cleanup

### `endCall()` tasks
- stop STT and TTS
- cancel `heartbeatTimer`, `silenceTimer`, `sttWatchdogTimer`
- flush the outbound Exotel buffer
- call `brain.classifyCall()` for lead scoring and summary
- update `Conversation` status to `CLOSED`
- update leads and appointment states
- remove session from memory map

## Practical Notes

### Service URLs
- `VOICE_WS_SERVER_URL` points to the live voice server
- webhooks in Twilio/Exotel must use public HTTPS URLs
- `VOICE_AI_BASE_URL` is used for phone-facing callback links

### Environment variables
- `DEEPGRAM_API_KEY`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `GROQ_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `EXOTEL_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_VIRTUAL_NUMBER`

## Summary

Real-time voice AI in this project is built around a dedicated WebSocket voice server. The system handles audio encoding, STT, AI generation, TTS streaming, and provider-specific packet requirements. The live pipeline is event-driven and resilient thanks to buffering, barge-in detection, and separate session state.
