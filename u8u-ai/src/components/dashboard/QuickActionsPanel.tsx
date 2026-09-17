'use client';
import { useState, useEffect } from 'react';
import {
  Phone, Mail, MessageSquare, ListChecks,
  X, PhoneCall, Send, Clock,
  ChevronRight, Loader2, Building2, Radio, Globe,
} from 'lucide-react';
import { getVoiceConfig } from '@/lib/voice/language-config';

// WhatsApp SVG icon
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// Supported Indian languages
const LANGUAGES = [
  { code: 'EN', name: 'English', nativeName: 'English' },
  { code: 'HI', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'TA', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'TE', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'KN', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ML', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'MR', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'BN', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'GU', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'PA', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'OR', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
];

interface Lead {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phone?: string | null;
  score?: number | null;
  tier?: string | null;
  status: string;
}

interface Conversation {
  id: string;
  channel: string;
  status: string;
  lastMessageAt?: string | null;
  messageCount: number;
  startedAt: string;
}

interface Sequence {
  id: string;
  name: string;
  isActive: boolean;
}

interface QuickActionsPanelProps {
  lead: Lead;
  agentId: string;
  onClose: () => void;
}

export function QuickActionsPanel({ lead, agentId, onClose }: QuickActionsPanelProps) {
  const [activeTab, setActiveTab] = useState<'actions' | 'history'>('actions');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loadingCall, setLoadingCall] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingWA, setLoadingWA] = useState(false);
  const [loadingDialer, setLoadingDialer] = useState(false);
  const [loadingEnroll, setLoadingEnroll] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<string | null>(null);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [waResult, setWaResult] = useState<string | null>(null);
  const [dialerResult, setDialerResult] = useState<string | null>(null);
  const [enrollResult, setEnrollResult] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [callLanguage, setCallLanguage] = useState('EN'); // language for instant call
  const [dialerLanguage, setDialerLanguage] = useState('EN'); // language for dialer queue

  useEffect(() => {
    fetchConversations();
    fetchSequences();
  }, [lead.id]);

  async function fetchConversations() {
    try {
      const res = await fetch(`/api/leads/${lead.id}/conversations`);
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch { }
  }

  async function fetchSequences() {
    try {
      const res = await fetch('/api/email/sequences-list');
      const data = await res.json();
      if (data.success) {
        setSequences(data.sequences ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch sequences:', error);
    }
  }

  async function handleCall() {
    setLoadingCall(true);
    setCallResult(null);
    try {
      const res = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, agentId, language: getVoiceConfig(callLanguage).twilioLanguage }),
      });
      const data = await res.json().catch(() => ({}));
      const apiError = data?.error || data?.providerError;
      setCallResult(
        data?.success
          ? `✅ Call initiated to ${data.phone} [${callLanguage}]`
          : `❌ ${apiError || (res.ok ? 'Call failed' : `Call failed (${res.status})`)}`
      );
      if (data.success) fetchConversations();
    } catch (error: any) {
      setCallResult(`❌ Failed to initiate call${error?.message ? `: ${error.message}` : ''}`);
    } finally {
      setLoadingCall(false);
    }
  }

  async function handleDialerQueue() {
    if (!lead.phone) {
      setDialerResult('❌ Lead has no phone number');
      return;
    }
    setLoadingDialer(true);
    setDialerResult(null);
    try {
      await fetch('/api/dialer/worker', { method: 'POST' });

      const body: any = { leadId: lead.id, agentId, language: getVoiceConfig(dialerLanguage).twilioLanguage };
      if (scheduleTime) body.scheduledFor = new Date(scheduleTime).toISOString();

      const res = await fetch('/api/dialer/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setDialerResult(
          scheduleTime
            ? `✅ Call scheduled [${dialerLanguage}] for ${new Date(scheduleTime).toLocaleTimeString('en-IN')}`
            : `✅ Added to dialer queue [${dialerLanguage}] — calling shortly`
        );
        fetchConversations();
      } else {
        setDialerResult(`❌ ${data.error ?? 'Dialer failed'}`);
      }
    } catch {
      setDialerResult('❌ Failed to queue call');
    } finally {
      setLoadingDialer(false);
    }
  }

  async function handleEmail() {
    setLoadingEmail(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, agentId, useAI: true }),
      });
      const data = await res.json();
      setEmailResult(data.success
        ? '✅ AI email sent successfully'
        : `❌ ${data.error ?? 'Email failed'}`
      );
    } catch {
      setEmailResult('❌ Failed to send email');
    } finally {
      setLoadingEmail(false);
    }
  }

  async function handleWhatsApp() {
    if (!lead.phone) { setWaResult('❌ Lead has no phone number'); return; }
    setLoadingWA(true);
    setWaResult(null);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, agentId, useAI: true }),
      });
      const data = await res.json();
      if (data.success) {
        setWaResult('✅ WhatsApp message sent — lead can now chat with PrimePro');
        window.open(`https://wa.me/${lead.phone.replace('+', '')}`, '_blank');
      } else {
        setWaResult(`❌ ${data.error ?? 'WhatsApp failed'}`);
      }
    } catch {
      setWaResult('❌ Failed to send WhatsApp message');
    } finally {
      setLoadingWA(false);
    }
  }

  function openWhatsAppChat() {
    if (!lead.phone) { setWaResult('❌ Lead has no phone number'); return; }
    const hospitalWhatsAppNumber =
      process.env.NEXT_PUBLIC_EXOTEL_WHATSAPP_NUMBER ||
      process.env.NEXT_PUBLIC_EXOTEL_VIRTUAL_NUMBER ||
      process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
      '14155238886';
    const joinKeyword = process.env.NEXT_PUBLIC_WHATSAPP_JOIN_KEYWORD ?? 'join your-keyword';
    window.open(`https://wa.me/${hospitalWhatsAppNumber.replace(/^\+/, '')}?text=${encodeURIComponent(joinKeyword)}`, '_blank');
  }

  async function handleEnroll(sequenceId: string) {
    setLoadingEnroll(sequenceId);
    setEnrollResult(null);
    try {
      const res = await fetch('/api/email/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sequenceId, 
          leadId: lead.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEnrollResult(`✅ Lead enrolled in "${data.enrollment.sequenceName}" — emails will send automatically`);
      } else {
        setEnrollResult(`❌ ${data.error ?? 'Enrollment failed'}`);
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      setEnrollResult('❌ Failed to enroll');
    } finally {
      setLoadingEnroll(null);
    }
  }

  const tierColor: Record<string, string> = {
    HOT: 'bg-red-100 text-red-700',
    WARM: 'bg-orange-100 text-orange-700',
    COLD: 'bg-blue-100 text-blue-700',
  };

  const statusColor: Record<string, string> = {
    NEW: 'bg-gray-100 text-gray-600',
    CONTACTED: 'bg-blue-100 text-blue-700',
    ENGAGED: 'bg-indigo-100 text-indigo-700',
    QUALIFIED: 'bg-green-100 text-green-700',
    MEETING_SET: 'bg-purple-100 text-purple-700',
    WON: 'bg-emerald-100 text-emerald-700',
    LOST: 'bg-red-100 text-red-600',
  };

  // Reusable language select component
  function LangSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
          <Globe className="w-3 h-3" /> Call language
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%', padding: '6px 10px', borderRadius: '8px',
            border: '1px solid #d1d5db', background: '#fff',
            color: '#111', fontSize: '12px', outline: 'none',
            cursor: 'pointer',
          }}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name} — {lang.nativeName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white font-bold text-lg">
                {lead.firstName?.[0] ?? lead.email[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg leading-tight">
                  {lead.firstName ?? ''} {lead.lastName ?? ''}
                  {!lead.firstName && !lead.lastName && lead.email}
                </h2>
                <p className="text-white/70 text-sm">{lead.email}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lead meta */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {lead.company && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-white/80 text-xs">
                <Building2 className="w-3 h-3" />{lead.company}
              </div>
            )}
            {lead.tier && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${tierColor[lead.tier] ?? 'bg-gray-100'}`}>
                {lead.tier === 'HOT' ? '🔥' : lead.tier === 'WARM' ? '🌤️' : '❄️'} {lead.tier}
              </span>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[lead.status] ?? 'bg-gray-100'}`}>
              {lead.status}
            </span>
            {lead.score != null && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 text-white">
                Score: {lead.score}/100
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          {(['actions', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors capitalize ${activeTab === tab
                  ? 'text-violet-600 border-b-2 border-violet-600'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab === 'history' ? (
                <>History {conversations.length > 0 && (
                  <span className="ml-1.5 bg-violet-100 text-violet-600 text-xs px-1.5 py-0.5 rounded-full">
                    {conversations.length}
                  </span>
                )}</>
              ) : 'Quick Actions'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {activeTab === 'actions' && (
            <>
              {/* No phone warning */}
              {!lead.phone && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 shrink-0" />
                  No phone number — add one to enable Call, Dialer & WhatsApp
                </div>
              )}

              {/* ── Instant Voice Call ── */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100">
                    <PhoneCall className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Instant AI Call</p>
                    <p className="text-xs text-gray-500">Call now — PrimePro qualifies via BANT</p>
                  </div>
                </div>
                {lead.phone && <p className="text-xs text-gray-500 mb-3">📞 {lead.phone}</p>}

                {/* Language selector for instant call */}
                <LangSelect value={callLanguage} onChange={setCallLanguage} />

                <button
                  onClick={handleCall}
                  disabled={loadingCall || !lead.phone}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingCall
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Calling...</>
                    : <><PhoneCall className="w-4 h-4" /> Call Now in {LANGUAGES.find(l => l.code === callLanguage)?.name}</>}
                </button>
                {callResult && <p className="mt-2 text-xs text-center text-gray-600">{callResult}</p>}
              </div>

              {/* ── Auto-Dialer Queue ── */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100">
                    <Radio className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Auto-Dialer Queue</p>
                    <p className="text-xs text-gray-500">Queue call with retry logic — up to 3 attempts</p>
                  </div>
                </div>
                {lead.phone && <p className="text-xs text-gray-500 mb-3">📞 {lead.phone}</p>}

                {/* Language selector for dialer */}
                <LangSelect value={dialerLanguage} onChange={setDialerLanguage} />

                {/* Schedule time */}
                <div className="mb-3">
                  <label className="text-xs text-gray-500 mb-1 block">Schedule for (optional)</label>
                  <input
                    type="datetime-local"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: '8px',
                      border: '1px solid #d1d5db', background: '#fff',
                      color: '#111', fontSize: '12px', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button
                  onClick={handleDialerQueue}
                  disabled={loadingDialer || !lead.phone}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingDialer
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Queuing...</>
                    : <><Radio className="w-4 h-4" /> {scheduleTime ? 'Schedule Call' : 'Add to Dialer Queue'}</>}
                </button>
                {dialerResult && <p className="mt-2 text-xs text-center text-gray-600">{dialerResult}</p>}
                <p className="mt-2 text-xs text-gray-400 text-center">
                  Respects calling hours (9am–9pm IST) · Auto-retries on no-answer · Auto-detects language
                </p>
              </div>

              {/* ── WhatsApp ── */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100">
                    <WhatsAppIcon className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">WhatsApp AI Chat</p>
                    <p className="text-xs text-gray-500">Send AI message — lead chats with PrimePro</p>
                  </div>
                </div>
                {lead.phone && <p className="text-xs text-gray-500 mb-3">📱 {lead.phone}</p>}
                <div className="space-y-2">
                  <button
                    onClick={handleWhatsApp}
                    disabled={loadingWA || !lead.phone}
                    className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#20bd5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingWA
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                      : <><WhatsAppIcon className="w-4 h-4" /> Send AI Opening Message</>}
                  </button>
                  <button
                    onClick={openWhatsAppChat}
                    className="w-full flex items-center justify-center gap-2 border border-[#25D366] text-[#25D366] rounded-xl py-2.5 text-sm font-medium hover:bg-green-50 transition-colors"
                  >
                    <WhatsAppIcon className="w-4 h-4" /> Open WhatsApp Chat
                  </button>
                </div>
                {waResult && <p className="mt-2 text-xs text-center text-gray-600">{waResult}</p>}
                <p className="mt-3 text-xs text-gray-400 text-center">
                  Lead must first send the sandbox join keyword to receive messages
                </p>
              </div>

              {/* ── Email ── */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
                    <Send className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Send AI Email</p>
                    <p className="text-xs text-gray-500">Groq generates personalised email via SendGrid</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-3">✉️ {lead.email}</p>
                <button
                  onClick={handleEmail}
                  disabled={loadingEmail}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loadingEmail
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating & sending...</>
                    : <><Send className="w-4 h-4" /> Send AI Email</>}
                </button>
                {emailResult && <p className="mt-2 text-xs text-center text-gray-600">{emailResult}</p>}
              </div>

              {/* ── Enroll in Sequence ── */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                    <ListChecks className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Enroll in Email Sequence</p>
                    <p className="text-xs text-gray-500">Auto-send multi-step AI email campaign</p>
                  </div>
                </div>
                {sequences.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">
                    No active sequences — create one in Sequences page
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sequences.map((seq) => (
                      <button
                        key={seq.id}
                        onClick={() => handleEnroll(seq.id)}
                        disabled={!!loadingEnroll}
                        className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50 transition-colors"
                      >
                        <span className="font-medium text-gray-700">{seq.name}</span>
                        {loadingEnroll === seq.id
                          ? <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                          : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </button>
                    ))}
                  </div>
                )}
                {enrollResult && <p className="mt-2 text-xs text-center text-gray-600">{enrollResult}</p>}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <>
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="w-10 h-10 text-gray-200 mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No conversations yet</p>
                  <p className="text-gray-400 text-xs mt-1">Start a call, chat or email to begin</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conv) => (
                    <div key={conv.id} className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {conv.channel === 'VOICE'
                            ? <Phone className="w-4 h-4 text-green-600" />
                            : conv.channel === 'EMAIL'
                              ? <Mail className="w-4 h-4 text-blue-600" />
                              : <MessageSquare className="w-4 h-4 text-violet-600" />}
                          <span className="text-sm font-medium text-gray-800">{conv.channel}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conv.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                          {conv.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />{conv.messageCount} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(conv.startedAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

