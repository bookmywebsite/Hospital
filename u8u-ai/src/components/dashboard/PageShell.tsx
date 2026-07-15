// src/components/dashboard/PageShell.tsx
// Shared wrapper — gives every page the same dark padding + header style
// Usage: wrap page content in <PageShell title="Leads">...</PageShell>

export function PageShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: '28px',
      }}>
        <div>
          <h1 style={{
            fontSize: '22px', fontWeight: 700,
            letterSpacing: '-0.03em', color: '#fff', margin: 0,
          }}>{title}</h1>
          {subtitle && (
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
              {subtitle}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}

// Shared dark card
export function DarkCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '20px',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

// Shared stat badge
export function StatusPill({
  label, color,
}: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: '11px', fontWeight: 500,
      padding: '3px 9px', borderRadius: '100px',
      background: `${color}18`, color,
    }}>{label}</span>
  );
}