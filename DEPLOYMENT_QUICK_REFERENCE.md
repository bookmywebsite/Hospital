# 🚀 DEPLOYMENT & QUICK REFERENCE GUIDE

## Critical Environment Variables (Copy to .env)

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/hospital_db
DIRECT_URL=postgresql://user:password@host:5432/hospital_db

# Redis (for Auto-Dialer Queue)
REDIS_URL=redis://user:password@host:6379

# Twilio (Voice, WhatsApp, SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=14155238886

# AI Model (Groq)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx

# Email Service (SendGrid)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@primepro.ai
SENDGRID_FROM_NAME=PrimePro AI

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx

# Payment (Stripe - Optional)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx

# App Configuration
NEXT_PUBLIC_APP_URL=https://yourdomain.com
HOSPITAL_NAME=City Hospital

# Optional
CALLS_PER_MINUTE_LIMIT=5
NODE_ENV=production
```

---

## One-Time Setup Commands

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Run database migrations
npx prisma migrate deploy

# 4. Seed doctors (optional)
npm run seed-doctors

# 5. Open Prisma Studio to verify data
npx prisma studio
```

---

## Start Development Server

```bash
npm run dev

# Runs on http://localhost:3000
# Auto-reloads on file changes
```

---

## Build for Production

```bash
npm run build

# Then start production server:
npm run start
```

---

## Testing Commands

### Test TypeScript Compilation
```bash
npx tsc --noEmit
```

### Check Linting
```bash
npm run lint
```

### Test Database Connection
```bash
npx prisma db execute --stdin < /dev/null
# or
npx prisma studio
```

### Test Redis Connection
```node
// In Node REPL:
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
redis.ping().then(() => console.log('✅ Redis OK'));
```

### Test Groq API
```node
const Groq = require('groq-sdk').default;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
groq.chat.completions.create({
  model: 'openai/gpt-oss-20b',
  messages: [{ role: 'user', content: 'Hello' }],
}).then(r => console.log('✅ Groq OK'));
```

### Test Twilio Connection
```node
const twilio = require('twilio');
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
client.api.calls.list({ limit: 1 })
  .then(() => console.log('✅ Twilio OK'));
```

---

## Quick Testing Scenarios

### Test Instant AI Call (Voice)

1. **Go to Dashboard** → Click on any Lead
2. **Right panel** → "Instant AI Call" → Select Language (e.g., Marathi)
3. **Click "Call Now"**
4. **Verify:**
   - Call is placed
   - Greeting is in Marathi
   - AI responds in Marathi

### Test Chat

1. **Go to any page with Chat Widget** (bottom right)
2. **Type message:** "I want to book an appointment"
3. **Verify:**
   - Message sent
   - AI responds
   - Response is helpful

### Test WhatsApp

1. **Dashboard** → Lead → **Send WhatsApp Message**
2. **Verify:** Message sent to Twilio sandbox

### Test Auto-Dialer

1. **Dashboard** → **Auto-Dialer Queue**
2. **Select lead(s)** → **Add to Queue**
3. **Verify:**
   - Call placed
   - Greeting in selected language
   - AI responds in language

### Test Emergency Detection

1. **Start a voice call**
2. **Say (in any language):**
   - "I have chest pain"
   - "I can't breathe"
   - "I'm unconscious" (jokingly)
3. **Verify:** AI recognizes emergency and directs to 108

---

## Common Errors & Fixes

### Error: "REDIS_URL environment variable is not set"
**Fix:** Add REDIS_URL to .env file

### Error: "DATABASE_URL is not set"
**Fix:** Add DATABASE_URL to .env file

### Error: "GROQ_API_KEY is not set"
**Fix:** Create Groq account, get API key, add to .env

### Error: "TWILIO_ACCOUNT_SID is not set"
**Fix:** Create Twilio account, get credentials, add to .env

### Error: "Prisma Client not generated"
**Fix:** Run `npx prisma generate`

### Error: "Migration failed"
**Fix:** 
```bash
npx prisma db push
# or
npx prisma migrate resolve --rolled-back "migration_name"
```

### Error: "Port 3000 is in use"
**Fix:**
```bash
npm run dev -- -p 3001  # Use port 3001 instead
```

---

## Monitoring & Logs

### Vercel Deployment (Recommended)

```bash
# Deploy to Vercel
vercel deploy

# View logs
vercel logs
```

### Docker Deployment

```bash
# Build Docker image
docker build -t hospital-ai .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e REDIS_URL="..." \
  hospital-ai
```

### View Twilio Logs

```
https://console.twilio.com/us1/monitor/logs
```

### View Groq API Usage

```
https://console.groq.com/keys
```

### View SendGrid Logs

```
https://app.sendgrid.com/email_activity
```

---

## Performance Tips

### Optimize Database Queries

```typescript
// Good: Only select what you need
const lead = await prisma.lead.findUnique({
  where: { id: leadId },
  select: { id: true, phone: true, email: true } // ✅
});

// Bad: Select everything
const lead = await prisma.lead.findUnique({
  where: { id: leadId }
  // includes all fields
});
```

