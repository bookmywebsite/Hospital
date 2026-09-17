# 🚀 GO LIVE CHECKLIST - HOSPITAL VOICE AI

**Date**: April 17, 2026  
**Target**: Production Deployment  
**Status**: Ready for verification  

---

## Pre-Launch Verification Checklist

### ✅ Section 1: Twilio Configuration

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | Twilio account verified with KYC | - | Check Twilio Console > Account > General Settings |
| ☐ | Indian phone number active | - | Call your number from mobile - should ring |
| ☐ | Phone number not in trial mode | - | Check Account > Main / Trial | Production |
| ☐ | Twilio webhook points to production URL | - | Phone Numbers > [Your Number] > Configure > Voice webhook |
| ☐ | Webhook URL is HTTPS (not HTTP) | - | URL should start with `https://` |
| ☐ | Webhook points to `/api/voice/inbound` | - | Should be like: `https://your-domain.com/api/voice/inbound` |
| ☐ | Machine detection enabled | - | In code: `machineDetection: 'Enable'` |
| ☐ | Status callbacks configured | - | In code: `statusCallback` pointing to `/api/voice/status` |

**Verification Scripts**:
```bash
# Test Twilio connection
curl -X GET https://api.twilio.com/2010-04-01/Accounts \
  -u YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN | jq '.accounts[0].friendlyName'

# Should return your account name
```

---

### ✅ Section 2: API Key Verification

| Check | Item | Status | Where to Verify |
|-------|------|--------|-----------------|
| ☐ | Deepgram API key working | - | Deepgram Console > API Keys > copy key |
| ☐ | Deepgram key is in `.env` | - | `DEEPGRAM_API_KEY=...` |
| ☐ | Deepgram quota available | - | Deepgram Console > Billing > Usage |
| ☐ | Groq API key working | - | Groq Console > API Keys > copy key |
| ☐ | Groq key is in `.env` | - | `GROQ_API_KEY=...` |
| ☐ | Groq rate limit checked | - | Free tier: 30 req/min (upgrade if needed) |
| ☐ | Azure Speech key working | - | Azure Portal > Speech service > Keys & Endpoints |
| ☐ | Azure region correct | - | Should be `centralindia` (Mumbai) for best latency |
| ☐ | Azure key is in `.env` | - | `AZURE_SPEECH_KEY=...`, `AZURE_SPEECH_REGION=centralindia` |

**Verification Scripts**:
```bash
# Test Deepgram
curl -X POST https://api.deepgram.com/v1/listen \
  -H "Authorization: Token YOUR_DEEPGRAM_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @test.wav

# Test Groq
curl -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_GROQ_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-oss-20b", "messages": [{"role": "user", "content": "hi"}]}'

# Test Azure Speech
curl -X POST https://centralindia.tts.speech.microsoft.com/cognitiveservices/v1 \
  -H "Ocp-Apim-Subscription-Key: YOUR_AZURE_KEY" \
  -H "X-Microsoft-OutputFormat: audio-16khz-32kbitrate-mono-mp3" \
  -d '<speak>Hello</speak>'
```

---

### ✅ Section 3: Database Setup

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | PostgreSQL database accessible | - | `psql -U user -d database -c "SELECT 1"` |
| ☐ | DATABASE_URL environment variable set | - | echo $DATABASE_URL |
| ☐ | Prisma migrations applied | - | npx prisma migrate status |
| ☐ | All voice tables created | - | Check: voiceAgent, voiceCall, callMessage |
| ☐ | Database has no schema errors | - | npx prisma validate |
| ☐ | Connection pooling configured | - | DATABASE_URL should include ?schema=public |

**Verification Scripts**:
```bash
# Check migrations
npx prisma migrate status

# Should show: ✓ All migrations have been applied

# Verify tables exist
npx prisma db execute --stdin < verify.sql

# SQL:
# SELECT table_name FROM information_schema.tables 
# WHERE table_schema='public' AND table_name LIKE 'voice%';
```

