# Multi-Provider SMS & WhatsApp Integration Guide

## 📋 Overview
Currently your system uses **Twilio** for all SMS and WhatsApp messaging. To add another provider (like Unique Digital Outreach Service), you need to:

1. Add the new provider's API key to environment variables
2. Create wrapper functions for the new provider
3. Create a provider abstraction layer
4. Update all calling code to support multiple providers
5. Add provider selection logic

---

## 🔧 Step-by-Step Implementation Plan

### STEP 1: Add Environment Variables

**File:** `.env.local` (or your environment config)

```bash
# Existing Twilio
TWILIO_ACCOUNT_SID=xxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# New Provider: Unique Digital Outreach Service (UDO)
UDO_API_KEY=your_api_key_here
UDO_API_URL=https://api.uniquedigitaloutreach.com
UDO_PHONE_NUMBER=91xxxxxxxxxx  # Your UDO number
UDO_WHATSAPP_ACCOUNT_ID=your_account_id

# Provider Selection (default to Twilio, can be overridden)
SMS_PROVIDER=twilio  # or "udo"
WHATSAPP_PROVIDER=twilio  # or "udo"
```

---

### STEP 2: Create Provider Abstraction Layer

**File to CREATE:** `src/lib/messaging/providers.ts`

```typescript
// Provider interface - both Twilio and UDO must implement this
export interface MessagingProvider {
  sendSMS(phone: string, message: string): Promise<MessageResponse>;
  sendWhatsApp(phone: string, message: string): Promise<MessageResponse>;
}

export interface MessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  providerStatus?: string;
  isTrialAccountError?: boolean;
}

// Factory to get the right provider
export function getSMSProvider(): MessagingProvider {
  const provider = process.env.SMS_PROVIDER || 'twilio';
  if (provider === 'udo') {
    return new UDOProvider();
  }
  return new TwilioProvider();
}

export function getWhatsAppProvider(): MessagingProvider {
  const provider = process.env.WHATSAPP_PROVIDER || 'twilio';
  if (provider === 'udo') {
    return new UDOProvider();
  }
  return new TwilioProvider();
}
```

---

### STEP 3: Refactor Twilio Functions

**File to MODIFY:** `src/lib/twilio.ts`

Split into:
- Keep Twilio-specific code → Create `src/lib/messaging/twilio-provider.ts`
- Keep language detection, sub-agent detection, etc. → Keep in `twilio.ts`

**New file:** `src/lib/messaging/twilio-provider.ts`
```typescript
import twilio from 'twilio';
import { MessagingProvider, MessageResponse } from './providers';

export class TwilioProvider implements MessagingProvider {
  private client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  async sendSMS(phone: string, message: string): Promise<MessageResponse> {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER || '+15551234567',
        to: phone,
      });
      return { success: true, messageId: result.sid };
    } catch (error: any) {
      const isTrialError = error.code === 21608 || error.message?.includes('unverified');
      return { 
        success: false, 
        error: error.message,
        isTrialAccountError: isTrialError
      };
    }
  }

  async sendWhatsApp(phone: string, message: string): Promise<MessageResponse> {
    try {
      const fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || '14155238886'}`;
      const toNumber = `whatsapp:${phone}`;
      
      const result = await this.client.messages.create({
        body: message,
        from: fromNumber,
        to: toNumber,
      });
      return { 
        success: true, 
        messageId: result.sid,
        providerStatus: result.status ?? 'queued'
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || 'Failed to send WhatsApp message'
      };
    }
  }
}
```

---

### STEP 4: Create New Provider (UDO)

**File to CREATE:** `src/lib/messaging/udo-provider.ts`

```typescript
import { MessagingProvider, MessageResponse } from './providers';
import axios from 'axios';

export class UDOProvider implements MessagingProvider {
  private apiKey = process.env.UDO_API_KEY!;
  private apiUrl = process.env.UDO_API_URL!;
  private phoneNumber = process.env.UDO_PHONE_NUMBER!;

