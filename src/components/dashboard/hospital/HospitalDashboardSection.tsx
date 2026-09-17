//@ts-nocheck
'use client';
import { useState, useEffect, lazy, Suspense } from "react";
import { Bell, Settings, Search } from "lucide-react";

// Lazy load heavy components
const OverviewTab = lazy(() => import("./OverviewTab").then(m => ({ default: m.OverviewTab })));
const AIChatTab = lazy(() => import("./AIChatTab").then(m => ({ default: m.AIChatTab })));
const VoiceTab = lazy(() => import("./VoiceTab").then(m => ({ default: m.VoiceTab })));
const AppointmentsTab = lazy(() => import("./AppointmentsTab").then(m => ({ default: m.AppointmentsTab })));
const CRMTab = lazy(() => import("./CRMTab").then(m => ({ default: m.CRMTab })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4ff]"></div>
  </div>
);

type HospitalData = {
  stats: any;
  aiAgents: any[];
  recentLeads: any[];
  appointments: any[];
  patients: any[];
  liveQueue: any[];
  callData: any[];
  weeklyData: any[];
  sourceData: any[];
  deptData: any[];
  faqTopics: any[];
  remindersByChannel?: {
    whatsapp?: { sent: number; delivered: number };
    sms?: { sent: number; delivered: number };
    voice?: { sent: number; delivered: number };
  };
  voice?: {
    inbound: number;
    outbound: number;
    missed: number;
    booked: number;
    avgDurationSec: number;
    callbacks: { missed: number; done: number; booked: number };
  };
  voiceScenarioStats?: {
    inbound: Array<{ key: string; label: string; color: string; count: number }>;
    outbound: Array<{ key: string; label: string; color: string; count: number }>;
  };
  chat?: {
    activeChats: number;
    bookedViaChat: number;
    avgResponseSec: number;
  };
};

const C = {
  bg: "#050d1a",
  surface: "#0a1628",
  card: "#0f1f38",
  border: "#1a3050",
  borderLight: "#1e3a5f",
  accent: "#00c4ff",
  accentGlow: "rgba(0,196,255,0.15)",
  green: "#00e5a0",
  greenGlow: "rgba(0,229,160,0.15)",
  amber: "#ffb347",
  red: "#ff4d6d",
  purple: "#a78bfa",
  text: "#e2eaf4",
  textMuted: "#5a7a9a",
  textDim: "#8aa8c8",
};

export type HospitalDashboardSectionId = 'overview' | 'ai_chat' | 'voice' | 'appointments' | 'crm';

const TAB_LABEL: Record<HospitalDashboardSectionId, string> = {
  overview: 'Dashboard Overview',
  ai_chat: 'AI Chat System',
  voice: 'Voice AI Agent',
  appointments: 'Appointment System',
  crm: 'Patient CRM',
};

