# WhatsApp Messaging Setup & Troubleshooting Guide

## ✅ Quick Diagnostics Checklist

### 1. **Environment Variables** 
Check these are set in `.env.local`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+12015551234  # Your Twilio WhatsApp sandbox number
TWILIO_PHONE_NUMBER=+1234567890  # For SMS fallback
```

**To find these credentials:**
- Go to [Twilio Console](https://www.twilio.com/console)
- Copy Account SID from dashboard
- Copy Auth Token (regenerate if lost)

### 2. **Patient Phone Number Format**
Must be in **E.164 format**: `+[Country Code][Phone Number]`

✅ **Correct examples:**
- `+919876543210` (India)
- `+14155551234` (USA)
- `+44207123456` (UK)

❌ **Incorrect formats:**
- `919876543210` (missing +)
- `+91 98765 43210` (spaces)
- `9876543210` (no country code)

**Fix patient phone:**
```sql
-- Check patient phone format
SELECT id, fullName, phone FROM "Patient" LIMIT 5;

-- Fix incorrect format
UPDATE "Patient" SET phone = '+919876543210' WHERE id = '{patient_id}';
```

### 3. **Twilio WhatsApp Sandbox Setup**

If using sandbox (not production):

**a) Join the sandbox on WhatsApp:**
- Send this message to WhatsApp number: `+1 (415) 523-8886`
- Message: `join [your-join-code]` (check Twilio console for code)

**b) Verify sandbox is active:**
```bash
# Check Twilio WhatsApp setup
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/ACxxxxxxx/Messages.json?Limit=10" \
  -u "ACxxxxxxx:your_auth_token"
```

### 4. **Test Appointment Workflow**

**Step 1:** Create a new appointment
```bash
POST /api/appointments/book
{
  "patientId": "{valid_patient_id}",
  "appointmentType": "OPD",
  "appointmentType": "OPD",
  "scheduledAt": "2026-04-15T14:00:00Z"
}
```

**Step 2:** Confirm the appointment
```bash
POST /api/appointments/confirm
{
  "appointmentId": "{appointment_id}"
}
```

**Step 3:** Send reminders
```bash
POST /api/reminders/send
```

### 5. **Check Server Logs**

Look for these log messages in your Next.js terminal:

**✅ Success sequence:**
```
[WhatsApp Sending] { from: 'whatsapp:+12015551234', to: 'whatsapp:+919876543210', messageLength: 124 }
[WhatsApp Success] { sid: 'SMxxxxxxxxxxxxxxxx...' }
```

**❌ Failure indicators:**
```
[WhatsApp Send Error] { message: 'Invalid phone number', code: 21211 }
[WhatsApp Send Error] { message: 'Account not activated for WhatsApp', code: 20003 }
[WhatsApp Send Error] { message: 'Invalid credentials', code: 20003 }
```

## 🔧 Common Issues & Fixes

### Issue 1: "Unauthorized (401)" Error
**Cause:** Invalid Twilio credentials

**Fix:**
1. Regenerate Auth Token in Twilio Console
2. Update `.env.local`
3. Restart Next.js dev server
4. Test again

### Issue 2: "Invalid phone number (21211)" Error
**Cause:** Phone number format incorrect

**Fix:**
1. Check patient phone format (must be E.164)
2. Update patient phone: `+` + Country Code + Phone Number
3. Remove spaces and dashes

### Issue 3: "Account not activated for WhatsApp (20003)" Error
**Cause:** Twilio WhatsApp not activated for your account

**Fix:**
1. Go to Twilio Console → Messaging → Try it out
2. Click "Get started with WhatsApp"
3. Follow activation steps
4. Wait for approval (usually instant for sandbox)
5. Restart server

### Issue 4: "No pending reminders" or Messages not queuing
**Cause:** Appointment status not `SCHEDULED` or reminder not created

**Fix:**
1. Verify appointment status: `SELECT status FROM "Appointment" WHERE id = '{id}'`
2. Should be: `SCHEDULED` (uppercase in database)
3. Check ReminderLog created: `SELECT * FROM "ReminderLog" WHERE appointmentId = '{id}'`
4. If missing, appointment confirm endpoint issue

### Issue 5: Patient receiving test WhatsApp but not appointment notification
**Cause:** Different phone number or sandbox not joined

**Fix:**
1. Verify patient phone matches WhatsApp account
2. Patient must join sandbox: `+1 (415) 523-8886` → `join [code]`
3. Wait 5-10 seconds for first message (sandbox delay)

## 📱 Testing WhatsApp Message Directly

### Test 1: Send via API
```bash
curl -X POST http://localhost:3000/api/reminders/send \
  -H "Content-Type: application/json" \
  -d "{}"
