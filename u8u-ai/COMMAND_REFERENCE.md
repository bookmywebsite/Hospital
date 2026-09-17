# 🚀 VOICE AI - COMMAND REFERENCE & TESTING GUIDE

## Setup Commands

### Initial Setup
```bash
# 1. Install dependencies
npm install

# 2. Apply database migrations
npx prisma migrate deploy

# 3. Verify Prisma setup
npx prisma validate

# 4. Generate Prisma client
npx prisma generate
```

### Create Default Agent (Required before first test)
```bash
# Create via API
curl -X POST http://localhost:3000/api/voice/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MedAssist",
    "language": "en-IN",
    "voiceId": "en-IN-NeerjaNeural",
    "greeting": "Thank you for calling. How may I help you?",
    "systemPrompt": "You are MedAssist, an AI health assistant. Be warm, professional, and helpful. Keep responses short for voice calls."
  }'

# Save the returned agent ID (uuid)
# Use it in NEXT-TEST commands
```

---

## Development Commands (Local Testing)

### Terminal 1: Start Next.js Server
```bash
# Full dev mode with hot reload
npm run dev

# Or development build + start
npm run build && npm start

# Verify it's working:
# - Visit http://localhost:3000
# - Check http://localhost:3000/health
# - Check http://localhost:3000/api/voice/agents (should list your agent)
```

### Terminal 2: Start WebSocket Server
```bash
# Development mode (with ts-node)
npm run voice:dev

# Verify it's working:
# - Should log: "WebSocket server listening on ws://0.0.0.0:3001/media"
# - Check health: curl http://localhost:3001/health
```

### Terminal 3: Expose to Internet (ngrok)
```bash
# Install ngrok if needed
# https://ngrok.com/download

# Expose port 3001 (WebSocket server)
ngrok http 3001

# You'll see:
# Session Status: online
# Web Interface: http://127.0.0.1:4040
# Forwarding: https://abc123.ngrok.io -> http://localhost:3001

# COPY the URL: https://abc123.ngrok.io
# Use this in next step
```

### Terminal 4: Configure Twilio Webhook

```bash
# In your .env.local (or .env), update:
VOICE_WS_SERVER_URL=wss://abc123.ngrok.io
# (replace abc123 with your ngrok URL, change https→wss)

# Then in Twilio Console:
# 1. Go to Phone Numbers > Manage > Your Number
# 2. Voice Configuration section:
#    - A CALL COMES IN: 
#      Webhook: https://localhost:3000/api/voice/inbound
#    - CALL STATUS CHANGES:
#      Webhook: https://localhost:3000/api/voice/status

# For ngrok (add subdomain to Twilio webhook):
# Twilio webhook should point to: https://your-domain.ngrok.io/api/voice/inbound
```

---

## Testing Commands

### Test 1: Agent Management API
```bash
# List all agents
curl http://localhost:3000/api/voice/agents

# Get specific agent
curl "http://localhost:3000/api/voice/agents?id=AGENT_ID"

# Create new agent
curl -X POST http://localhost:3000/api/voice/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hindi Agent",
    "language": "hi-IN",
    "voiceId": "hi-IN-SwaraNeural",
    "greeting": "नमस्ते। आपसे कैसे मदद कर सकता हूं?"
  }'

# Update agent
curl -X PATCH "http://localhost:3000/api/voice/agents?id=AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"greeting": "New greeting here"}'

# Delete agent
curl -X DELETE "http://localhost:3000/api/voice/agents?id=AGENT_ID"
```

### Test 2: Inbound Call Simulation
```bash
# Call your Twilio number from your phone
# Expected flow:
# 1. Phone rings
# 2. Greeting plays in <1 second
# 3. Speak naturally
# 4. AI responds in <800ms perceived delay
# 5. Have a conversation
# 6. Hang up
# 7. Check database for call record

# Monitor logs:
# Terminal 1 (Next.js): Should show POST /api/voice/inbound
# Terminal 2 (WebSocket): Should show [Connection] New client, [Call] Started, [STT], [TTS]
```

### Test 3: Outbound Call API
```bash
# Trigger an outbound call to your phone
curl -X POST http://localhost:3000/api/voice/outbound \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "AGENT_ID_FROM_STEP_ABOVE",
    "contactPhone": "+919876543210",
    "contactName": "Chandram",
    "additionalData": {"company": "u8u.ai"}
  }'

# Response will show:
# {
#   "success": true,
#   "callId": "CA1234567890",
#   "conversationId": "conv_xyz",
#   "status": "RINGING"
# }

# Your phone will ring (same system)
```

### Test 4: Call Status Callback
```bash
# Twilio automatically sends status updates
# You can verify by querying the conversation:
curl "http://localhost:3000/api/conversations?twilioCallSid=CA1234567890"

# Should show:
# {
#   "status": "CLOSED",
#   "endedAt": "2024-01-15T10:30:00Z",
#   "callDuration": 245,
#   "summary": "Patient inquired about appointment booking"
# }
```

