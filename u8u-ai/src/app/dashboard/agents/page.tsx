'use client';

import { useState, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Agent {
  id: string; name: string; role: string; isActive: boolean; isDefault: boolean;
  welcomeMessage?: string | null; companyName?: string | null;
  conversationCount?: number; createdAt: string;
}

const FREE_AGENT_LIMIT = 3;

const AGENT_TYPES = [
  'All Purpose Agent - Call to Action',
  'Hospital Appointment Agent',
  'Triage & Symptom Checker',
  'Patient Support Agent',
  'Medicine Information Agent',
  'Outbound Health Agent',
];
const TABS = ['All', 'Published', 'Paused', 'Unpublished'];

// ── Icons ─────────────────────────────────────────────────────────────────────
const SearchIcon = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>;
const PlusIcon = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>;
const RefreshIcon = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>;
const TrashIcon = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>;
const CloseIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>;
const GlobeIcon = () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
const BotIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M12 11V7" /><circle cx="12" cy="5" r="2" /><path d="M8 15h.01M16 15h.01" /></svg>;
const EditIcon = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>;
const DotsIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>;
const ZapIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
const ScratchIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const TemplateIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18M9 21V9" /></svg>;
const CrownIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 20h20M4 20V10l8-6 8 6v10" /><path d="M12 14v6" /></svg>;
const CheckIcon = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>;
const ExternalIcon = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;

// ── Robot SVG ─────────────────────────────────────────────────────────────────
function RobotSVG() {
  return (
    <svg width="130" height="150" viewBox="0 0 160 180" fill="none">
      <ellipse cx="80" cy="110" rx="38" ry="50" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.4)" strokeWidth="2" />
      <ellipse cx="80" cy="60" rx="32" ry="30" fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.4)" strokeWidth="2" />
      <rect x="58" y="50" width="44" height="18" rx="9" fill="rgba(10,10,15,0.95)" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" />
      <circle cx="80" cy="59" r="5" fill="#818cf8" />
      <circle cx="80" cy="59" r="2.5" fill="white" />
      <line x1="80" y1="31" x2="80" y2="20" stroke="rgba(99,102,241,0.6)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="80" cy="18" r="4" fill="#6366f1" />
      <path d="M42 100 Q25 110 30 130" stroke="rgba(99,102,241,0.5)" strokeWidth="8" strokeLinecap="round" fill="none" />
      <circle cx="30" cy="132" r="6" fill="rgba(99,102,241,0.3)" />
      <path d="M118 95 Q138 80 135 65" stroke="rgba(99,102,241,0.5)" strokeWidth="8" strokeLinecap="round" fill="none" />
      <circle cx="134" cy="63" r="6" fill="rgba(99,102,241,0.3)" />
      <rect x="73" y="88" width="14" height="10" rx="3" fill="rgba(99,102,241,0.18)" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />
      <rect x="65" y="108" width="30" height="20" rx="5" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />
      <circle cx="72" cy="118" r="3" fill="#818cf8" />
      <circle cx="80" cy="118" r="3" fill="#6366f1" />
      <circle cx="88" cy="118" r="3" fill="#8b5cf6" />
    </svg>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!checked)} style={{ width: 42, height: 23, borderRadius: 12, background: checked ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 22 : 3, width: 17, height: 17, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
      </div>
      <span style={{ fontSize: 13, color: checked ? '#e2e8f0' : 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{label}</span>
    </label>
  );
}

// ── Loading Steps ─────────────────────────────────────────────────────────────
function LoadingSteps({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {steps.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
              background: done ? 'rgba(16,185,129,0.2)' : active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
              border: done ? '1.5px solid #10b981' : active ? '1.5px solid #6366f1' : '1.5px solid rgba(255,255,255,0.1)',
            }}>
              {done ? <span style={{ color: '#10b981' }}>✓</span> : active ? (
                <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              ) : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>○</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: active ? 600 : done ? 500 : 400, color: done ? '#6ee7b7' : active ? '#e2e8f0' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }}>{step}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Premium Popup ─────────────────────────────────────────────────────────────
function PremiumPopup({ onClose }: { onClose: () => void }) {
  const plans = [
    { name: 'Starter', price: '₹1,999', period: '/mo', agents: 3, color: '#6366f1', popular: false, features: ['3 AI Agents', '500 conversations', 'Chat + Email', 'BANT scoring'] },
    { name: 'Growth', price: '₹4,999', period: '/mo', agents: 10, color: '#8b5cf6', popular: true, features: ['10 AI Agents', '2,000 conversations', 'All channels', 'Priority support', 'Analytics'] },
    { name: 'Pro', price: '₹9,999', period: '/mo', agents: -1, color: '#a855f7', popular: false, features: ['Unlimited Agents', '10,000 conversations', 'Voice + WhatsApp', 'API access', 'Custom training'] },
  ];

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 24, backdropFilter: 'blur(6px)' }}>
      <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, width: '100%', maxWidth: 780, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', position: 'relative' }}>

        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
          <CloseIcon />
        </button>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.2) 100%)', padding: '36px 40px 32px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ width: 52, height: 52, borderRadius: '14px', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#818cf8' }}>
            <CrownIcon />
          </div>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            You've reached your free limit
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0 }}>
            The Free plan includes <strong style={{ color: '#a5b4fc' }}>1 AI Agent</strong>. Upgrade to create more agents and unlock all features.
          </p>
        </div>

        {/* Plans */}
        <div style={{ padding: '28px 32px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {plans.map(plan => (
            <div key={plan.name} style={{
              background: plan.popular ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${plan.popular ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 16, padding: '22px 20px', position: 'relative', overflow: 'hidden',
            }}>
              {plan.popular && (
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 100, background: 'rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                  POPULAR
                </div>
              )}
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{plan.name}</div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{plan.period}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ color: '#10b981', flexShrink: 0 }}><CheckIcon /></span>{f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => window.location.href = '/pricing'}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: plan.popular ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.07)',
                  color: plan.popular ? '#fff' : 'rgba(255,255,255,0.7)',
                }}
              >
                Upgrade to {plan.name}
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 32px 24px', textAlign: 'center' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer' }}>
            Maybe later — continue with Free plan
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agent Details Modal ───────────────────────────────────────────────────────
function AgentModal({ agent, onClose, onDelete }: { agent: Agent; onClose: () => void; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleDelete() {
    if (!confirm) { setConfirm(true); return; }
    setDeleting(true);
    try {
      await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      onDelete(agent.id);
      onClose();
    } catch { setDeleting(false); }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, width: '100%', maxWidth: 520, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', position: 'relative' }}>

        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
          <CloseIcon />
        </button>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))', padding: '28px 28px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
              <BotIcon />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 3px' }}>{agent.name}</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{agent.role}</p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: 28 }}>
          {[
            { label: 'Status', value: agent.isActive ? '🟢 Active' : '⚪ Paused' },
            { label: 'Default Agent', value: agent.isDefault ? 'Yes' : 'No' },
            { label: 'Hospital', value: (agent as any).companyName ?? process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? 'City Hospital' },
            { label: 'Conversations', value: String(agent.conversationCount ?? 0) },
            { label: 'Agent ID', value: agent.id.slice(0, 20) + '...' },
            { label: 'Created', value: new Date(agent.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
              <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}
          {agent.welcomeMessage && (
            <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Welcome Message</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, fontStyle: 'italic' }}>"{agent.welcomeMessage}"</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '0 28px 24px', display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.location.href = '/dashboard/settings'}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', cursor: 'pointer' }}
          >
            <EditIcon /> Edit Agent
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: confirm ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${confirm ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, color: confirm ? '#fca5a5' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
          >
            <TrashIcon /> {deleting ? 'Deleting...' : confirm ? 'Confirm Delete' : 'Delete Agent'}
          </button>
        </div>
        {confirm && <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', paddingBottom: 16, margin: 0 }}>This will permanently delete the agent and all its data.</p>}
      </div>
    </div>
  );
}

// ── Quick Setup View ──────────────────────────────────────────────────────────
function QuickSetupView({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [createAgent, setCreateAgent] = useState(true);
  const [createKB, setCreateKB] = useState(true);
  const [createPlaybook, setCreatePlaybook] = useState(true);
  const [agentType, setAgentType] = useState(AGENT_TYPES[0]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(-1);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const LOAD_STEPS = [
    'Fetching & analysing website content…',
    'Extracting brand, services & details…',
    createAgent ? 'Building AI Agent configuration…' : null,
    createKB ? 'Creating Knowledge Base Collection…' : null,
    createPlaybook ? 'Generating Hospital Playbook…' : null,
    'Finalising & saving your agent…',
  ].filter(Boolean) as string[];

  function validateUrl(val: string): string {
    try {
      const u = new URL(val.startsWith('http') ? val : 'https://' + val);
      return u.hostname.includes('.') ? '' : 'Please enter a valid URL';
    } catch { return 'Please enter a valid URL (e.g. https://example.com)'; }
  }

  const canCreate = url.trim().length > 0 && !loading && (createAgent || createKB || createPlaybook);

  async function handleCreate() {
    const err = validateUrl(url);
    if (err) { setUrlError(err); return; }
    setError(''); setResult(null); setLoading(true); setLoadStep(0);
    const cleanUrl = url.startsWith('http') ? url : 'https://' + url;

    try {
      for (let i = 0; i < 2; i++) {
        await new Promise(r => setTimeout(r, 700));
        setLoadStep(i + 1);
      }

      const res = await fetch('/api/agent/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, agentType, createAgent, createKB, createPlaybook }),
      });
      const data = await res.json();

      for (let s = 2; s < LOAD_STEPS.length; s++) {
        setLoadStep(s);
        await new Promise(r => setTimeout(r, 500));
      }
      setLoadStep(LOAD_STEPS.length);

      if (data.success) setResult({ ...data, url: cleanUrl });
      else setError(data.error ?? 'Something went wrong');
    } catch (e: any) {
      setError(e.message ?? 'Network error. Please try again.');
    }
    setLoading(false);
  }

  const card: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '22px 24px' };
  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', boxSizing: 'border-box' };

  // ── Result View ──
  if (result) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Agent Created Successfully!</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Generated from <a href={result.url} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>{result.url}</a>
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {result.agentConfig && (
            <div style={card}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#818cf8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🤖 Agent Configuration</p>
              <pre style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>{result.agentConfig}</pre>
            </div>
          )}
          {result.knowledgeBase && (
            <div style={card}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#10b981', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📚 Knowledge Base</p>
              <pre style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>{result.knowledgeBase}</pre>
            </div>
          )}
          {result.playbook && (
            <div style={card}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Hospital Playbook</p>
              <pre style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>{result.playbook}</pre>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onBack} style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            ✓ Save & Go to Agents
          </button>
          <button onClick={() => { setResult(null); setUrl(''); setLoadStep(-1); }} style={{ padding: '12px 20px', borderRadius: 12, fontSize: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
            ← Generate Another
          </button>
        </div>
      </div>
    );
  }

  // ── Loading View ──
  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16, animation: 'pulse 2s ease infinite' }}>🤖</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#fff' }}>Building your AI Agent…</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 32 }}>Analysing <strong style={{ color: '#a5b4fc' }}>{url}</strong></p>
        <div style={{ ...card, textAlign: 'left', marginBottom: 20 }}>
          <LoadingSteps steps={LOAD_STEPS} currentStep={loadStep} />
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 4, transition: 'width 0.6s ease', width: `${Math.round(((loadStep + 1) / LOAD_STEPS.length) * 100)}%` }} />
        </div>
      </div>
    );
  }

  // ── Form View ──
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Quick Agent Setup</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Just a couple steps away from launching your AI agent</p>
      </div>

      {/* URL */}
      <div style={{ ...card, borderColor: urlError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <GlobeIcon /><span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Drop Website URL</span>
        </div>
        <input
          type="text" value={url}
          onChange={e => { setUrl(e.target.value); setUrlError(''); }}
          onKeyDown={e => e.key === 'Enter' && canCreate && handleCreate()}
          placeholder="https://yourhospital.com"
          style={{ ...inp, borderColor: urlError ? 'rgba(239,68,68,0.4)' : url ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)' }}
        />
        {urlError && <p style={{ color: '#fca5a5', fontSize: 12, margin: '8px 0 0' }}>⚠ {urlError}</p>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}><div style={{ width: 2, height: 24, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }} /></div>

      {/* Options */}
      <div style={card}>
        <p style={{ fontWeight: 600, fontSize: 14, color: '#fff', margin: '0 0 16px' }}>Select what to generate <span style={{ color: '#ef4444' }}>*</span></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: createAgent ? 20 : 0 }}>
          <Toggle checked={createAgent} onChange={setCreateAgent} label="Create Agent" />
          <Toggle checked={createKB} onChange={setCreateKB} label="Create Knowledge Base Collection" />
          <Toggle checked={createPlaybook} onChange={setCreatePlaybook} label="Create Hospital Playbook" />
        </div>
        {createAgent && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>🤖</span>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Select Agent Type <span style={{ color: '#ef4444' }}>*</span></span>
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowDropdown(!showDropdown)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: `1px solid ${showDropdown ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 14, color: '#fff' }}>
                <span>{agentType}</span>
                <span style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'rgba(255,255,255,0.4)' }}>▾</span>
              </button>
              {showDropdown && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#0d0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.6)', zIndex: 100, overflow: 'hidden' }}>
                  {AGENT_TYPES.map(type => (
                    <div key={type} onClick={() => { setAgentType(type); setShowDropdown(false); }} style={{ padding: '11px 14px', cursor: 'pointer', fontSize: 13, color: type === agentType ? '#a5b4fc' : 'rgba(255,255,255,0.6)', background: type === agentType ? 'rgba(99,102,241,0.15)' : 'transparent', fontWeight: type === agentType ? 600 : 400, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {type}{type === agentType && <CheckIcon />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}><div style={{ width: 2, height: 24, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }} /></div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: 13, marginBottom: 8 }}>⚠ {error}</div>}

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <button onClick={handleCreate} disabled={!canCreate} style={{ width: '100%', padding: '18px 24px', border: 'none', background: canCreate ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.04)', color: canCreate ? 'white' : 'rgba(255,255,255,0.2)', fontSize: 15, fontWeight: 600, cursor: canCreate ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
          Create your AI Agent ✨
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer' }}>← Back</button>
      </div>
    </div>
  );
}

// ── Create Method Modal ───────────────────────────────────────────────────────
function CreateMethodModal({ onClose, onSelect }: { onClose: () => void; onSelect: (m: string) => void }) {
  const methods = [
    { id: 'quick', icon: <ZapIcon />, color: '#6366f1', bg: 'rgba(99,102,241,0.12)', title: 'Quick Agent Setup', desc: 'Built in 2 minutes, just add your URL' },
    { id: 'scratch', icon: <ScratchIcon />, color: '#10b981', bg: 'rgba(16,185,129,0.12)', title: 'Start from Scratch', desc: 'Build a fully custom agent' },
    { id: 'template', icon: <TemplateIcon />, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', title: 'Use Saved Template', desc: 'Start with a saved template' },
  ];

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, width: '100%', maxWidth: 760, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
          <CloseIcon />
        </button>
        <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.12))', padding: '36px 40px 32px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🚀</div>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>How do you want your Agent to come to life?</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0 }}>Pick a starting point — we'll handle the magic behind the scenes</p>
        </div>
        <div style={{ padding: 28, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {methods.map(m => (
            <button key={m.id} onClick={() => onSelect(m.id)}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 18px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = m.color + '66'; (e.currentTarget as HTMLButtonElement).style.background = m.bg; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)'; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
            >
              <div style={{ width: 50, height: 50, borderRadius: 14, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>{m.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 5 }}>{m.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{m.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────
function AgentCard({ agent, onOpen }: { agent: Agent; onOpen: (a: Agent) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 24, position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s' }}
      onMouseOver={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)'}
      onMouseOut={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'}
    >
      <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
            <BotIcon />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{agent.role}</div>
          </div>
        </div>

        {/* Dots menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
            <DotsIcon />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#0d0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.5)', zIndex: 50, overflow: 'hidden', minWidth: 160 }}>
              <button onClick={() => { onOpen(agent); setMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'}
                onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
              >
                <EditIcon /> View & Edit
              </button>
              <button onClick={() => { onOpen(agent); setMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#fca5a5', textAlign: 'left' }}
                onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'}
                onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
              >
                <TrashIcon /> Delete Agent
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {agent.isDefault && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontWeight: 500 }}>Default</span>}
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: agent.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)', color: agent.isActive ? '#6ee7b7' : '#9ca3af', fontWeight: 500 }}>
          {agent.isActive ? '🟢 Active' : '⚪ Paused'}
        </span>
      </div>

      {agent.welcomeMessage && (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: '0 0 14px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          "{agent.welcomeMessage}"
        </p>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>{agent.conversationCount ?? 0} conversations</span>
        <button onClick={() => onOpen(agent)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', cursor: 'pointer' }}>
          Open <ExternalIcon />
        </button>
      </div>
    </div>
  );
}

// ── Main Agents Page ──────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState<'list' | 'quickSetup'>('list');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelected] = useState<Agent | null>(null);
  const [showPremium, setShowPremium] = useState(false);

  useEffect(() => { fetchAgents(); }, []);

  async function fetchAgents() {
    setLoading(true);
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      setAgents(data.agents ?? []);
    } catch { }
    setLoading(false);
  }

  function handleCreateNew() {
    if (agents.length >= FREE_AGENT_LIMIT) { setShowPremium(true); return; }
    setShowModal(true);
  }

  function handleSelectMethod(method: string) {
    setShowModal(false);
    if (method === 'quick') setView('quickSetup');
    else if (method === 'scratch') window.location.href = '/dashboard/settings';
    else alert('Templates coming soon!');
  }

  function handleDeleteAgent(id: string) {
    setAgents(prev => prev.filter(a => a.id !== id));
  }

  const filtered = agents.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeTab === 'Published' && !a.isActive) return false;
    if (activeTab === 'Paused' && a.isActive) return false;
    return true;
  });

  const counts = { All: agents.length, Published: agents.filter(a => a.isActive).length, Paused: agents.filter(a => !a.isActive).length, Unpublished: 0 };

  if (view === 'quickSetup') {
    return (
      <div style={{ background: '#0a0a0f', minHeight: '100%' }}>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
        <QuickSetupView onBack={() => { setView('list'); fetchAgents(); }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', background: '#0a0a0f', minHeight: '100%' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>AI Agents</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            Your AI-agent HQ — shape the entire health AI journey here.
            {' '}<span style={{ color: '#818cf8', cursor: 'pointer', fontSize: 12 }}>More on agents ↗</span>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Free plan badge */}
          <div style={{ fontSize: 11, padding: '4px 10px', borderRadius: 100, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', fontWeight: 500 }}>
            Free: {agents.length}/{FREE_AGENT_LIMIT} agents
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}><SearchIcon /></div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents..." style={{ paddingLeft: 30, paddingRight: 14, paddingTop: 8, paddingBottom: 8, width: 220, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, outline: 'none', color: '#fff', background: 'rgba(255,255,255,0.04)' }} />
          </div>
          <button onClick={handleCreateNew} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
            <PlusIcon /> Create New
          </button>
        </div>
      </div>

      {/* Tabs + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,0.07)' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400, fontSize: 13, background: activeTab === tab ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === tab ? '#a5b4fc' : 'rgba(255,255,255,0.4)' }}>
              {tab} ({counts[tab as keyof typeof counts]})
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ icon: <RefreshIcon />, label: 'Refresh', fn: fetchAgents }].map(b => (
            <button key={b.label} onClick={b.fn} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
              {b.icon} {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agent cards or empty state */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading agents...</div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 32 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.07)', padding: '48px 56px', textAlign: 'center', maxWidth: 360, boxShadow: '0 0 60px rgba(99,102,241,0.05)' }}>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}><RobotSVG /></div>
            <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Create a New Agent</h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
              Build a custom AI health agent to manage appointments, triage, and patient support.
            </p>
            <button onClick={handleCreateNew} style={{ width: '100%', padding: '13px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 0 24px rgba(99,102,241,0.35)' }}>
              Create New Agent
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {filtered.map(agent => (
            <AgentCard key={agent.id} agent={agent} onOpen={setSelected} />
          ))}
          {/* Add new card */}
          <button onClick={handleCreateNew} style={{ background: 'rgba(255,255,255,0.02)', border: '1.5px dashed rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 180, transition: 'all 0.2s' }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.4)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.05)'; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'; }}
          >
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}><PlusIcon /></div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Add New Agent</span>
          </button>
        </div>
      )}

      {/* Modals */}
      {showModal && <CreateMethodModal onClose={() => setShowModal(false)} onSelect={handleSelectMethod} />}
      {selectedAgent && <AgentModal agent={selectedAgent} onClose={() => setSelected(null)} onDelete={handleDeleteAgent} />}
      {showPremium && <PremiumPopup onClose={() => setShowPremium(false)} />}
    </div>
  );
}

