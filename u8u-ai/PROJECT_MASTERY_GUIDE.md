# Project Mastery Guide

## Purpose

This guide helps you learn the Hospital AI project from beginner to expert. It is structured as a progressive learning plan and maps the core code, architecture, and practical mastery tasks.

## Project Summary

The project is a hospital AI assistant platform combining:
- a Next.js dashboard and API backend
- Clerk authentication
- Prisma/PostgreSQL data storage
- Voice AI with Twilio and Exotel
- Deepgram speech-to-text
- Azure speech-to-text
- Groq-powered conversational AI
- appointment and lead management for hospitals

The project is built to handle inbound/outbound voice calls, chat conversations, CRM workflows, and appointment scheduling while tracking leads and call analytics.

## Learning Phases

### Phase 1 — Reverse Engineering

1. Read core files: `voice-server.ts`, `src/lib/voice/websocket-handler.ts`, `src/lib/voice/groq-brain.ts`, `src/lib/voice/deepgram-stt.ts`, `src/lib/voice/azure-tts.ts`, `prisma/schema.prisma`.
2. Trace imports and route calls.
3. Identify provider-specific differences for Twilio and Exotel.
4. Understand data persistence through Prisma models.

### Phase 2 — Beginner Foundation

Start by understanding:
- what the app does
- who uses it
- key concepts: voice call, webhook, streaming, STT, TTS, AI response
- how the UI communicates with the backend
- how the voice server is separate from Next.js

### Phase 3 — Execution Flow

Trace real examples:
- inbound call from phone to app
- outbound dialer job
- asynchronous voice streaming via WebSocket
- database record creation for conversations and appointments

### Phase 4 — File-level Mastery

For each critical file, learn:
- purpose
- main functions and classes
- dependencies
- callers and callees
- real-world meaning

### Phase 5 — Architecture Mastery

Learn the architectural decisions:
- why separate voice server exists
- why WebSocket is required for real-time audio
- why PostgreSQL + Prisma is used
- why Deepgram and Azure were selected
- why Groq is the AI brain

### Phase 6 — Interview Mastery

Prepare structured answers at every level:
- beginner
- intermediate
- senior
- architect

Practice answers for:
- voice AI systems
- WebSocket streaming
- multi-provider telephony
- real-time AI orchestration

### Phase 7 — System Design Mastery

Build a design story around scaling:
- 100,000 calls/day
- WebSocket server scaling
- STT/TTS costs and latency
- database performance and concurrency

### Phase 8 — Live Demo Training

Prepare a demo script:
- open architecture diagrams
- show a call flow
- explain backend API routes
- demonstrate voice logs and session state
- show database models and dashboard features

### Phase 9 — Voice AI Expert

Learn the internals:
- audio packet sizes
- mulaw vs linear16
- Deepgram realtime events
- Azure SDK streaming behavior
- barge-in detection
- buffer handling and silence padding

### Phase 10 — Production Engineering

Understand deployment and operations:
- running `voice-server.ts` on a VPS or container
- proxying via nginx/Cloudflare
- managing SSL and WebSocket URLs
- using pm2 or systemd
- monitoring and logging

### Phase 11 — Advanced Engineering

Master advanced patterns:
- async state management
- session lifecycle and cleanup
- retry and backoff
- memory usage in streaming apps
- provider abstraction and fallback

### Phase 12 — Ownership

Aim to know how to:
- explain any file
- fix call failures
- add a new provider or language
- extend AI behavior
- lead feature design and deployment

## Recommended Study Path

1. Read `PACKAGE.json` and `next.config.ts`.
2. Study the voice server and websocket handler.
3. Review API routes for voice and dialing.
4. Walk the Prisma schema.
5. Review `communications/index.ts` and provider adapters.
6. Read language detection and AI brain code.
7. Build a mental map of each flow.
8. Practice explaining each step.

## How to Use This Guide

- Follow sections in order.
- Use the companion docs for deep dives.
- Keep the code open and cross-check file paths.
- After reading, teach the project back in your own words.
- Practice with mock interview questions in `COMPLETE_INTERVIEW_PREP.md`.