  async sendSMS(phone: string, message: string): Promise<MessageResponse> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/sms/send`,
        {
          phone_number: phone,
          message: message,
          from: this.phoneNumber,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: response.data.success || response.status === 200,
        messageId: response.data.message_id || response.data.id,
        providerStatus: response.data.status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  async sendWhatsApp(phone: string, message: string): Promise<MessageResponse> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/whatsapp/send`,
        {
          recipient: phone,
          message: message,
          account_id: process.env.UDO_WHATSAPP_ACCOUNT_ID,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: response.data.success || response.status === 200,
        messageId: response.data.message_id || response.data.id,
        providerStatus: response.data.status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }
}
```

---

### STEP 5: Update Core Messaging Functions

**File to MODIFY:** `src/lib/twilio.ts`

Replace the old `sendWhatsAppMessage` and `sendSMSMessage` functions:

```typescript
import { getSMSProvider, getWhatsAppProvider } from './messaging/providers';

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; providerStatus?: string; error?: string }> {
  const provider = getWhatsAppProvider();
  const result = await provider.sendWhatsApp(phoneNumber, message);
  return result;
}

export async function sendSMSMessage(
  phoneNumber: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string; isTrialAccountError?: boolean }> {
  const provider = getSMSProvider();
  const result = await provider.sendSMS(phoneNumber, message);
  return result;
}
```

---

### STEP 6: Files That Use These Functions (No Changes Needed)

These files call `sendWhatsAppMessage()` and `sendSMSMessage()` - they'll **automatically work** with the new provider system:

✅ `src/app/api/patients/contact/route.ts` - Send direct messages
✅ `src/app/api/appointments/confirm/route.ts` - Confirmation reminders
✅ `src/app/api/appointments/reminder/route.ts` - Appointment reminders
✅ `src/app/api/reminders/send/route.ts` - Auto reminders

---

## 📁 File Structure After Implementation

```
src/lib/
├── twilio.ts (MODIFY - keep language detection)
├── messaging/
│   ├── providers.ts (CREATE - interface & factory)
│   ├── twilio-provider.ts (CREATE - move Twilio code here)
│   └── udo-provider.ts (CREATE - new provider)
```

---

## 🔄 How It Works

### Current Flow (Twilio Only):
```
Send SMS Request
    ↓
sendSMSMessage() [in twilio.ts]
    ↓
twilioClient.messages.create()
    ↓
Message Sent
```

### New Flow (Multi-Provider):
```
Send SMS Request
    ↓
sendSMSMessage() [in twilio.ts - updated]
    ↓
getSMSProvider() [checks env: SMS_PROVIDER]
    ↓
┌─────────────────────┐
│ If SMS_PROVIDER=udo │ → UDOProvider.sendSMS()
└─────────────────────┘
        OR
┌──────────────────────────┐
│ If SMS_PROVIDER=twilio   │ → TwilioProvider.sendSMS()
└──────────────────────────┘
    ↓
Message Sent
```

---

## ✅ Checklist

- [ ] Get UDO API credentials (API Key, URLs, account IDs)
- [ ] Add environment variables (.env.local)
- [ ] Create `src/lib/messaging/providers.ts`
- [ ] Create `src/lib/messaging/twilio-provider.ts`
- [ ] Create `src/lib/messaging/udo-provider.ts`
- [ ] Update `src/lib/twilio.ts` export functions
- [ ] Install axios: `npm install axios`
- [ ] Test with SMS_PROVIDER=udo in .env
- [ ] Test with WHATSAPP_PROVIDER=udo in .env
- [ ] Add fallback logic (if one provider fails, retry with another)

---

## 🎯 Environment Config Examples

### Use Twilio for SMS, UDO for WhatsApp:
```bash
SMS_PROVIDER=twilio
WHATSAPP_PROVIDER=udo
```

### Use UDO for Everything:
```bash
SMS_PROVIDER=udo
WHATSAPP_PROVIDER=udo
```

### Use Twilio for Everything (Default):
```bash
SMS_PROVIDER=twilio
WHATSAPP_PROVIDER=twilio
```

---

## 🚀 Advanced: Fallback Provider (Optional)

You can add automatic fallback:

```typescript
export async function sendSMSWithFallback(phone: string, message: string) {
  const primaryProvider = getSMSProvider();
  const result = await primaryProvider.sendSMS(phone, message);
  
  if (!result.success && process.env.SMS_PROVIDER !== 'twilio') {
    console.log('Primary SMS provider failed, trying Twilio fallback...');
    const fallbackProvider = new TwilioProvider();
    return fallbackProvider.sendSMS(phone, message);
  }
  
  return result;
}
```

---

## 📝 Notes

- Both providers must implement the same interface
- The calling code doesn't need to change
- You can switch providers by just changing an env variable
- Add error logging to track which provider was used
- Consider adding provider usage analytics