### Use Batch Operations

```typescript
// Good: Batch multiple operations
await Promise.all([
  prisma.conversation.create(...),
  prisma.activity.create(...),
  prisma.message.create(...)
]);

// Bad: Sequential operations (slower)
await prisma.conversation.create(...);
await prisma.activity.create(...);
await prisma.message.create(...);
```

### Limit Database Results

```typescript
// Good: Paginate results
const conversations = await prisma.conversation.findMany({
  where: { organizationId },
  take: 50,
  skip: 0,
  orderBy: { createdAt: 'desc' }
});

// Bad: Fetch all records
const conversations = await prisma.conversation.findMany({
  where: { organizationId }
});
```

---

## API Rate Limits (Configured)

```
Twilio: Default account limits
Groq: Depends on your plan
SendGrid: Depends on your plan
Redis: BullMQ rate limited to 5 calls/minute (configurable)
```

---

## Scalability Levels

### Level 1: Small Hospital (< 1000 calls/day)
- ✅ Single Vercel deployment
- ✅ Managed database (Vercel Postgres)
- ✅ Redis add-on (Upstash)
- **Cost: $20-50/month**

### Level 2: Medium Hospital (1000-10000 calls/day)
- ✅ Vercel deployment with auto-scale
- ✅ Dedicated database (AWS RDS)
- ✅ Managed Redis (AWS ElastiCache)
- **Cost: $100-300/month**

### Level 3: Large Hospital (10000+ calls/day)
- ✅ Multi-region Vercel deployment
- ✅ Dedicated database cluster
- ✅ Redis cluster
- ✅ CDN for assets
- **Cost: $500+/month**

---

## Backup & Recovery

### Daily Database Backup
```bash
# Using pg_dump
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Conversation Export
Users can export conversations from Dashboard:
1. Select conversation
2. Click "Export"
3. Get PDF with full history

---

## Security Checklist

Before Production:

- [ ] All API keys rotated and secure
- [ ] CORS policies reviewed
- [ ] SSL certificate installed
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] SQL injection prevention (Prisma)
- [ ] XSS protection enabled
- [ ] Passwords hashed
- [ ] 2FA enabled for critical accounts
- [ ] Database backups automated
- [ ] Error logs don't expose secrets
- [ ] API keys not in code/logs

---

## Performance Benchmarks

**Expected Response Times:**

| Operation | Time |
|-----------|------|
| Voice call initiation | < 2s |
| AI response (Groq) | 1-3s |
| Chat response | 1-2s |
| Database query | < 100ms |
| Page load | 1-2s |
| WhatsApp message send | < 5s |
| Email send | < 10s |

---

## Troubleshooting Flowchart

```
Is the system not working?
│
├─ → No TypeScript errors?
│   └─ YES → Check next ✅
│
├─ → All env vars set?
│   └─ YES → Check next ✅
│
├─ → Database connected?
│   └─ YES (via Prisma Studio) → Check next ✅
│
├─ → Redis connected?
│   └─ YES → Check next ✅
│
├─ → Can make calls on Twilio?
│   └─ YES → Check logs in /pages/console
│
└─ → Check Vercel/deployment logs
    └─ Errors will be visible there
```

---

## Useful Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Check code quality

# Database
npx prisma studio       # Open database UI
npx prisma generate     # Generate Prisma client
npx prisma migrate dev  # Create migration
npx prisma migrate deploy # Run migrations

# Deployment
vercel deploy            # Deploy to Vercel
vercel logs             # View deployment logs

# Cleanup
rm -rf .next node_modules
npm install              # Clean install
npm run build           # Rebuild
```

---

## Support Resources

- **Twilio Docs:** https://www.twilio.com/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Groq Console:** https://console.groq.com
- **Database:** Check PostgreSQL docs for your provider
- **Redis:** Check ioredis docs

---

## Project File Organization

```
u8u-ai/
├── src/
│   ├── app/
│   │   ├── api/                 # API routes
│   │   │   ├── twilio/         # Voice calls
│   │   │   ├── agent/          # Chat AI
│   │   │   ├── dialer/         # Auto-dialer
│   │   │   ├── whatsapp/       # WhatsApp
│   │   │   ├── conversations/  # Chat history
│   │   │   └── ...other routes
│   │   └── dashboard/          # UI pages
│   ├── lib/
│   │   ├── agents/             # AI logic
│   │   ├── queue/              # BullMQ queue
│   │   ├── twilio.ts           # Twilio integration
│   │   ├── prisma.ts           # Database
│   │   └── voice/              # Language configs
│   ├── components/             # React components
│   └── types/                  # TypeScript types
├── prisma/
│   └── schema.prisma           # Database schema
├── package.json
└── tsconfig.json
```

---

**Last Updated:** April 16, 2026  
**Status:** ✅ Production Ready

