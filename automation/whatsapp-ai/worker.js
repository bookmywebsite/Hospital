require('dotenv').config();
const { Worker } = require('bullmq');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const queueName = 'whatsapp-processing';

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

async function generateReply(conversation, incomingText) {
  // system prompt for hospital assistant
  const system = `You are a hospital AI assistant. Rules: Be professional, help patients book appointments, ask department details, ask preferred timings, be concise.`;
  const user = `Lead: ${incomingText}`;

  const resp = await groq.chat.completions.create({
  model: 'openai/gpt-oss-20b',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    max_tokens: 200,
    temperature: 0.6,
  });

  const text = resp.choices?.[0]?.message?.content ?? 'Sorry, I could not process that.';
  return text;
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

  const username = process.env.EXOTEL_API_KEY || process.env.EXOTEL_SID;
  const token = process.env.EXOTEL_API_TOKEN;
  const auth = Buffer.from(`${username}:${token}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });
  const text = await res.text();
  try { return { ok: res.ok, json: JSON.parse(text) }; } catch (e) { return { ok: res.ok, text }; }
}

const worker = new Worker(queueName, async job => {
  const { from, text } = job.data;
  console.log('Processing incoming message from', from, text);

  // In production, look up conversation in DB, attach context
  const aiReply = await generateReply(null, text);

  // send reply via Exotel
  const fromNumber = process.env.EXOTEL_WHATSAPP_NUMBER || process.env.EXOTEL_VIRTUAL_NUMBER;
  const sendResult = await sendWhatsApp(fromNumber, from, aiReply);
  console.log('Sent reply', sendResult);

  return { success: sendResult.ok };
}, { connection: { url: REDIS_URL } });

worker.on('completed', job => console.log('job completed', job.id));
worker.on('failed', (job, err) => console.error('job failed', job.id, err));

console.log('Worker started');
