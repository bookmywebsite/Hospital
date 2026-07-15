# Production Deployment Guide

This guide explains how to deploy and operate the Hospital AI project in production.

## Deployment Architecture

The project requires two deployed units:
1. Next.js web application
2. Standalone voice WebSocket server

### Why two units?
- Next.js app handles dashboard, API routes, and webhook entrypoints.
- Voice server handles continuous WebSocket audio streaming, which serverless platforms cannot host reliably.

## Recommended Infrastructure

### Web App
- deploy to Vercel, Railway, or another Node-ready host.
- use `npm run build && npm start` for production.
- ensure `NEXT_PUBLIC_APP_URL` is set to the public domain.

### Voice Server
- deploy to a VPS, Railway, Fly.io, Render, or any host supporting long-lived Node processes.
- use `npm run voice:build` and `npm run voice:start` or `npm run voice:dev` for development.
- set `VOICE_WS_SERVER_URL` to the public URL of this server.

## Environment Variables

### Required service variables
- `DATABASE_URL`, `DIRECT_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `GROQ_API_KEY`
- `DEEPGRAM_API_KEY`
- `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `EXOTEL_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_VIRTUAL_NUMBER`
- `VOICE_WS_SERVER_URL`
- `VOICE_AI_BASE_URL` or `CALLBACK_BASE_URL`
- `HOSPITAL_NAME`

### Optional variables
- `VOICE_AI_DEFAULT_LANGUAGE`
- `VOICE_AI_DEFAULT_VOICE`
- `VOICE_MAX_CALL_DURATION`
- `VOICE_ENABLE_RECORDING`
- `VOICE_ENABLE_BARGEIN`
- `VOICE_DEBUG`
- `CRON_SECRET`

## DNS and SSL

- use HTTPS for all public webhook URLs.
- if voice server is hosted separately, ensure WSS is available at `VOICE_WS_SERVER_URL`.
- use a custom domain or cloud host with automatic SSL.

## WebSocket URL Configuration

- Twilio and Exotel require a public WSS URL.
- set `VOICE_WS_SERVER_URL` to the voice server’s HTTPS address.
- if you use ngrok/cloudflared in dev, keep the tunnel open while testing.

## Telephony Webhook Setup

### Twilio
- configure the phone number voice webhook to point to `/api/twilio/voice-streaming` or `/api/twilio/voice`
- status callback should point to `/api/twilio/status`
- recording webhook optionally to `/api/twilio/recording`

### Exotel
- configure Exotel flow or webhook to obtain the WSS URL from `/api/exotel/voicebot/wss`
- ensure the WSS URL returns the correct endpoint and query string parameters

## Running the Web App

Recommended production command:
```bash
npm run build
npm start
```
If using a process manager:
- `pm2 start npm --name hospital-ai -- run start`
- or systemd target service

## Running the Voice Server

Recommended commands:
```bash
npm run voice:build
npm run voice:start
```
For development:
```bash
npm run voice:dev
```

## Process Management

### PM2 example
```bash
pm install -g pm2
pm run voice:build
pm run build
pm2 start npm --name hospital-ai-web -- run start
pm2 start npm --name hospital-ai-voice -- run voice:start
```

### systemd example
- create two services: `hospital-ai-web.service` and `hospital-ai-voice.service`
- ensure environment variables are loaded from a secure file

## Reverse Proxy

If using nginx or Apache:
- proxy `/` to Next.js app
- proxy `/media` or the voice server domain to the voice WebSocket server
- ensure `Upgrade: websocket` headers pass through

### nginx sample
```nginx
server {
  listen 443 ssl;
  server_name hospital-ai.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  location /media {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

## Database Setup

- run `npx prisma migrate deploy` after setting `DATABASE_URL`.
- use `npx prisma generate` if dependencies change.
- ensure the database is accessible from the web app.

## Monitoring and Logging

- voice server writes `voice-server.log` in root.
- enable `VOICE_DEBUG=true` for detailed logs.
- consider external logging/monitoring for production.

## Scaling Strategy

### Web app scaling
- scale Next.js instances horizontally under load
- use a managed Postgres service for database scaling

### Voice server scaling
- run multiple voice servers behind a load balancer
- use sticky sessions or session affinity for WebSocket routing
- shard calls by organization or region

## High Availability

- use multiple voice server instances and health checks
- use a load balancer with TCP/WebSocket support
- keep voice server environment identical to web app region

## Troubleshooting Checklist

- `VOICE_WS_SERVER_URL` incorrect → audio never reaches server
- `DEEPGRAM_API_KEY` invalid → STT fails
- `AZURE_SPEECH_KEY` invalid → TTS fails
- `GROQ_API_KEY` missing → AI responses fail
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` invalid → calls fail
- `DATABASE_URL` not reachable → DB writes fail

## Summary

Production deployment requires two coordinated services. The web app serves dashboards and webhooks, while the voice server handles streaming audio in real time. Proper environment config, secure public URLs, and process management are essential.