---

### ✅ Section 4: Next.js Application

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | Next.js builds without errors | - | npm run build |
| ☐ | TypeScript compilation passes | - | npx tsc --noEmit |
| ☐ | All voice routes exist | - | Check src/app/api/voice/ |
| ☐ | Environment variables in Vercel | - | Vercel UI > Project > Settings > Environment Variables |
| ☐ | Deployed to Vercel | - | Vercel Dashboard > Deployments |
| ☐ | Production URL accessible | - | curl https://your-domain.com/api/voice/stream |

**Verification Scripts**:
```bash
# Build locally
npm run build

# Should complete successfully with no errors

# Type check
npx tsc --noEmit

# Should show: 0 errors
```

---

### ✅ Section 5: WebSocket Server

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | WebSocket server deployed to Railway | - | Railway Dashboard > Deployments |
| ☐ | Railway service URL configured | - | VOICE_WS_SERVER_URL env var |
| ☐ | WebSocket server running | - | curl https://your-ws-server.railway.app/health |
| ☐ | Health check returns 200 | - | Status should be `{"status":"ok"}` |
| ☐ | WebSocket path is `/media` | - | In voice-server.ts |
| ☐ | Port is 3001 or custom | - | Check VOICE_WS_PORT env var |
| ☐ | Environment variables in Railway | - | All API keys copied to Railway |

**Verification Scripts**:
```bash
# Check WebSocket health
curl -s https://YOUR_RAILWAY_URL/health | jq '.'

# Should return:
# {"status":"ok","timestamp":"2026-04-17T..."}

# Test WebSocket connection (requires wscat)
npm install -g wscat
wscat -c wss://YOUR_RAILWAY_URL/media

# Should connect (may show "listening..." then timeout is OK)
```

---

### ✅ Section 6: Voice Agents

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | Default agent created | - | Check database: voiceAgent table |
| ☐ | Agent has valid systemPrompt | - | systemPrompt should be >50 chars |
| ☐ | Agent language is valid | - | e.g., 'en-IN', 'hi-IN' |
| ☐ | Agent voiceId is supported | - | Check src/lib/voice/language-config.ts |
| ☐ | Agent has greeting text | - | Non-empty greeting field |
| ☐ | Agent isActive = true | - | Should be active in database |

**Verification Scripts**:
```bash
# Create a test agent via API
curl -X POST https://your-domain.com/api/voice/agents \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org-1",
    "name": "Hospital Receptionist",
    "language": "en-IN",
    "voiceId": "en-IN-NeerjaNeural",
    "greeting": "Thank you for calling City Hospital. How may I help you?",
    "systemPrompt": "You are a hospital receptionist..."
  }'

# Should return agent with id
```

---

### ✅ Section 7: Inbound Call Testing

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | Inbound route responding | - | POST /api/voice/inbound responds |
| ☐ | TwiML returned correctly | - | Response has `<?xml version` and `<Connect>` |
| ☐ | WebSocket URL in TwiML correct | - | Should be `wss://your-ws-server.railway.app/media` |
| ☐ | Call receives greeting | - | Call your number, AI says greeting |
| ☐ | Speech recognized | - | Say something, should appear in logs |
| ☐ | AI responds | - | Should hear AI filler then response |
| ☐ | Barge-in works | - | Interrupt AI mid-speech, should stop |

**Test Procedure**:
```bash
# 1. Start with logs visible
tail -f Vercel_logs.txt  # or Railway logs

# 2. Call your number from mobile
# Listen for:
# - Greeting plays
# - You can speak
# - AI acknowledges (filler)
# - AI provides response

# 3. Check logs for:
# [Inbound] Call xxx from +91xxx to +91xxx
# [STT] Final: [what you said]
# [Brain] Filler: [acknowledgment]
# [Brain] Response: [AI answer]
# [TTS] > [speaking text]
```

