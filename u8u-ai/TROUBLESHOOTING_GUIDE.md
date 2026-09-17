# Troubleshooting Guide for Hospital AI

This guide helps diagnose common issues in the Hospital AI project.

## General Troubleshooting Steps

1. confirm environment variables are loaded correctly
2. verify the database is reachable
3. ensure the voice server is running and public
4. check telephony webhook URLs
5. inspect logs on both web app and voice server

## Common Issues and Fixes

### 1. Voice server not reachable
Symptoms:
- Twilio/Exotel cannot connect
- calls do not progress

Fix:
- confirm `VOICE_WS_SERVER_URL` uses `wss://` or `https://`
- ensure the server listens on the correct port
- verify DNS and firewall rules
- if behind a reverse proxy, ensure websocket upgrade headers pass through

### 2. STT not working
Symptoms:
- no transcripts appear
- Deepgram connection fails

Fix:
- check `DEEPGRAM_API_KEY`
- review voice server logs for Deepgram connection errors
- ensure the provider audio format matches expected `mulaw8k` or `pcm16le8k`
- verify network access to `api.deepgram.com`

### 3. TTS fails or no audio plays
Symptoms:
- AI response generated but caller does not hear it
- Azure errors appear

Fix:
- check `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`
- confirm audio chunk sizes and encoding match provider requirements
- review `azure-tts.ts` for chunk pacing and buffer flush issues
- verify the voice provider can accept the output format

### 4. Calls hang or never end
Symptoms:
- session remains open
- `stop` event not handled

Fix:
- confirm telephony provider sends a proper `stop` event
- inspect `endCall()` path in `websocket-handler.ts`
- make sure `session` timers are cleared on cleanup
- check for unhandled promise rejections during `endCall()`

### 5. Barge-in not working
Symptoms:
- caller interruptions ignored
- bot keeps speaking

Fix:
- verify `isBotSpeaking` and `pendingResponseId` logic
- confirm `final transcript` is delivered before interruption handling
- ensure `clearProviderAudio()` is called for the provider in use

### 6. Appointment creation fails
Symptoms:
- AI asks booking questions but no record created

Fix:
- inspect session metadata extraction in `processUserSpeech()`
- verify database permissions and `prisma` schema
- check whether `appointmentDate` or `department` fields are missing
- review `createAppointment` logic for errors

### 7. Telephony provider mismatch
Symptoms:
- Twilio works but Exotel does not or vice versa

Fix:
- validate provider-specific audio formats
- ensure the correct `provider` value is set in session state
- use separate event handlers for Twilio and Exotel paths
- confirm the webhook/flow is invoking the right route

### 8. DB write failures
Symptoms:
- conversations or leads not saved
- Prisma errors in logs

Fix:
- inspect `DATABASE_URL` and migration status
- run `npx prisma migrate deploy`
- verify `prisma` client initialization in `src/lib/prisma.ts`
- check for wrong `organizationId` or missing foreign keys

### 9. Webhook configuration problems
Symptoms:
- Twilio/Exotel return 404 or invalid response

Fix:
- ensure endpoints exist in the deployed app
- test with a browser or `curl`
- confirm route file structure matches the configured path
- verify auth or middleware is not blocking webhook requests

### 10. Authentication or Clerk issues
Symptoms:
- dashboard login fails
- public routes inaccessible

Fix:
- check Clerk keys and frontend publishable key
- verify `middleware.ts` only protects intended routes
- confirm `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is exposed to the browser

## Debugging Tools

### Logs
- web app console
- voice server console
- Twilio call logs and debugger
- Exotel call flow logs
- Deepgram request logs
- Azure Speech diagnostic output

### Local testing
- use ngrok to expose local voice server and webhook routes
- call the inbound number and watch the real-time logs
- use Twilio debugger to inspect webhook responses

### Network tests
- `curl https://yourapp.example.com/api/twilio/voice-streaming`
- `curl https://yourapp.example.com/api/exotel/voicebot/wss`
- verify WebSocket connection with a client or browser devtools

## Emergency Handling

If call content suggests emergency keywords:
- ensure the system responds with safe escalation text
- verify emergency detection in `language-detection.ts`
- do not rely on the AI to diagnose; route urgent cases to humans

## Best Practices

- keep secrets out of source control
- use separate staging and production environments
- validate environment variables at startup
- instrument voice server health checks
- monitor call quality and response latency

## Summary

This troubleshooting guide covers the most common issues in the Hospital AI stack. Start with connectivity, then verify STT/TTS credentials, provider formats, webhook routing, session cleanup, and database writes. Use logs aggressively to isolate the failing component.
