'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut, ChevronDown, Bell, Shield, CreditCard } from 'lucide-react';

interface ProfileDropdownProps {
  firstName?: string | null;
  lastName?:  string | null;
  email?:     string | null;
  imageUrl?:  string | null;
  orgName?:   string | null;
}

export function ProfileDropdown({ firstName, lastName, email, imageUrl, orgName }: ProfileDropdownProps) {
  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);
  const initials          = (firstName?.[0] ?? email?.[0] ?? 'U').toUpperCase();
  const displayName       = [firstName, lastName].filter(Boolean).join(' ') || email?.split('@')[0] || 'User';

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    try { await fetch('/api/auth/signout', { method: 'POST' }); } catch {}
    window.location.replace('/');
  };

  const menuItems = [
    { icon: User,       label: 'My Profile',    action: () => window.location.href = '/dashboard/profile' },
    { icon: Bell,       label: 'Notifications',  action: () => window.location.href = '/dashboard/notifications' },
    { icon: Shield,     label: 'Security',       action: () => window.location.href = '/dashboard/profile/security' },
    { icon: CreditCard, label: 'Billing & Plan', action: () => window.location.href = '/dashboard/billing' },
    { icon: Settings,   label: 'Settings',       action: () => window.location.href = '/dashboard/settings' },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Profile button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         '8px',
          padding:     '5px 10px 5px 6px',
          borderRadius: '100px',
          background:  open ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
          border:      '1px solid rgba(255,255,255,0.1)',
          cursor:      'pointer',
          transition:  'all 0.15s',
        }}
      >
        {/* Avatar */}
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>{initials}</div>
        )}
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.4)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:   'absolute', top: 'calc(100% + 8px)', right: 0,
          width:      '240px', zIndex: 100,
          background: '#111118',
          border:     '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          boxShadow:  '0 20px 60px rgba(0,0,0,0.5)',
          overflow:   'hidden',
        }}>

          {/* User info header */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {imageUrl ? (
                <img src={imageUrl} alt={displayName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>{initials}</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email}
                </div>
                {orgName && (
                  <div style={{ fontSize: '11px', color: '#818cf8', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {orgName}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: '8px' }}>
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { item.action(); setOpen(false); }}
                style={{
                  display:      'flex', alignItems: 'center', gap: '10px',
                  width:        '100%', padding: '9px 12px', borderRadius: '10px',
                  background:   'transparent', border: 'none', cursor: 'pointer',
                  fontSize:     '13px', fontWeight: 400, color: 'rgba(255,255,255,0.65)',
                  textAlign:    'left', transition: 'all 0.1s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}
              >
                <item.icon size={15} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                {item.label}
              </button>
            ))}
          </div>

          {/* Sign out */}
          <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              onClick={handleSignOut}
              style={{
                display:    'flex', alignItems: 'center', gap: '10px',
                width:      '100%', padding: '9px 12px', borderRadius: '10px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize:   '13px', fontWeight: 500, color: '#fca5a5',
                textAlign:  'left', transition: 'all 0.1s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
              onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut size={15} style={{ flexShrink: 0 }} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}