### Test 5: Language Detection
```bash
# Call your Twilio number and test with different languages:

# English:
# Say: "I want to book an appointment"
# Expect: Response in English within 800ms

# Hindi:
# Say: "नमस्ते, मुझे अपॉइंटमेंट चाहिए"
# Expect: AI detects Hindi, responds in Hindi within 800ms

# Tamil:
# Say: "வணக்கம், எனக்கு நியமனம் வேண்டும்"
# Expect: AI detects Tamil, responds in Tamil

# Mix:
# Say: "Hello , मेरा नाम Chandram है"
# Expect: AI handles mixed language, responds in detected primary language

# Monitor logs for:
# [Language] Detected: hi-IN
# [TTS] Changing voice to: hi-IN-SwaraNeural
```

### Test 6: Emergency Detection
```bash
# Call your Twilio number and say:
# "I have chest pain and can't breathe"

# Expect:
# - NO booking questions
# - Immediate emergency response:
#   "This is a medical emergency. Please call 108 immediately or go to the nearest hospital right now."
# - Call logged with emergencyDetected: true

# Check database:
# SELECT * FROM "VoiceCall" WHERE emergencyDetected = true;
```

### Test 7: Barge-In Detection
```bash
# Call and test:
# 1. When AI is speaking a filler, interrupt with speech
# 2. AI should stop mid-sentence
# 3. AI should detect your speech language
# 4. AI should generate new response

# Monitor logs for:
# [Barge-in] Detected
# [Audio Clear] Stopping Twilio playback
# [Speech] New user input detected
```

### Test 8: Database Verification
```bash
# Check your database

# View all conversations:
SELECT * FROM "Conversation" WHERE channel = 'VOICE' ORDER BY startedAt DESC;

# View all messages from a call:
SELECT * FROM "Message" WHERE conversationId = 'CONV_ID' ORDER BY createdAt ASC;

# View agent performance:
SELECT 
  va.name,
  COUNT(v.id) as total_calls,
  SUM(v.duration) as total_minutes,
  SUM(CASE WHEN v.emergencyDetected THEN 1 ELSE 0 END) as emergencies
FROM "VoiceAgent" va
LEFT JOIN "VoiceCall" v ON va.id = v.agentId
GROUP BY va.id;
```

---

## Production Deployment Commands

### Build for Production
```bash
# 1. Build Next.js
npm run build

# 2. Build WebSocket server
npm run voice:build

# Outputs:
# - Next.js: ./.next directory
# - WebSocket: ./dist/voice-server.js
```

### Deploy to Vercel
```bash
# Push to GitHub
git add .
git commit -m "Deploy voice AI streaming"
git push origin main

# Vercel auto-deploys (if connected)
# Or manual deploy:
npm i -g vercel
vercel --prod

# After deploy:
# Set environment variables in Vercel dashboard:
vercel env add TWILIO_ACCOUNT_SID
vercel env add TWILIO_AUTH_TOKEN
# ... etc for all keys

# Redeploy with secrets:
vercel --prod
```

### Deploy to Railway (WebSocket Server)
```bash
# 1. Create Railway account if needed: railway.app

# 2. Connect your GitHub repo:
railway up --production

# Or via dashboard:
# - New Project > GitHub repo
# - Set start command: npx ts-node voice-server.ts
# - Add environment variables:
#   * GROQ_API_KEY
#   * DEEPGRAM_API_KEY
#   * AZURE_SPEECH_KEY
#   * DATABASE_URL
# - Select region: ap-south-1 (Mumbai)

# 3. Railway gives you a URL: https://your-app.railway.app
# Set in Vercel: VOICE_WS_SERVER_URL=wss://your-app.railway.app
```

### Update Twilio Configuration (Production)
```bash
# Twilio Phone Numbers > Manage > Your Number:

# Voice webhooks:
# A CALL COMES IN:
#   Webhook: https://your-domain.vercel.app/api/voice/inbound
#   Method: POST

# CALL STATUS CHANGES:
#   Webhook: https://your-domain.vercel.app/api/voice/status
#   Method: POST

# Test with real phone call
# Should work exactly like local testing
```

---

## Monitoring & Debugging

### View Live Logs

#### Next.js Logs
```bash
# Vercel logs (production)
vercel logs

# Or local development
npm run dev
# Watch terminal for [Voice] prefix logs
```

#### WebSocket Server Logs
```bash
# Railway logs (production)
railway logs

# Or local development
npm run voice:dev
# Watch terminal for [WS], [STT], [TTS], [Brain] logs
```

### Health Checks
```bash
# Check Next.js API health
curl http://localhost:3000/health

# Check WebSocket server health
curl http://localhost:3001/health

# Check database connection
curl http://localhost:3000/api/health/db

# Response should be JSON with status=ok
```

### Performance Metrics
```bash
# Check STT response time
# (in WebSocket logs, look for [STT] timestamps)
# Expected: 200-300ms for final transcript

# Check Brain response time
# (in logs, look for [Brain] generation time)
# Expected: 80-120ms filler, 300-600ms real response

# Check TTS response time
# (in logs, look for [TTS] speak completion)
# Expected: 100-150ms total

# End-to-end perception
# Time from you stop speaking to first audio output
# Expected: 280-500ms (filler) + 300-600ms (real answer) = 500-800ms total
```