export function HospitalDashboardSection({ section }: { section: HospitalDashboardSectionId }) {
  const [liveMode, setLiveMode] = useState(true);
  const [data, setData] = useState<HospitalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const D = data || {};
  
  useEffect(() => {
    let mounted = true;
    let aborted = false;
    const controller = new AbortController();
    
    const load = async () => {
      try {
        setError(null);

        // Check localStorage cache first
        const cacheKey = `hospital_dashboard_cache_${section}`;
        const cached = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(cacheKey + '_time');
        const now = Date.now();
        const cacheAgeMs = cacheTime ? now - parseInt(cacheTime) : Infinity;
        const cacheValidMs = 2 * 60 * 1000; // 2 minutes (fast navigation)
        const staleMs = 5000; // refresh in background if older than 5s

        if (cached) {
          try {
            const json = JSON.parse(cached);
            if (mounted) {
              setData(json);
              console.log(`[Cache] Showing cached data (${(cacheAgeMs / 1000).toFixed(1)}s old)`);
            }
          } catch {}
        }

        // Fetch fresh data from API
        // If we have reasonably fresh cache, skip the blocking fetch
        if (cached && cacheAgeMs < staleMs) return;

        // Map section ID to API endpoint
        const sectionPath = {
          overview: '/api/dashboard/overview',
          ai_chat: '/api/dashboard/ai-chat',
          voice: '/api/dashboard/voice',
          appointments: '/api/dashboard/appointments',
          crm: '/api/dashboard/crm',
        }[section] || '/api/hospital/dashboard?section=' + section;

        const startTime = performance.now();
        const res = await fetch(sectionPath, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const endTime = performance.now();
        console.log(`[API] ${sectionPath} took ${(endTime - startTime).toFixed(0)}ms`);
        
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }
        
        const json = await res.json();
        
        if (mounted) {
          // Validate response based on section type
          const isValid = {
            overview: () => json.stats && json.sourceData && json.weeklyData,
            ai_chat: () => json.chat && json.aiAgents && json.faqTopics,
            voice: () => json.voice && json.callData && json.liveQueue,
            appointments: () => json.appointments && Array.isArray(json.appointments),
            crm: () => json.patients && Array.isArray(json.patients),
          }[section]?.() ?? false;

          if (!isValid) {
            throw new Error('Incomplete data received from API');
          }
          setData(json);
          // Cache the response
          localStorage.setItem(cacheKey, JSON.stringify(json));
          localStorage.setItem(cacheKey + '_time', now.toString());
        }
      } catch (err) {
        if (aborted) return; // Request was cancelled - don't log
        console.error('Failed to fetch dashboard data:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      }
    };
    load();
    
    return () => {
      mounted = false;
      aborted = true;
      // Signal the abort without calling abort() to avoid errors in Next.js
      // The request will terminate naturally with the aborted flag set
      if (controller.signal && !controller.signal.aborted) {
        // Use a microtask to defer abort() and prevent synchronous errors
        queueMicrotask(() => {
          if (!controller.signal.aborted) {
            controller.abort();
          }
        });
      }
    };
  }, [section]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: C.bg, fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif", color: C.text }}>
      <style>{`
        @keyframes ping { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:0.6;transform:scale(2)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        input::placeholder { color: ${C.textMuted}; }
        input { font-family: inherit; }
        button { font-family: inherit; }
        @media (max-width: 980px) {
          .header-actions { gap: 6px !important; flex-wrap: wrap; justify-content: flex-end; }
          .header-search { width: 120px !important; }
        }
      `}</style>
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{TAB_LABEL[section]}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={() => setLiveMode(!liveMode)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: liveMode ? C.greenGlow : 'transparent', border: `1px solid ${liveMode ? C.green + '50' : C.border}`, color: liveMode ? C.green : C.textMuted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: liveMode ? C.green : C.textMuted, display: 'inline-block' }} />
            {liveMode ? 'Live Mode' : 'Paused'}
          </button>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
            <input className="header-search" placeholder="Search..." style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, outline: 'none', width: 180 }} />
          </div>
          <button type="button" style={{ position: 'relative', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, cursor: 'pointer' }} onClick={() => alert('Notifications feature coming soon')}>
            <Bell size={16} color={C.textMuted} />
            <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: C.red, borderRadius: '50%', fontSize: 9, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>5</span>
          </button>
          <button type="button" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, cursor: 'pointer' }} onClick={() => window.location.href = '/dashboard/settings'}>
            <Settings size={16} color={C.textMuted} />
          </button>
        </div>
      </header>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!data ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: C.textMuted, fontSize: 13, gap: 16 }}>
            {error ? (
              <>
                <div style={{ fontSize: 14, color: C.red }}>⚠️ {error}</div>
                <button 
                  onClick={() => window.location.reload()} 
                  style={{ padding: '8px 16px', background: C.accent, color: C.bg, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <div style={{ animation: 'spin 1s linear infinite' }}>⏳</div>
                <div>Loading...</div>
              </>
            )}
          </div>
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            {section === 'overview' && (
              <OverviewTab
                stats={D.stats}
                sourceData={D.sourceData}
                callData={D.callData}
                weeklyData={D.weeklyData}
                deptData={D.deptData}
                aiAgents={D.aiAgents}
                recentLeads={D.recentLeads}
              />
            )}
            {section === 'ai_chat' && <AIChatTab faqTopics={D.faqTopics} chat={D.chat} stats={D.stats} />}
            {section === 'voice' && <VoiceTab liveQueue={D.liveQueue} voice={D.voice} voiceScenarioStats={D.voiceScenarioStats} />}
            {section === 'appointments' && <AppointmentsTab appointments={D.appointments} />}
            {section === 'crm' && <CRMTab patients={D.patients} stats={D.stats} />}
          </Suspense>
        )}
      </div>
    </div>
  );
}
