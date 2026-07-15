# HuskyVoice-Identical Voice AI Implementation Guide
## Complete Setup: Streaming Architecture + Language Detection + Barge-in

**Status**: Production-Ready | **Last Updated**: April 2026 | **Stack**: Next.js + Twilio + Groq + Deepgram + Azure TTS

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites & Accounts](#prerequisites--accounts)
3. [Installation](#installation)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Local Development](#local-development)
7. [Production Deployment](#production-deployment)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Design

```
PATIENT CALLS
    ↓
TWILIO PSTN
    ↓
[Twilio Media Streams WebSocket] ← Real-time audio streaming
    ↓
┌─────────────────────────────────────────┐
│  WebSocket Server (voice-server.ts)     │
│  Location: Mumbai ap-south-1 (Railway)  │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ CONCURRENT PROCESSING (Dual-Brain)      │
├─────────────────────────────────────────┤
│ 1. STT (Deepgram)    → Real-time text   │
│ 2. Detect Language   → Unicode + KW     │
│ 3. SLM Filler        → 80ms fast reply  │
│ 4. LLM Response      → 300-600ms answer │
│ 5. TTS (Azure)       → Streaming audio  │
│ 6. Barge-in Detect   → Patient interrupt│
│ 7. DB Save (async)   → Fire & forget    │
└─────────────────────────────────────────┘
    ↓
PATIENT HEARS RESPONSE (sub-1 second perceived delay)
```

### Response Timeline

| Stage | Duration | What Happens |
|-------|----------|--------------|
| Patient starts speaking | 0ms | STT begins streaming |
| Interim transcript ready | 200ms | LLM starts processing |
| Filler begins | 280ms | Patient hears "Sure, let me help..." |
| Filler ends, LLM finishes | 400ms | Real response ready |
| Real answer starts | 500ms | Patient hears "To schedule an appointment..." |
| Full answer plays | 1000-3000ms | Conversation continues naturally |

**vs Old Polling System**: 3-12 second delay between listening and response 😞  
**vs New Streaming**: 500-800ms perceived delay ✅

---

## Prerequisites & Accounts

You need **6 accounts** (3-5 minutes each). Get API keys from these services:

### 1. Twilio Account
- **Sign up**: https://www.twilio.com/try-twilio
- **Get**: Account SID, Auth Token, Twilio Phone (+91)
- **Cost**: $1/month (phone) + $0.0079/minute (calls)
- **Indian Number**: Requires TRAI KYC (1-3 days) or use US test number

### 2. Deepgram Account
- **Sign up**: https://console.deepgram.com/signup
- **Get**: API Key (starts with `dg_`)
- **Cost**: Free $200 credits (~500 hours) or $0.0043/minute
- **Model**: nova-2 (recommended - best for Indian English)

### 3. Groq Account
- **Sign up**: https://console.groq.com
- **Get**: API Key (starts with `gsk_`)
- **Cost**: Free tier (30 req/min) or $99/month (Pro - unlimited)
- **Models**: llama-3.1-8b-instant (fast) + llama-3.1-8b-instant (smart)

### 4. Azure Speech Account
- **Sign up**: https://portal.azure.com
- **Service**: Cognitive Services > Speech
- **Region**: Central India (lowest latency)
- **Get**: Key + Region (`centralindia`)
- **Cost**: Free tier (500K chars/month) or $1/month (standard)
- **Voices**: Best Indian voice quality (Hindi, Tamil, Kannada, etc.)

### 5. Supabase
- **Already have**: Just confirm DATABASE_URL and DIRECT_URL

### 6. Railway or VPS
- **Sign up**: https://railway.app (recommended - $5/month)
- **Or use**: AWS/GCP/VPS in `ap-south-1` (Mumbai region)

---

## Installation

### Step 1: Clone & Install Dependencies

```bash
cd u8u-ai

# Install dependencies (already in package.json)
npm install

# Install voice-specific packages
npm install ws @types/ws
```

### Step 2: Install Prisma & Migrate

```bash
# Generate Prisma client
npx prisma generate

# Run database migration (adds Voice models)
npx prisma migrate deploy
```

If you need to create a new migration:
```bash
npx prisma migrate dev --name add_voice_ai
```

### Step 3: Verify Installation

```bash
# Check Deepgram SDK is installed
npm list @deepgram/sdk

# Check Azure Speech SDK
npm list microsoft-cognitiveservices-speech-sdk

# Check WebSocket library
npm list ws
```

All should show version numbers (not "not installed").

---

## Environment Configuration

### 1. Copy Environment Template

```bash
cp .env.voice.example .env.local
```

### 2. Fill in Your API Keys

Edit `.env.local` and replace all `xxxxxxx` placeholders:

```env
# Required - Get from accounts above
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+919876543210

DEEPGRAM_API_KEY=dg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_SPEECH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_SPEECH_REGION=centralindia

# Streaming enabled
ENABLE_STREAMING=true

# Local development (will change for production)
VOICE_WS_SERVER_URL=ws://localhost:3001
VOICE_AI_BASE_URL=http://localhost:3000
```

### 3. Verify Installation

```bash
# Check all keys are set
grep -E "TWILIO|DEEPGRAM|GROQ|AZURE|VOICE_WS" .env.local
```

Should show all your keys (not xxxxxxx).

---

## Database Setup

### 1. Run Prisma Migration

```bash
npx prisma migrate deploy
```

Creates new tables:
- `VoiceCall` → Call records with transcripts
- `VoiceAgent` → Agent configurations
- `KnowledgeChunk` → RAG knowledge base
- `OutboundCampaign` → Bulk calling campaigns

### 2. Create a Voice Agent

```bash
# Option A: Use Prisma Studio (GUI)
npx prisma studio

# Option B: Create via API (after starting Next.js)
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "your-org-id",
    "name": "Reception AI",
    "language": "en-IN",
    "voiceId": "en-IN-NeerjaNeural",
    "greeting": "Thank you for calling. How may I help?",
    "systemPrompt": "You are a hospital receptionist..."
  }'
```

### 3. Verify Database Connection

```bash
# Test database connection
npx prisma db execute << 'EOF'
SELECT COUNT(*) as agent_count FROM "Agent";
EOF
```

---

## Local Development

### Terminal 1: Start Next.js App

```bash
npm run dev
# Output: ▲ Next.js ready on http://localhost:3000
```

### Terminal 2: Start Voice WebSocket Server

```bash
npm run voice:dev
# Output:
# ═══════════════════════════════════════════════════════════════════
#   Voice AI Streaming WebSocket Server
# ═══════════════════════════════════════════════════════════════════
# ✓ WebSocket server listening on ws://localhost:3001/media
# ✓ Health check: http://localhost:3001/health
# ✓ Environment:
#   - GROQ_API_KEY: ✓ Set
#   - DEEPGRAM_API_KEY: ✓ Set
#   - AZURE_SPEECH_KEY: ✓ Set
#   - DATABASE_URL: ✓ Set
```

### Terminal 3: Expose to Twilio (ngrok)

```bash
# Install ngrok: https://ngrok.com/download and sign up
ngrok http 3000

# Output:
# Forwarding          https://abc123.ngrok.free.app -> http://localhost:3000
# Forwarding          ws://abc123.ngrok.free.app -> ws://localhost:3001

# Copy this URL - you'll use it for Twilio configuration
```

### Configure Twilio Phone Number

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click your phone number
3. **Voice Configuration**:
   - Select: **Webhook**
   - URL: `https://abc123.ngrok.free.app/api/twilio/voice-streaming?callType=inbound`
   - HTTP: **POST**
4. **Call Status Changes**:
   - URL: `https://abc123.ngrok.free.app/api/twilio/voice-status`
   - HTTP: **POST**
5. Click **Save Configuration**

### Make a Test Call

```bash
# Call your Twilio number from your mobile phone
# You should hear: "Thank you for calling. How may I help?"
# Try saying: "I want to book an appointment"
# AI should respond within 500-800ms!
```

### Monitor Logs

**Next.js Terminal**:
```
[Voice Streaming] inbound from=+919876543210 to=+919876500000
[Conversation] Created: conv_xxxxx
```

**Voice Server Terminal**:
```
[Session] Initialized: streamxxx
[Speech] User: "I want to book an appointment"
[Language] Detected: en-IN
[TTS] Filler: "Sure, let me help you!"
[TTS] Response: "To book an appointment, may I have your name?"
```

---

## Production Deployment

### Deploy Next.js to Vercel

1. Push to GitHub
2. https://vercel.com → Import project
3. Set environment variables in Vercel dashboard
4. Deploy

```
ENABLE_STREAMING=true
VOICE_WS_SERVER_URL=wss://xxxxx.railway.app (use Railway URL from below)
GROQ_API_KEY=gsk_xxxxxxxx
DEEPGRAM_API_KEY=dg_xxxxxxxx
AZURE_SPEECH_KEY=xxxxxxxx
DATABASE_URL=postgresql://xxxxx (Supabase)
```

### Deploy Voice Server to Railway

1. Go to https://railway.app
2. **Create new Project** → GitHub repo
3. **Add service** (in same project):
   - Root directory: `.`
   - Start command: `npx ts-node voice-server.ts`
4. Add all environment variables (same as above)
5. Configure domain:
   - Railway gives: `xxxxx.up.railway.app`
   - This becomes your `VOICE_WS_SERVER_URL`
6. Deploy

### Update Twilio Phone Number for Production

1. Vercel URL: `https://your-app.vercel.app` (no redirect needed)
2. Railway URL: `wss://xxxxx.up.railway.app/media`
3. Go to Twilio Console:
   - Voice webhook: `https://your-app.vercel.app/api/twilio/voice-streaming`
   - Status webhook: `https://your-app.vercel.app/api/twilio/voice-status`
4. Test: Call your Twilio number - should work instantly

### Cost Estimation (50 calls/day, 4 min avg)

| Service | Daily | Monthly |
|---------|-------|---------|
| Twilio Phone | $0.30 | ~₹250 |
| Twilio Minutes | $1.45 | ~₹1,200 |
| Deepgram STT | 0 | ~₹500 (free tier) |
| Groq LLM | 0 | ~₹350 (free tier) |
| Azure TTS | 0 | ~₹200 (free tier) |
| Railway Server | 0.17 | ~₹150 |
| **Total** | **~$2/day** | **~₹2,650/month** |

**vs HuskyVoice**: ₹63,999/month (90% cheaper! 🚀)

---

## Testing

### Test 1: Inbound Call English

```
You: "Hello, I want to book an appointment"
AI: "Sure, let me help you book an appointment. May I have your name?"
You: "My name is Chandram"
AI: "Nice to meet you, Chandram. Which department would you like to visit?"
```

**Expected**: Response within 500-800ms ✓

### Test 2: Hindi Detection & Response

```
You: "नमस्ते, मुझे अपॉइंटमेंट बुक करना है"
AI: "बिल्कुल! आपका नाम क्या है?"
```

**Expected**: 
- Language auto-detected as Hindi ✓
- Response in Hindi ✓
- <800ms delay ✓

### Test 3: Emergency Detection

```
You: "I have chest pain and can't breathe"
AI: "This is a medical emergency. Please call 108 immediately!"
```

**Expected**:
- Emergency detected instantly ✓
- No booking questions asked ✓
- Clear instruction given ✓

### Test 4: Barge-in (Patient Interrupts)

```
AI: "To book an appointment, may I have your name? [still speaking...]"
You: "Doctor appointment cancel karna hai" [interrupts]
AI: [Stops, detects barge-in] "Sure, let me help you cancel."
```

**Expected**:
- AI stops talking immediately ✓
- Detects interruption ✓
- Switches context correctly ✓

### Test 5: Multi-turn Conversation

```
Turn 1 - You: "Appointment please"
        AI: "Sure! May I have your name?"

Turn 2 - You: "Chandram"
        AI: "Nice to meet you. Which department?"

Turn 3 - You: "Cardiology"
        AI: "Great! What date works best for you?"
```

**Expected**:
- Conversation context maintained ✓
- History not lost ✓
- Natural flow ✓

### Automated Test Script

```bash
# Run integration tests
npm run test:voice

# Get detailed metrics
curl http://localhost:3001/metrics
```

---

## Troubleshooting

### Problem: WebSocket Connection Refused

**Symptoms**: Call hangs up immediately, no greeting

**Fix**:
```bash
# 1. Check voice server is running
lsof -i :3001

# 2. Verify VOICE_WS_SERVER_URL in Vercel
echo $VOICE_WS_SERVER_URL

# 3. Test ngrok tunnel (dev)
curl https://abc123.ngrok.free.app/health

# 4. Check Twilio webhook in console
# Make sure it points to /api/twilio/voice-streaming
```

### Problem: Slow Response (>2 seconds)

**Symptoms**: Long pause before AI responds

**Fix**:
```bash
1. Check network latency:
   ping api.deepgram.com      # Should be <200ms
   ping *.speech.cognitiveservices.azure.com  # <100ms
   
2. Check region deployment:
   - Vercel: Select "sgp1" (Singapore - closest to India)
   - Railway: Select "ap-south-1" (Mumbai)
   
3. Check Groq rate limit:
   - Free tier: 30 req/min
   - Monitor logs for "rate limit exceeded"
   - Upgrade to paid if needed
```

### Problem: Deepgram Error "authentication failed"

**Symptoms**: STT not working, AI can't hear

**Fix**:
```bash
# 1. Verify API key
echo $DEEPGRAM_API_KEY

# 2. Test Deepgram directly
curl -X POST https://api.deepgram.com/v1/listen \
  -H "Authorization: Token $DEEPGRAM_API_KEY" \
  --data-binary @test-audio.wav

# 3. Check key is not revoked
# Go to: https://console.deepgram.com/api-keys
```

### Problem: Azure TTS Not Working

**Symptoms**: AI listens but doesn't speak

**Fix**:
```bash
# 1. Verify region
echo "Region: $AZURE_SPEECH_REGION"  # Should be: centralindia

# 2. Test Azure connection
curl -X GET "https://$AZURE_SPEECH_REGION.tts.speech.microsoft.com/cognitiveservices/v1" \
  -H "Ocp-Apim-Subscription-Key: $AZURE_SPEECH_KEY" \
  -d "test"

# 3. Check voice ID exists
# See .env.voice.example for valid voices
```

### Problem: Language Not Detected (Always English)

**Symptoms**: Hindi/Tamil speech responded to in English

**Fix**:
```bash
# 1. Check language detection logs:
grep "Language\] Detected" server.log

# 2. Test detection directly:
node -e "
const {detectLanguage} = require('./src/lib/voice');
console.log(detectLanguage({text: 'नमस्ते'}));
"

# 3. If stuck on English, explicitly set in agent:
# Update Agent.languages: ["en-IN", "hi-IN", "ta-IN"]
```

### Problem: Database Connection Error

**Symptoms**: "PrismaClient error: connect ECONNREFUSED"

**Fix**:
```bash
# 1. Verify DATABASE_URL
echo $DATABASE_URL

# 2. Test connection
npx prisma db execute << 'EOF'
SELECT 1;
EOF

# 3. For Supabase, use DIRECT_URL (add to .env)
echo $DIRECT_URL

# 4. Run migrations
npx prisma migrate deploy
```

### Get Help

1. **Check logs** in Vercel/Railway dashboard
2. **Run locally** with `VOICE_DEBUG=true` for verbose logs
3. **Test individual services**:
   - Twilio: https://console.twilio.com/
   - Deepgram: https://console.deepgram.com
   - Groq: https://console.groq.com
4. **Contact support**:
   - Twilio: https://support.twilio.com
   - Deepgram: https://support.deepgram.com

---

## Architecture Deep Dive

### 1. Streaming STT (Deepgram)

```typescript
// Audio arrives every 20ms from Twilio
// Deepgram processes & streams back results every ~200ms
const stt = new DeepgramLiveSTT(
  (event) => {
    if (event.isFinal) {
      // User finished speaking
      console.log(event.transcript);  // "I want to book"
    } else {
      // Partial transcript (real-time)
      console.log(event.transcript);  // "I want" → "I want to" → etc
    }
  }
);

await stt.start();
// Audio chunks sent as they arrive
stt.sendAudio(audioBuffer);
await stt.stop();
```

### 2. Dual-Brain (SLM + LLM)

```typescript
// Parallel execution:
const fillerPromise = brain.generateFiller(userText);    // 80ms
const responsePromise = brain.generateResponse(userText);  // 300-600ms

// Speak filler WHILE LLM is generating
const filler = await fillerPromise;
tts.speak(filler);  // "Sure, let me help"

// Then speak real answer
const response = await responsePromise;
tts.speak(response);  // "To book an appointment..."
```

### 3. Language Detection

```typescript
// Priority order:
// 1. Unicode range (most reliable, 95% confidence)
// 2. Keyword patterns (80-90% confidence)
// 3. Stored language (fallback)

const result = detectLanguage({
  text: userSpeech,
  storedLanguage: 'en-IN',
  defaultLanguage: 'en-IN'
});

if (result.isStrong && result.language !== current) {
  // Switch voice & response language
  tts.changeVoice(getAzureVoiceId(result.language));
  brain.changeLanguage(result.language);
}
```

### 4. Barge-in Detection

```typescript
// Detect when patient starts speaking while AI is talking
stt.on(Transcript, (event) => {
  if (event.isFinal && tts.isSpeaking) {
    // Patient interrupted!
    bargeInDetected = true;
    
    // Stop TTS immediately
    ws.send({ event: 'clear', streamSid });
    
    // Stop LLM generation
    // Process new user speech
  }
});
```

---

## Key Differences: Streaming vs Polling

| Feature | Polling (Old) | Streaming (New) |
|---------|--------|---------|
| **Response Time** | 3-12 sec | 500-800ms |
| **Architecture** | HTTP round-trips | WebSocket (persistent) |
| **Audio Path** | Download → Process → Upload | Stream continuously |
| **Language Detection** | Before call | During call (real-time) |
| **Barge-in** | Not possible | Native support |
| **TTS Latency** | Full sentence waits | Sentence-by-sentence |
| **Scaling** | Limited (HTTP req timeout) | Unlimited (WebSocket) |
| **Cost** | Higher (more API calls) | Lower (streaming efficient) |

---

## Next Steps

1. ✅ Complete setup above
2. ⬜ Create custom agent prompts for your hospital
3. ⬜ Set up call recording (Twilio Recordings API)
4. ⬜ Build dashboard for call analytics
5. ⬜ Integrate WhatsApp confirmations (Twilio WhatsApp API)
6. ⬜ Set up outbound campaigns (BullMQ queue)
7. ⬜ Add RAG knowledge base (ChromaDB)

---

**Congratulations!** You now have a HuskyVoice-identical AI voice system running at 90% lower cost. 🎉

For questions or updates, check:
- 📖 [Deepgram Docs](https://developers.deepgram.com)
- 📖 [Azure Speech Docs](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/)
- 📖 [Groq Docs](https://console.groq.com/docs)
- 📖 [Twilio Docs](https://www.twilio.com/docs)
