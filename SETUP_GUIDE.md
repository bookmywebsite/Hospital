# Hospital Dashboard Setup Guide

## Overview
This guide helps you set up the hospital dashboard with sample doctors, test WhatsApp notifications, and verify the appointment confirmation system.

---

## 1. Add Sample Doctors to Database

### Using the Seed Script

Run the seed script to add 6 sample doctors with different specializations:

```bash
# From the project root
npm run seed-doctors
# or
yarn seed-doctors
```

**Doctors that will be added:**
- 🏥 Dr. Rajesh Kumar (Cardiology)
- 🧠 Dr. Priya Sharma (Neurology)
- 🦴 Dr. Arjun Singh (Orthopedics)
- 👶 Dr. Anjali Patel (Pediatrics)
- 💊 Dr. Vikram Desai (General Medicine)
- 🧴 Dr. Meera Gupta (Dermatology)

Each doctor has working hours and availability configured.

### Using Prisma Studio (Alternative)

```bash
npx prisma studio
```

Then manually add doctors through the UI.

---

## 2. Test Appointment Confirmation

### Step 1: Create an Appointment
1. Go to **Dashboard → Appointments → Patient CRM**
2. Click "Book Appt" on any patient
3. Select date, time, and appointment type
4. Click "Book Appointment"

### Step 2: Confirm the Appointment
1. Go back to **Appointments** tab
2. Find the appointment with status **"Pending"**
3. Click the green **"✓ Confirm"** button
4. Wait for success alert
5. Check that:
   - Status changed to "Confirmed" ✅
   - Reference ID shows (last 6 chars of appointment ID)
   - Doctor name is displayed (not "Unassigned")

---

## 3. Configure WhatsApp/SMS Notifications

### Check Environment Variables

Verify these are set in `.env.local`:

```env
# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890        # For SMS
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890  # For WhatsApp

# App URL (for internal API calls)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### For Twilio Sandbox (Development)

If using the Twilio WhatsApp Sandbox:

1. Go to [Twilio Console → WhatsApp Sandbox](https://console.twilio.com/us/account/messaging/whatsapp/learn)
2. Find your **From Number**: `+14155238886`
3. Send the join code to your phone (e.g., "join fuzzy-magic")
4. Once joined, WhatsApp messages will work from that number

### For Production

1. Request WhatsApp Business Account integration
2. Set `TWILIO_WHATSAPP_NUMBER` to your business number
3. Ensure phone numbers are verified

---

## 4. Troubleshooting

### WhatsApp Messages Not Sending

**Check logs:**
```bash
# In browser console (F12 → Console tab)
# Look for: [Confirm Button], [Confirm Response], [WhatsApp Send Result]

# In server logs
# Look for: [WhatsApp Sending], [WhatsApp Success], [WhatsApp Send Error]
```

**Common Issues:**

| Issue | Solution |
|-------|----------|
| "Unknown field `phone`" | ✅ Fixed - Doctor model doesn't have phone field |
| Messages not sent | Check `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` |
| Phone number invalid | Ensure patient phone starts with country code (+91 for India) |
| Sandbox number | Use `+14155238886` if in Twilio sandbox |

### Doctors Showing as "Unassigned"

1. Run seed script: `npm run seed-doctors`
2. Verify database has doctors:
   ```bash
   npx prisma studio  # Check Doctor model
   ```
3. When booking appointment, assign a doctor

### Confirmation Button Not Showing

- Ensure appointment status is "Pending"
- Confirm button appears only for pending appointments
- Once confirmed, "Reschedule" button appears

---

## 5. Database Schema Reference

### Doctor Model
```typescript
model Doctor {
  id             String         // Unique ID
  name           String         // Dr. Name
  specialization String?        // Cardiology, Neurology, etc.
  availability   Json?          // Day → Hours mapping
  isActive       Boolean        // Active/Inactive
  organizationId String
  departmentId   String
  appointments   Appointment[] // Linked appointments
}
```

### Appointment Model Fields
```typescript
{
  id: String              // Unique appointment ID
  status: "SCHEDULED" | "CONFIRMED" | "REMINDER_SENT" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  appointmentType: String // OPD, Consultation, Follow-up, Procedure, Urgent
  scheduledAt: DateTime   // Appointment date/time
  patient: Patient        // Patient details
  doctor: Doctor?         // Assigned doctor
  department: Department  // Department
  notes: String?          // Additional notes
}
```

---

## 6. API Endpoints

### Confirm Appointment
```bash
POST /api/appointments/confirm
Content-Type: application/json

{
  "appointmentId": "cmntuzmgu0005r5pm8xfflm3k"
}

Response:
{
  "success": true,
  "appointment": { ... }
}
```

### Send Reminders
```bash
POST /api/reminders/send

# Automatically called when appointment is confirmed
# Processes all PENDING reminders and sends via Twilio
```

---

## 7. Next Steps

- [ ] Run seed script to add doctors
- [ ] Configure Twilio credentials
- [ ] Test appointment confirmation
- [ ] Verify WhatsApp messaging (check server logs)
- [ ] Add doctor assignments to appointments
- [ ] Set up SMS fallback if WhatsApp fails
- [ ] Implement appointment reminders (day before)
- [ ] Add reschedule/cancel functionality

---

## 8. Contact Support

If WhatsApp isn't sending:
1. Check browser console (F12) for errors
2. Check server logs for "[WhatsApp Send Result]"
3. Verify Twilio credentials in `.env.local`
4. Check that patient phone includes country code

For Twilio help: [Twilio Docs](https://www.twilio.com/docs/whatsapp)
