'use client';

import { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, MessageSquare, Loader2 } from 'lucide-react';
import {
  type DatePreset,
  getDateRangeFromPreset,
} from '@/lib/dashboard-date-filters';

function Skeleton({ w, h, r = '8px' }: { w: string; h: string; r?: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'rgba(255,255,255,0.06)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

const CH_COLOR: Record<string, string> = {
  VOICE: '#10b981',
  EMAIL: '#6366f1',
  CHAT: '#a855f7',
  WHATSAPP: '#22c55e',
};
const ST_COLOR: Record<string, string> = {
  ACTIVE: '#10b981',
  WAITING: '#f59e0b',
  CLOSED: '#6b7280',
  TRANSFERRED: '#06b6d4',
};

type LeadRow = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  company?: string | null;
  phone?: string | null;
} | null;

type PatientRow = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  appointments?: Array<{
    id: string;
    status?: string | null;
    scheduledAt: string;
    department?: { name?: string | null } | null;
    doctor?: { name?: string | null } | null;
  }>;
} | null;

function conversationDisplayName(conv: { lead?: LeadRow; patient?: PatientRow }): string {
  const lead = conv.lead;
  const patient = conv.patient;
  const ln = lead?.firstName?.trim();
  if (ln) return ln;
  const pn = patient?.firstName?.trim();
  if (pn) return pn;
  const full = patient?.fullName?.trim();
  if (full) {
    const first = full.split(/\s+/)[0];
    if (first) return first;
  }
  if (lead?.email) {
    const local = lead.email.split('@')[0]?.trim();
    if (local) return local;
  }
  if (lead?.phone?.trim()) return lead.phone.trim();
  if (patient?.phone?.trim()) return patient.phone.trim();
  return 'Contact';
}

function subline(conv: { lead?: LeadRow; patient?: PatientRow }) {
  return conv.lead?.company ?? conv.lead?.email ?? conv.patient?.phone ?? '';
}