---

### ✅ Section 8: Outbound Call Testing

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | Outbound route responding | - | POST /api/voice/outbound responds |
| ☐ | Call initiated successfully | - | Response includes callId and twilioCallSid |
| ☐ | Call reaches target number | - | Target phone rings |
| ☐ | Call connects via WebSocket | - | TwiML returned with Stream connection |
| ☐ | AI speaks to contact | - | Hear greeting from AI |
| ☐ | Contact can respond | - | Your responses are captured |
| ☐ | Call ends cleanly | - | No crashes or hangs |

**Test Procedure**:
```bash
# 1. Call the outbound API
curl -X POST https://your-domain.com/api/voice/outbound \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-123",
    "contactPhone": "+919876543210",
    "contactName": "John Doe"
  }'

# Response:
# {"data": {"callId": "...", "twilioCallSid": "CA-...", "status": "ringing"}}

# 2. Your phone should ring
# 3. Answer and listen for AI greeting
# 4. Speak naturally, AI should respond
```

---

### ✅ Section 9: Database Recording

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | Conversation record created | - | Check database after call |
| ☐ | VoiceCall record created | - | VoiceCall.id should exist |
| ☐ | CallMessage entries saved | - | Both user and assistant messages saved |
| ☐ | Transcript saved | - | VoiceCall.transcript should have full text |
| ☐ | Lead classification saved | - | VoiceCall.leadScore should be hot/warm/cold |
| ☐ | Duration calculated | - | VoiceCall.duration should have seconds |
| ☐ | Sentiment analyzed | - | VoiceCall.sentiment should be positive/neutral/negative |

**Verification Scripts**:
```bash
# Check most recent call
SELECT 
  id, 
  direction, 
  callerNumber, 
  calledNumber, 
  status, 
  duration,
  leadScore,
  sentiment,
  transcript
FROM "VoiceCall"
ORDER BY "startedAt" DESC
LIMIT 1;

# Should show all fields populated
```

---

### ✅ Section 10: Error Handling

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | Network error handled | - | Disconnect internet, should not crash |
| ☐ | API timeout handled | - | Deepgram slow response, should recover |
| ☐ | Database error handled | - | Queries fail gracefully |
| ☐ | Missing env var handled | - | Clear error message, not crash |
| ☐ | Invalid phone number | - | 400 error returned |
| ☐ | Agent not found | - | 404 error returned |

**Error Test Procedure**:
```bash
# Test missing API key
unset GROQ_API_KEY
curl https://your-domain.com/api/voice/inbound

# Should return: "GROQ_API_KEY not configured" (clear message)

# Test invalid input
curl -X POST https://your-domain.com/api/voice/outbound \
  -H "Content-Type: application/json" \
  -d '{"contactPhone": "invalid"}'

# Should return: 400 Bad Request
```

---

### ✅ Section 11: Performance

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | Filler response time <150ms | - | Measure logs: [Brain] Filler timing |
| ☐ | Total response time <1000ms | - | Measure: Say phrase → hear response |
| ☐ | No audio lag on connection | - | Greeting plays immediately |
| ☐ | Barge-in latency <500ms | - | Interrupt, stops within 500ms |
| ☐ | Database writes non-blocking | - | Call doesn't wait for DB |

**Performance Monitoring**:
```bash
# Monitor latency in logs
grep "\[Brain\]" logs.txt | grep -E "Filler|Response" | head -20

# Look for timing patterns:
# [Brain] Filler generation took: 87ms
# [Brain] Response generation took: 412ms
```

---

### ✅ Section 12: Multi-Language Support

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | English (en-IN) works | - | Speak in English, get English response |
| ☐ | Hindi (hi-IN) works | - | Speaker: "नमस्ते", AI responds in Hindi |
| ☐ | Auto-language detection | - | Mix languages, AI detects each |
| ☐ | Voice ID matches language | - | Hindi agent uses hi-IN voice |
| ☐ | All 11 languages available | - | Check language-config.ts |