### Error Logs
```bash
# Common errors to watch for:

# [STT] Error - Deepgram connection failed
# Solution: Check DEEPGRAM_API_KEY

# [Brain] Error - Groq API failed
# Solution: Check GROQ_API_KEY, check rate limits

# [TTS] Error - Azure Speech failed
# Solution: Check AZURE_SPEECH_KEY, AZURE_SPEECH_REGION

# [Database] Error - Connection pooling issue
# Solution: Check DATABASE_URL, PostgreSQL/Supabase status

# [WebSocket] Error - Connection closed
# Solution: Check firewall, network stability
```

---

## Cleanup & Teardown

### Stop All Services
```bash
# Terminal 1: Ctrl+C (Next.js)
# Terminal 2: Ctrl+C (WebSocket)
# Terminal 3: Ctrl+C (ngrok)
# Terminal 4: ngrok will auto-stop
```

### Remove Test Data
```bash
# Clear all test conversations
DELETE FROM "Message" WHERE conversationId IN (
  SELECT id FROM "Conversation" WHERE channel = 'VOICE'
);
DELETE FROM "Conversation" WHERE channel = 'VOICE';

# Or keep logs for analysis - recommended
```

### Reset Environment
```bash
# Restore .env.local to original state
# Remove any test tokens/IDs
# Make sure production keys are still set
```

---

## Troubleshooting Commands

### If Twilio Webhook Not Firing
```bash
# 1. Verify ngrok is running
ngrok http 3001
# Should show "Forwarding" URL

# 2. Update Twilio webhook to ngrok URL
# Phone Numbers > Your Number > Voice > A CALL COMES IN
# URL: https://your-ngrok-subdomain.ngrok.io/api/voice/inbound

# 3. Test the webhook directly
curl "https://your-ngrok-subdomain.ngrok.io/api/voice/inbound" \
  -X POST \
  -d "CallSid=CAtest123&From=%2B919876543210&To=%2B919876543210"

# Should return TwiML XML with Connect/Stream element
```

### If WebSocket Connection Fails
```bash
# 1. Check WebSocket server is running
curl http://localhost:3001/health

# 2. Check firewall allows port 3001
# Windows Firewall > Inbound Rules > Allow port 3001

# 3. Check ngrok forwarding is working
# Browser: http://127.0.0.1:4040/inspect/http
# Should show recent requests

# 4. Test WebSocket directly
wscat -c ws://localhost:3001/media
# Should connect without errors
```

### If API Keys Not Working
```bash
# 1. Verify each key is set
echo $DEEPGRAM_API_KEY
echo $GROQ_API_KEY
echo $AZURE_SPEECH_KEY

# 2. Test each service directly
# Deepgram test
curl https://api.deepgram.com/v1/status \
  -H "Authorization: Bearer $DEEPGRAM_API_KEY"

# Groq test
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"

# Azure test
curl https://$AZURE_SPEECH_REGION.speech.cognitiveservices.azure.com/ \
  -H "Ocp-Apim-Subscription-Key: $AZURE_SPEECH_KEY"
```

### If Database Connection Fails
```bash
# 1. Check DATABASE_URL is set
echo $DATABASE_URL

# 2. Test connection
npx prisma db execute --stdin << 'EOF'
SELECT 1;
EOF

# 3. If still failing, verify:
# - Supabase project is active
# - IP whitelist includes your machine
# - PostgreSQL password is correct
```

---

## Performance Tuning

### Increase Response Speed
```bash
# 1. Reduce STT interim results processing
# In deepgram-stt.ts: increase confidence threshold

# 2. Fewer LLM tokens for faster generation
# In groq-brain.ts: reduce max_tokens from 200 to 100

# 3. Cache agent prompts
# In websocket-handler: pre-load agent on startup

# 4. Use SLM only (no LLM) for super-fast mode
# In processUserSpeech: skip LLM, use only filler
```

### Handle More Concurrent Calls
```bash
# 1. Increase Railway resources
# -> Memory: 1GB → 2GB → 4GB
# -> CPU: Shared → Dedicated

# 2. Database connection pooling
# Prisma already handles this
# But can increase: connection_limit in Prisma schema

# 3. Load balance WebSocket servers
# Deploy multiple voice-server.ts instances behind haproxy/nginx

# 4. Rate limit per agent
# Add Redis throttling in websocket-handler.ts
```

---

## Summary

Everything is configured and ready to test!

**Next Steps**:
1. Copy .env.voice.example → .env.local
2. Fill in your API keys
3. Run setup commands
4. Open 4 terminals and follow "Development Commands"
5. Call your Twilio number
6. Watch the logs
7. Test each scenario
8. Deploy to production when ready

**Expected Result**: Sub-1-second response time with multi-language support! 🎉
