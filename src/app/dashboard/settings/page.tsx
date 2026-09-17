'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Mail, Phone, CreditCard, Bot } from 'lucide-react';

export default function SettingsPage() {
  const [copied,    setCopied]    = useState(false);
  const [agentId,   setAgentId]   = useState<string>('');
  const [agentName, setAgentName] = useState<string>('PrimePro');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/agent/default')
      .then((r) => r.json())
      .then((data) => {
        if (data.agentId)   setAgentId(data.agentId);
        if (data.agentName) setAgentName(data.agentName);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const embedCode = agentId
    ? `<script>\n(function(){\n  var s = document.createElement('script');\n  s.src = '${appUrl}/widget.js';\n  s.async = true;\n  s.onload = function(){ window.PrimePro.init({ agentId: '${agentId}' }); };\n  document.body.appendChild(s);\n})();\n</script>`
    : 'Loading agent ID...';

  const copyCode = () => {
    if (!agentId) return;
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const integrations = [
    { name: 'SendGrid', icon: Mail,       color: '#22c55e' },
    { name: 'Twilio',   icon: Phone,      color: '#ef4444' },
    { name: 'Stripe',   icon: CreditCard, color: '#a855f7' },
    { name: 'Groq AI',  icon: Bot,        color: '#6366f1' },
  ];

  // shared styles
  const card: React.CSSProperties = {
    background:   'rgba(255,255,255,0.03)',
    border:       '1px solid rgba(255,255,255,0.07)',
    borderRadius: '20px',
    padding:      '24px',
    marginBottom: '16px',
  };

  return (
    <div style={{ padding: '28px 32px' }}>

      {/* Page title */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>
          Settings
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
          Configure your PrimePro.ai workspace
        </p>
      </div>

      {/* ── Chat Widget ─────────────────────────────────────────────────── */}
      <div style={card}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>
          Chat Widget
        </h2>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: '0 0 20px' }}>
          Embed this on your website to activate the AI chat agent
        </p>

        {/* Agent name + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Agent:</span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>{agentName}</span>
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '3px 9px', borderRadius: '100px',
            background: 'rgba(16,185,129,0.15)', color: '#6ee7b7',
          }}>Active</span>
        </div>

        {/* Agent ID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Agent ID:</span>
          <code style={{
            fontSize: '12px', fontFamily: 'monospace',
            background: 'rgba(255,255,255,0.06)', padding: '4px 10px',
            borderRadius: '8px', color: 'rgba(255,255,255,0.55)',
          }}>
            {loading ? 'Loading...' : (agentId || 'Not found')}
          </code>
        </div>

        {/* Embed code block */}
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <div style={{
            background: '#0d1117', borderRadius: '12px',
            padding: '16px 44px 16px 16px', minHeight: '80px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <pre style={{
              fontSize: '12px', color: '#7ee787', fontFamily: 'monospace',
              margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6,
            }}>
              {embedCode}
            </pre>
          </div>
          <button
            onClick={copyCode}
            disabled={!agentId}
            style={{
              position: 'absolute', top: '10px', right: '10px',
              background: 'rgba(255,255,255,0.08)', border: 'none',
              borderRadius: '8px', padding: '7px', cursor: agentId ? 'pointer' : 'not-allowed',
              color: copied ? '#6ee7b7' : 'rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: agentId ? 1 : 0.4,
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>

        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
          Paste before the closing &lt;/body&gt; tag on your website.
        </p>
      </div>

      {/* ── Integrations ────────────────────────────────────────────────── */}
      <div style={card}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>
          Integrations
        </h2>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: '0 0 20px' }}>
          Connected services and APIs
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {integrations.map((item) => (
            <div
              key={item.name}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: `${item.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <item.icon size={16} style={{ color: item.color }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>
                  {item.name}
                </span>
              </div>

              <span style={{
                fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '100px',
                background: 'rgba(16,185,129,0.15)', color: '#6ee7b7',
              }}>
                Connected
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

