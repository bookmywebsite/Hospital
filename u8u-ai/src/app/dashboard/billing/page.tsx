'use client';

import { PageShell, DarkCard, StatusPill } from '@/components/dashboard/PageShell';
import { CreditCard, Check, Zap } from 'lucide-react';

export default function BillingPage() {
  const plans = [
    {
      name: 'Starter',
      price: '$49',
      features: ['Up to 500 AI minutes', '3 Voice Agents', 'Email Support'],
      current: false,
    },
    {
      name: 'Professional',
      price: '$149',
      features: ['Unlimited AI minutes', '10 Voice Agents', 'Priority Support', 'Custom Branding'],
      current: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      features: ['Dedicated Account Manager', 'SLA Guarantees', 'On-premise deployment'],
      current: false,
    },
  ];

  return (
    <PageShell 
      title="Billing & Plan" 
      subtitle="Manage your subscription and billing details"
    >
      <div style={{ display: 'grid', gap: '24px' }}>
        
        {/* Current Plan Card */}
        <DarkCard style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }}>Professional Plan</h2>
                <StatusPill label="Active" color="#10b981" />
              </div>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', margin: '8px 0 20px' }}>
                Your next billing date is June 21, 2026 for $149.00
              </p>
              <button style={{
                padding: '8px 16px', borderRadius: '8px', 
                background: '#6366f1', color: '#fff', border: 'none',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer'
              }}>
                Manage Subscription
              </button>
            </div>
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '12px', 
              background: 'rgba(99,102,241,0.1)', display: 'flex', 
              alignItems: 'center', justifyContent: 'center' 
            }}>
              <Zap size={24} style={{ color: '#818cf8' }} />
            </div>
          </div>
        </DarkCard>

        {/* Plan Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {plans.map((plan) => (
            <DarkCard key={plan.name} style={{ 
              padding: '24px', 
              border: plan.current ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)',
              position: 'relative'
            }}>
              {plan.current && (
                <div style={{ 
                  position: 'absolute', top: '12px', right: '12px',
                  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                  color: '#818cf8', background: 'rgba(99,102,241,0.1)',
                  padding: '2px 8px', borderRadius: '4px'
                }}>Current</div>
              )}
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: 0 }}>{plan.name}</h3>
              <div style={{ margin: '16px 0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#fff' }}>{plan.price}</span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>/month</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {plan.features.map((feature) => (
                  <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                    <Check size={14} style={{ color: '#10b981' }} />
                    {feature}
                  </div>
                ))}
              </div>
              <button style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                background: plan.current ? 'transparent' : 'rgba(255,255,255,0.05)',
                color: plan.current ? 'rgba(255,255,255,0.3)' : '#fff',
                border: plan.current ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.1)',
                fontSize: '13px', fontWeight: 500, cursor: plan.current ? 'default' : 'pointer'
              }} disabled={plan.current}>
                {plan.current ? 'Current Plan' : 'Upgrade Plan'}
              </button>
            </DarkCard>
          ))}
        </div>

        {/* Payment Methods */}
        <DarkCard style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: '0 0 16px' }}>Payment Methods</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CreditCard size={20} style={{ color: 'rgba(255,255,255,0.4)' }} />
              <div>
                <div style={{ fontSize: '14px', color: '#fff', fontWeight: 500 }}>Visa ending in 4242</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Expires 12/28</div>
              </div>
            </div>
            <button style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '13px', cursor: 'pointer' }}>Edit</button>
          </div>
        </DarkCard>

      </div>
    </PageShell>
  );
}