**Language Test Matrix**:

| Language | Test Phrase | Expected Result |
|----------|-------------|-----------------|
| English | "Hello, I'd like to book an appointment" | English response |
| Hindi | "नमस्ते, मुझे अपॉइंटमेंट बुकिंग चाहिए" | Hindi response |
| Tamil | "வணக்கம்" | Tamil response |
| etc. | ... | ... |

---

### ✅ Section 13: Security

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | No hardcoded API keys | - | grep -r "DEEPGRAM\|GROQ\|AZURE" src/ |
| ☐ | All secrets in env vars | - | Check .env.local has all keys |
| ☐ | HTTPS only | - | All URLs start with https:// |
| ☐ | Database connection encrypted | - | DATABASE_URL uses SSL |
| ☐ | No sensitive data in logs | - | Logs don't show API keys |
| ☐ | Rate limiting on endpoints | - | Optional: middleware for rate limits |

---

### ✅ Section 14: Monitoring & Alerting

| Check | Item | Status | How to Verify |
|-------|------|--------|---------------|
| ☐ | Error logs monitored | - | Set up Sentry or similar |
| ☐ | Performance metrics tracked | - | CloudWatch or Railway metrics |
| ☐ | Health check endpoint working | - | /health returns 200 regularly |
| ☐ | Alerts configured | - | Email/Slack on errors |
| ☐ | Uptime monitoring enabled | - | Notify if service goes down |

---

## Final Go-Live Steps

### 1. Pre-Launch (24 hours before)

```bash
# Final build test
npm run build

# Final type check
npx tsc --noEmit

# Database backup
pg_dump $DATABASE_URL > backup.sql

# Update status page
# "Voice AI launching soon"
```

### 2. Launch Day

```bash
# 1. Deploy to Vercel (if not already)
vercel deploy --prod

# 2. Verify Railway WebSocket running
curl https://YOUR_RAILWAY_URL/health

# 3. Test inbound call
# Call your number, verify it works

# 4. Test outbound call
curl -X POST https://your-domain.com/api/voice/outbound \
  -H "Content-Type: application/json" \
  -d '{"agentId":"...", "contactPhone":"..."}'

# 5. Check logs for errors
tail -f Railway_logs.txt
tail -f Vercel_logs.txt
```

### 3. Post-Launch (monitor for 24 hours)

```bash
# Monitor incoming calls
# Check database for successful recordings
# Monitor error rates
# Get user feedback
# Scale if needed (add more agents)
```

---

## Success Criteria

✅ **System is live when**:
- [ ] Inbound calls connect successfully
- [ ] Outbound calls complete without errors
- [ ] Speech recognized correctly (>90% accuracy)
- [ ] Responses generated in <1 second
- [ ] All calls recorded in database
- [ ] No downtime > 5 minutes
- [ ] <0.1% error rate on calls

---

## Rollback Plan

If critical issues occur:

1. **Pause Twilio webhook** → Phone Numbers > Configure > disable Voice URL
2. **Revert Vercel** → Vercel Dashboard > Deployments > Rollback
3. **Stop Railway** → Railway Dashboard > Service > Stop
4. **Restore database** → `psql $DATABASE_URL < backup.sql`
5. **Investigate errors** → Review logs, fix, re-deploy

---

## Support Contacts

- **Twilio Support**: https://www.twilio.com/help
- **Deepgram Support**: https://support.deepgram.com
- **Groq Support**: https://groq.com/support
- **Azure Support**: https://support.microsoft.com/en-us/azure

---

## Sign-Off

- [ ] All checks completed
- [ ] All tests passed
- [ ] Ready for production
- [ ] Approval from stakeholder

**Status**: 🟢 **READY FOR GO-LIVE**

