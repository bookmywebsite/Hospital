'use client';

import { UserProfile } from '@clerk/nextjs';
import { PageShell } from '@/components/dashboard/PageShell';
import { dark } from '@clerk/themes';
import { usePathname } from 'next/navigation';

export default function UserSettingsPage() {
  const pathname = usePathname();
  const isSecurity = pathname.includes('/security');

  return (
    <PageShell 
      title={isSecurity ? "Security" : "My Profile"} 
      subtitle={isSecurity ? "Manage your password, 2FA, and active sessions" : "Manage your personal information and account details"}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
        <UserProfile 
          path="/dashboard/profile"
          routing="path"
          appearance={{
            baseTheme: dark,
            elements: {
              rootBox: {
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
              },
              card: {
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: 'none',
                width: '100%',
                maxWidth: '900px',
              },
              navbar: {
                background: 'transparent',
                borderRight: '1px solid rgba(255,255,255,0.07)',
              },
              navbarButton: {
                color: 'rgba(255,255,255,0.65)',
                '&:hover': {
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                }
              },
              navbarButton__active: {
                color: '#fff',
                background: 'rgba(255,255,255,0.08)',
                fontWeight: '600',
              },
              navbarSectionHeader: {
                color: '#fff',
                textTransform: 'uppercase',
                fontSize: '12px',
                fontWeight: '800',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              },
              navbarMobileMenuRow: {
                color: '#fff',
              },
              headerTitle: {
                color: '#fff',
                fontSize: '20px',
                fontWeight: '700',
              },
              headerSubtitle: {
                color: 'rgba(255,255,255,0.6)',
              },
              pageScrollBox: {
                padding: '24px',
              }
            }
          }}
        />
      </div>
    </PageShell>
  );
}
