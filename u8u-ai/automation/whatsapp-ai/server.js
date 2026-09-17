require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const { Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const queue = new Queue('whatsapp-processing', { connection: { url: REDIS_URL } });

function getExotelAuthHeader() {
  const username = process.env.EXOTEL_API_KEY || process.env.EXOTEL_SID;
  const token = process.env.EXOTEL_API_TOKEN;
  const auth = Buffer.from(`${username}:${token}`).toString('base64');
  return `Basic ${auth}`;
}

async function sendWhatsApp(from, to, body) {
  const sid = process.env.EXOTEL_SID;
  const base = (process.env.EXOTEL_API_BASE_URL || 'https://api.in.exotel.com').replace(/\/$/, '');
  const path = `/v1/Accounts/${sid}/Whatsapp/Send`;
  const url = `${base}${path}`;
  const params = new URLSearchParams();
  params.append('From', from);
  params.append('To', to);
  params.append('Body', body);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getExotelAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  const text = await res.text();
  try { return { ok: res.ok, json: JSON.parse(text) }; } catch (e) { return { ok: res.ok, text }; }
}

// API: send approved WhatsApp template (fill variables on server side)
app.post('/api/send-template', async (req, res) => {
  try {
    const { leadId, phone, templateName, variables } = req.body;
    if (!phone || !templateName) return res.status(400).json({ error: 'phone and templateName required' });

    // Simple templating: replace {{key}} in template
    // In production, validate template is an approved WhatsApp template
    const templates = {
      'welcome_hospital': 'Hello {{name}},\nWelcome to {{hospital}}. How may we help you today?'
    };
    const raw = templates[templateName];
    if (!raw) return res.status(400).json({ error: 'unknown template' });

    let body = raw;
    (variables || {}).forEach?.(() => {});
    if (variables && typeof variables === 'object') {
      for (const k of Object.keys(variables)) {
        body = body.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), variables[k]);
      }
    }

    const from = process.env.EXOTEL_WHATSAPP_NUMBER || process.env.EXOTEL_VIRTUAL_NUMBER;
    const result = await sendWhatsApp(from, phone, body);

    if (!result.ok) return res.status(502).json({ error: 'Exotel send failed', detail: result });

    // Create a simple conversation id and return
    const conversationId = uuidv4();
    return res.json({ success: true, conversationId, result: result.json ?? result.text });
  } catch (error) {
    console.error('send-template error', error);
    return res.status(500).json({ error: String(error) });
  }
});

// Webhook: Exotel will POST incoming WhatsApp messages here
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    // Expected payload: { from: '+91...', message: 'text' }
    const payload = req.body;
    const from = payload.from || payload.From || payload.sender || payload.msisdn;
    const text = payload.message || payload.text || payload.Body || payload.BodyText || payload.Message;
    if (!from || !text) {
      return res.status(400).json({ error: 'missing from or message' });
    }

    // Push job to processing queue
    await queue.add('incoming', { from, text, raw: payload });

    // acknowledge quickly
    return res.json({ success: true });
  } catch (error) {
    console.error('webhook error', error);
    return res.status(500).json({ error: String(error) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`WhatsApp AI flow listening on ${PORT}`));
