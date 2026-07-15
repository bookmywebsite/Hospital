WhatsApp AI Automation Flow (minimal scaffold)

Overview
- Express server receives CRM trigger to send a template and handles incoming WhatsApp webhooks.
- Incoming messages are queued in BullMQ (Redis) and processed by a worker that calls OpenAI and sends replies through Exotel.

Quick start
1. Copy `.env.example` to `.env` and fill values.
2. Install deps:

```bash
cd automation/whatsapp-ai
npm install
```

3. Start Redis, MySQL, and then start the server and worker:

```bash
npm run start   # runs server.js
npm run worker  # runs worker.js
```

Endpoints
- `POST /api/send-template` — send approved WhatsApp template (body: `phone`, `templateName`, `variables`)
- `POST /webhook/whatsapp` — Exotel webhook for incoming WhatsApp messages

Notes and next steps
- Replace simple templating with your approved WhatsApp templates and parameter validation.
- Persist conversations/messages in MySQL (example schema in `db.sql`).
- Add authentication for CRM triggers and delivery tracking updates.
- For production, add retries, monitoring, and socket.io dashboard.
