'use client';

import { PageShell, DarkCard } from '@/components/dashboard/PageShell';
import { Bell, Mail, MessageSquare, Shield } from 'lucide-react';

export default function NotificationsPage() {
  const notificationSettings = [
    {
      title: 'Email Notifications',
      description: 'Receive updates about your agents and leads via email',
      icon: Mail,
      enabled: true,
    },
    {
      title: 'Browser Notifications',
      description: 'Get real-time alerts in your browser',
      icon: Bell,
      enabled: false,
    },
    {
      title: 'Lead Alerts',
      description: 'Notify when a new lead is captured by an agent',
      icon: MessageSquare,
      enabled: true,
    },
    {
      title: 'Security Alerts',
      description: 'Get notified about important security updates',
      icon: Shield,
      enabled: true,
    },
  ];

  return (
    <PageShell 
      title="Notifications" 
      subtitle="Configure how you want to receive updates"
    >
      <div style={{ display: 'grid', gap: '16px', maxWidth: '800px' }}>
        {notificationSettings.map((setting) => (
          <DarkCard key={setting.title} style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '10px', 
                  background: 'rgba(99,102,241,0.1)', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center' 
                }}>
                  <setting.icon size={20} style={{ color: '#818cf8' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0 }}>{setting.title}</h3>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>{setting.description}</p>
                </div>
              </div>
              <button style={{
                padding: '6px 16px', borderRadius: '8px', 
                background: setting.enabled ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                color: setting.enabled ? '#6ee7b7' : 'rgba(255,255,255,0.4)',
                border: setting.enabled ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.1)',
                fontSize: '12px', fontWeight: 500, cursor: 'pointer'
              }}>
                {setting.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </DarkCard>
        ))}
      </div>
    </PageShell>
  );
}
