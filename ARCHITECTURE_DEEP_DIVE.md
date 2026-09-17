# Architecture Deep Dive

This document explains the Hospital AI system architecture and the reasoning behind design decisions.

## System Overview

The project is a hybrid architecture consisting of:
- a Next.js frontend and API backend
- a separate WebSocket voice server
- a PostgreSQL database
- telephony providers (Twilio, Exotel)
- AI and speech services (Groq, Deepgram, Azure Speech)

The architecture divides responsibilities into these layers:
- Presentation layer: React + Clerk UI
- API layer: Next.js route handlers
- Voice streaming layer: standalone WebSocket server
- Data layer: Prisma + PostgreSQL
- Integration layer: telephony, AI, STT, TTS

## Why Separate Voice Server?

### Reason
- Vercel and other serverless hosts do not support long-lived WebSocket connections reliably.
- Real-time voice calls require persistent connection, low latency, and continuous bidirectional audio.

### Benefits
- stable session lifecycle
- ability to use `ws` and custom audio packet handling
- easier debugging and metrics

### Tradeoffs
- additional deployment complexity
- separate hosting and monitoring
- need for secure cross-service configuration

## Why WebSocket?

### Reason
- voice media streams are continuous and require bidirectional low-latency transport.
- Twilio Media Streams and Exotel streaming both use WebSockets.

### Benefits
- real-time audio chunks
- immediate transcript and TTS turn-taking
- faster response than polling or gather loops

### Alternatives
- HTTP polling — too slow for voice
- pure TwiML `Gather`/`Say` loops — poor quality and delayed conversation
- WebRTC — more complex and unnecessary for PSTN streaming

## Why Deepgram?

- best suited for real-time streaming STT
- supports Indian languages and noisy telephony audio
- provides transcript events and confidence values
- can be configured with language-specific encoding

## Why Azure TTS?

- high-quality Indian regional voices
- supports raw audio streaming
- can produce `mulaw8k` and `pcm16le8k` from the same SDK
- offers stable, production-ready TTS

## Why Groq?

- modern LLM provider with multi-model support
- can run fast filler and full response pipelines in parallel
- supports custom prompt shaping and function-like tool definition
- fits the project’s need for safe hospital conversation logic

## Why Prisma + PostgreSQL?

- Prisma provides strong type-safe database access.
- PostgreSQL is reliable for relational healthcare CRM data.
- Prisma schema maps hospital-specific entities naturally.
- The project needs transaction-safe record creation for calls, appointments, leads.

## Event-Driven Architecture

The voice path follows an event-driven pattern:
- telephony event → WebSocket data event → STT transcript event → AI response event → TTS audio event → call end event

This style isolates state and makes the system resilient to partial failures.

## Session Management

`SessionState` in `websocket-handler.ts` holds live call data:
- provider and stream identifiers
- STT/TTS/AI instances
- buffers for inbound/outbound audio
- flags for speaking, barge-in, processing
- call metadata like leadId and conversationId

Session state is stored in `SESSION_MAP` and cleaned up during `endCall()`.

## State Management Patterns

### In-memory live state
- comfortable for active calls
- fast access to audio buffers and timers

### Persisted database state
- conversation history
- lead and patient updates
- call logs, appointment records
- call status and analytics

### Why both?
- live audio needs in-memory speed
- CRM records need persistence and analytics

## Real-time Architecture

### Key components
- `voice-server.ts`: WebSocket entrypoint
- `websocket-handler.ts`: real-time flow controller
- `deepgram-stt.ts`: speech transcription
- `azure-tts.ts`: voice synthesis
- `groq-brain.ts`: AI decision engine

### Data flow
- audio in → STT → text → AI → text → TTS → audio out
- transcript updates may also update session metadata
- on call end, summary generation writes to DB

## Telephony Architecture

### Twilio path
- TwiML `<Stream>` to WebSocket server
- Twilio sends `media`, `start`, `stop`, `mark`
- `audioChunk` size: 320 bytes (mulaw)
- `mark` events used for timing

### Exotel path
- WebSocket audio streaming to voice server
- audio format: `linear16` PCM16 at 8kHz
- required chunk size: 3200 bytes
- provider-specific `keepalive` and flush logic

## AI Orchestration

### Dual-brain model
- fast filler response for immediate acknowledgement
- parallel full response generation for actual answer

### Conversation history
- last N messages preserved in `GroqDualBrain`
- system prompt defines role and safe rules

### Call classification
- `classifyCall()` extracts sentiment and lead score after the call
- used to update conversation summary and lead state

## Scalability Considerations

### Bottlenecks
- voice server concurrency
- Deepgram connection limits
- Groq model latency
- Azure TTS throughput
- database write volume

### Scaling options
- horizontal voice servers behind load balancer
- dedicated STT/TTS worker pool
- Redis or queue for backpressure
- partition DB by organization

## Security and Production Concerns

- use Clerk for dashboard auth
- public telephony webhooks must be hardened if possible
- avoid exposing API keys in frontend
- use HTTPS and secure WebSocket URLs
- isolate voice server behind firewall if possible

## Summary

The project is designed for stable, real-time voice AI in healthcare. It uses a layered architecture with a separate voice streaming service, AI orchestration, database persistence, and telephony abstraction. The design choices favor latency, safety, and provider compatibility.
