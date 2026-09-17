'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Bot,
  Mail,
  Settings,
  Target,
  MessageCircle,
  Phone,
  Calendar,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const DASHBOARD_CHILDREN = [
  { href: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/ai-chat', label: 'AI Chat', icon: MessageCircle },
  { href: '/dashboard/voice-ai', label: 'Voice AI', icon: Phone },
  { href: '/dashboard/appointments', label: 'Appointments', icon: Calendar },
  { href: '/dashboard/patient-crm', label: 'Patient CRM', icon: Users },
] as const;

const navItems = [
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/dashboard/agents', label: 'AI Agents', icon: Bot },
  { href: '/dashboard/assignment', label: 'Assignment', icon: Target },
  { href: '/dashboard/sequences', label: 'Sequences', icon: Mail },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function isDashboardSubpath(pathname: string) {
  return DASHBOARD_CHILDREN.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));
}

export function Sidebar() {
  const pathname = usePathname();
  const dashboardActive = pathname === '/dashboard' || isDashboardSubpath(pathname);
  const [dashOpen, setDashOpen] = useState(dashboardActive);

  useEffect(() => {
    if (dashboardActive) setDashOpen(true);
  }, [dashboardActive]);

  const isActive = (href: string) =>
    href === '/dashboard/overview'
      ? pathname === '/dashboard' || pathname === '/dashboard/overview'
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 40,
        height: '100vh',
        width: '220px',
        background: '#0d0d14',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <Link href="/dashboard/overview" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            PrimePro<span style={{ color: '#818cf8' }}>.ai</span>
          </span>
        </Link>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        <div style={{ marginBottom: 4 }}>
          <button
            type="button"
            onClick={() => setDashOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              marginBottom: 2,
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              background: dashboardActive ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: dashboardActive ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
              borderLeft: dashboardActive ? '2px solid #6366f1' : '2px solid transparent',
              transition: 'all 0.15s',
              textAlign: 'left',
            }}
          >
            <LayoutDashboard size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Dashboard</span>
            {dashOpen ? <ChevronDown size={14} style={{ opacity: 0.7 }} /> : <ChevronRight size={14} style={{ opacity: 0.7 }} />}
          </button>

          {dashOpen && (
            <div
              style={{
                marginLeft: 8,
                paddingLeft: 10,
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {DASHBOARD_CHILDREN.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                      color: active ? '#c7d2fe' : 'rgba(255,255,255,0.38)',
                      borderLeft: active ? '2px solid #818cf8' : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <item.icon size={13} style={{ flexShrink: 0, opacity: 0.9 }} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '10px',
                marginBottom: '2px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 500,
                background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: active ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
                borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <item.icon size={15} style={{ flexShrink: 0 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
