# Live Demo Script for Hospital AI

Use this script to demonstrate the Hospital AI project in a live presentation.

## Demo Goals

- show the web dashboard and data model
- trigger a live voice call through Twilio or Exotel
- observe live transcription and AI response
- explain backend flow and persistence
- highlight value in hospital appointment automation

## Demo Setup

1. Ensure the web app is running and publicly accessible.
2. Ensure the voice server is running and reachable via `VOICE_WS_SERVER_URL`.
3. Confirm the telephony provider is configured with correct webhook URLs.
4. Have a test phone number ready to call the AI line.
5. Open the hospital dashboard and a terminal for logs.

## Step-by-Step Demo

### 1. Start with architecture overview
- present the two parts: dashboard app and voice server
- explain telephony providers and real-time voice path
- mention AI and speech services in use

### 2. Show the dashboard
- log in via Clerk UI
- navigate to relevant pages for leads, conversations, or call history
- emphasize patient/lead records and appointment views

### 3. Place a test call
- call the inbound number from a phone
- explain that Twilio/Exotel sends audio to the voice server
- mention Deepgram for transcription and Azure for TTS

### 4. Observe live behavior
- point to console logs or monitoring for incoming connection
- show any live transcript or call session updates
- if the UI has real-time call status, display it

### 5. Highlight AI response
- let the caller ask a simple hospital question
- show the AI response audio and any transcript text
- explain the filler response and full answer strategy

### 6. Demonstrate appointment creation
- ask the caller to book an appointment with a doctor or department
- confirm that the AI captures details and creates the record
- show the created appointment in the dashboard

### 7. Wrap up with call analytics
- show the completed conversation record in the database/UI
- mention call classification, lead scoring, and summary capture
- explain how the system can route complex issues to human staff

## Talking Points

- “This system is built for hospital front desks to automate routine calls.”
- “The voice server handles real-time audio, while the web app handles CRM and workflows.”
- “Live transcription and AI mean a caller can speak naturally without waiting for menus.”
- “It supports both Twilio and Exotel, so it can work across regions.”

## Demo Variations

### If voice is not configured
- show the code path in `src/app/api/twilio/voice-streaming/route.ts`
- explain how audio would enter via Twilio Media Streams
- walk through `websocket-handler.ts` and `groq-brain.ts`

### If appointment booking fails
- show the session state logic in `websocket-handler.ts`
- explain how call metadata is parsed and how appointments are created

### If showing call classification
- explain `brain.classifyCall()` and how results update `Conversation`
- show examples of positive/negative call outcomes

## Common demo questions

Q: “Why separate the voice server?”
A: “So calls can use long-lived WebSockets and avoid serverless timeout issues.”

Q: “How does it handle accents/languages?”
A: “Deepgram STT supports Indian languages, and the system detects language to choose the right voice.”

Q: “Is medical advice safe?”
A: “The AI is prompted to be cautious and escalate emergencies to a human, not diagnose.”

Q: “Can this scale?”
A: “Yes, by running multiple voice servers with load-balancing and using DB scaling for the dashboard.”

## Demo Checklist

- [ ] App is running and accessible
- [ ] Voice server is running
- [ ] `VOICE_WS_SERVER_URL` is valid
- [ ] Webhooks are configured correctly
- [ ] Test phone number is ready
- [ ] Logs/console visible for live events
- [ ] Dashboard pages ready to show

## Summary

This demo script helps you present the Hospital AI project clearly by focusing on architecture, live voice automation, and hospital-specific outcomes. Keep the demo concise and highlight the system’s ability to automate real caller interactions in real time.