type Msg = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  senderType?: string | null;
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<{
    id: string;
    channel: string;
    status: string;
    startedAt: string;
    summary?: string | null;
    lead?: LeadRow;
    patient?: PatientRow;
    messages: Msg[];
  } | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      const { from, to } = getDateRangeFromPreset(datePreset, customFrom, customTo);
      if (from) params.set('from', from.toISOString());
      if (to) params.set('to', to.toISOString());
      const r = await fetch(`/api/conversations?${params}`);
      const d = await r.json();
      setConversations(d.conversations ?? []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [datePreset, customFrom, customTo]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/conversations/${selectedId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d?.conversation) setDetail(d.conversation);
        else setDetail(null);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const voice = conversations.filter((c) => c.channel === 'VOICE').length;
  const email = conversations.filter((c) => c.channel === 'EMAIL').length;
  const chat = conversations.filter((c) => c.channel === 'CHAT').length;
  const whatsapp = conversations.filter((c) => c.channel === 'WHATSAPP').length;

  const DATE_PRESETS: { id: DatePreset; label: string }[] = [
    { id: 'all', label: 'All time' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week', label: 'This week' },
    { id: 'last_week', label: 'Last week' },
    { id: 'this_month', label: 'This month' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div style={{ padding: '28px 32px', background: '#0a0a0f', minHeight: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#fff',
            margin: 0,
          }}
        >
          Conversations
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
          {loading ? 'Loading...' : `${conversations.length} in this period`}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        {[
          { label: 'Voice', count: voice, icon: Phone, color: '#10b981' },
          { label: 'Email', count: email, icon: Mail, color: '#6366f1' },
          { label: 'Chat', count: chat, icon: MessageSquare, color: '#a855f7' },
          { label: 'WhatsApp', count: whatsapp, icon: MessageSquare, color: '#22c55e' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: `${s.color}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <s.icon size={16} style={{ color: s.color }} />
            </div>
            <div>
              {loading ? (
                <Skeleton w="32px" h="22px" r="4px" />
              ) : (
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {s.count}
                </div>
              )}
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginRight: '4px' }}>Started</span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setDatePreset(p.id)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid',
                background: datePreset === p.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                borderColor: datePreset === p.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)',
                color: datePreset === p.id ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
              From{' '}
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  marginLeft: '6px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  outline: 'none',
                }}
              />
            </label>
            <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
              To{' '}
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  marginLeft: '6px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  outline: 'none',
                }}
              />
            </label>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            flex: '1 1 340px',
            minWidth: '280px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px',
            overflow: 'hidden',
            maxHeight: 'min(70vh, 640px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 80px',
              padding: '11px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            {['Contact', 'Channel', 'Started', 'Msgs'].map((h) => (
              <span
                key={h}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.25)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {h}
              </span>
            ))}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} w="100%" h="36px" r="8px" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>
                No conversations in this period
              </div>
            ) : (
              conversations.map((conv, i) => {
                const name = conversationDisplayName(conv);
                const sub = subline(conv);
                const ch = conv.channel as string;
                const ChIcon = ch === 'VOICE' ? Phone : ch === 'EMAIL' ? Mail : MessageSquare;
                const active = selectedId === conv.id;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedId(conv.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 80px',
                      alignItems: 'center',
                      width: '100%',
                      padding: '11px 16px',
                      borderBottom: i < conversations.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                      borderLeft: active ? '3px solid #818cf8' : '3px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderRight: 'none',
                      borderTop: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>{name}</div>
                      {sub ? (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>{sub}</div>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ChIcon size={13} style={{ color: CH_COLOR[ch] ?? '#888' }} />
                      <span style={{ fontSize: '12px', color: CH_COLOR[ch] ?? '#888', fontWeight: 500 }}>{ch}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)' }}>
                      {new Date(conv.startedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{conv.messageCount ?? 0}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div
          style={{
            flex: '1.2 1 400px',
            minWidth: '280px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'min(70vh, 640px)',
          }}
        >
          {!selectedId ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.25)',
                fontSize: '13px',
              }}
            >
              Select a conversation to view messages
            </div>
          ) : detailLoading ? (
            <div style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}>
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#818cf8' }} />
            </div>
          ) : !detail ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
              Could not load conversation
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: '16px 18px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
                  {conversationDisplayName(detail)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '3px 8px',
                      borderRadius: '100px',
                      background: `${CH_COLOR[detail.channel] ?? '#888'}18`,
                      color: CH_COLOR[detail.channel] ?? '#888',
                    }}
                  >
                    {detail.channel}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '3px 8px',
                      borderRadius: '100px',
                      background: `${ST_COLOR[detail.status] ?? '#888'}18`,
                      color: ST_COLOR[detail.status] ?? '#888',
                    }}
                  >
                    {detail.status}
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                    {new Date(detail.startedAt).toLocaleString()}
                  </span>
                </div>
                {detail.summary ? (
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '10px', lineHeight: 1.5 }}>
                    {detail.summary}
                  </p>
                ) : null}
                {detail.patient?.appointments?.length ? (
                  <div style={{ marginTop: '14px', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', marginBottom: '6px' }}>Appointment details</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                      <div><strong>Status:</strong> {detail.patient.appointments[0].status}</div>
                      <div><strong>When:</strong> {new Date(detail.patient.appointments[0].scheduledAt).toLocaleString()}</div>
                      <div><strong>Department:</strong> {detail.patient.appointments[0].department?.name || 'General'}</div>
                      <div><strong>Doctor:</strong> {detail.patient.appointments[0].doctor?.name || 'TBD'}</div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {(detail.messages ?? []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '24px' }}>
                    No messages recorded for this thread (voice transcripts may appear here when available).
                  </div>
                ) : (
                  detail.messages.map((m) => {
                    const isUser = m.role === 'user' || m.senderType === 'user';
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isUser ? 'flex-end' : 'flex-start',
                          maxWidth: '92%',
                          padding: '10px 12px',
                          borderRadius: '12px',
                          background: isUser ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${isUser ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.35)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {isUser ? 'Contact' : m.role === 'system' ? 'System' : 'Assistant'}
                          {' · '}
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: '13px', color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