```

### Test 2: Manual Test in Twilio Console
1. Go to Twilio Console → Messaging → Send a test WhatsApp
2. Recipient: `+919876543210`
3. Message: "Test from hospital system"
4. Click Send
5. Message should appear on patient's WhatsApp within 5 seconds

### Test 3: Check Message Status
```bash
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/ACxxxxxxx/Messages.json?Limit=20" \
  -u "ACxxxxxxx:your_auth_token" | grep -A 5 "status"
```

Expected status progression:
- `queued` → `sent` → `delivered` ✅
- `failed` → Check error message ❌

## 🚀 Production Deployment

Before going live:

1. **Upgrade Twilio WhatsApp** (from sandbox)
   - Go to Whatsapp Settings → Upgrade to Production
   - Follow WhatsApp Business verification steps

2. **Update `.env.local` with production numbers**
   ```env
   TWILIO_WHATSAPP_NUMBER=whatsapp:+[your_verified_number]
   ```

3. **Test with real phone number**
   - Send test appointment
   - Confirm appointment
   - Verify WhatsApp received within 10 seconds

4. **Monitor first 24 hours**
   - Check server logs for errors
   - Watch appointment confirmations
   - Monitor WhatsApp delivery status in Twilio Console

## 📊 Monitoring & Logs

### View Recent Messages (Last 10)
```bash
curl -s "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json?Limit=10" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | jq '.messages[] | {to, from, status, date_sent, error_message}'
```

### Filter by Status
```bash
# View failed messages
curl -s "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | jq '.messages[] | select(.status == "failed")'
```

## 🎯 Full End-to-End Test

```bash
# 1. Create patient
curl -X POST http://localhost:3000/api/patients/create \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Patient",
    "phone": "+919876543210",
    "email": "test@example.com"
  }'
# Save: {patient_id}

# 2. Book appointment
curl -X POST http://localhost:3000/api/appointments/book \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "{patient_id}",
    "appointmentType": "OPD",
    "scheduledAt": "2026-04-15T14:00:00Z"
  }'
# Save: {appointment_id}

# 3. Confirm appointment (triggers reminder)
curl -X POST http://localhost:3000/api/appointments/confirm \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": "{appointment_id}"}'

# 4. Check server logs for [WhatsApp Success]

# 5. Verify message received on patient's WhatsApp (within 10 seconds)
```

## ❓ Still Not Working?

### Check These in Order:
1. ✅ `.env.local` file saved and variables correct
2. ✅ Next.js server restarted after env changes
3. ✅ Patient phone format: `+919876543210` (with +)
4. ✅ Appointment status: `SCHEDULED` in database
5. ✅ ReminderLog created for appointment
6. ✅ Server logs show `[WhatsApp Sending]` message
7. ✅ Patient WhatsApp account joined sandbox (if sandbox)
8. ✅ Twilio console shows "Sent" status in message list

### Debug with Environment variables

```bash
# Copy these to verify in your dev server
printenv | grep TWILIO

# Should output:
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=your_token_here
# TWILIO_WHATSAPP_NUMBER=whatsapp:+xxxxxxxxxxxx
```

### Still Stuck?

1. Check Twilio Console Activity Log for API errors
2. Verify appointment has doctor assigned
3. Check patient phone exists and is not null
4. Ensure Clerk authentication working (needed for API calls)

---

## 📝 Reference: WhatsApp Integration Flow

```
1. Patient Added (phone: +919876543210)
           ↓
2. Appointment Booked (status: SCHEDULED)
           ↓
3. Appointment Confirmed (status: CONFIRMED)
           ↓
4. ReminderLog Created (status: PENDING, channel: WHATSAPP)
           ↓
5. POST /api/reminders/send triggered
           ↓
6. Twilio Client sends WhatsApp message
           ↓
7. Message delivered to +919876543210
           ↓
8. ReminderLog status updated to SENT
           ↓
9. Patient receives: "Your appointment confirmed on [date] at [time]..."
```

Let me know if you need help with any specific step!
