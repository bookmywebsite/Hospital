'use client';

import { useState, useEffect } from 'react';
import { Users, Clock, RefreshCw, CheckCircle, Zap, Calendar } from 'lucide-react';

interface Lead { id: string; email: string; firstName?: string | null; lastName?: string | null; phone?: string | null; status: string; }
interface TeamMember { id: string; isAvailable: boolean; currentLeadCount: number; maxLeadsPerDay: number; totalAssigned: number; languages: string[]; user: { firstName?: string | null; lastName?: string | null; email: string; }; }
interface ScheduledJob { id: string; jobType: string; targetId: string; scheduledFor: string; status: string; attempts: number; leadName?: string; leadPhone?: string; }

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  PENDING:    { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24' },
  PROCESSING: { bg: 'rgba(99,102,241,0.15)',  text: '#a5b4fc' },
  COMPLETED:  { bg: 'rgba(16,185,129,0.15)',  text: '#6ee7b7' },
  FAILED:     { bg: 'rgba(239,68,68,0.15)',   text: '#fca5a5' },
};

const card = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '20px', padding: '20px',
} as React.CSSProperties;

export default function AssignmentPage() {
  const [leads, setLeads]   = useState<Lead[]>([]);
  const [team, setTeam]     = useState<TeamMember[]>([]);
  const [jobs, setJobs]     = useState<ScheduledJob[]>([]);
  const [optimisticJobs, setOptimisticJobs] = useState<ScheduledJob[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [log, setLog]       = useState<string[]>([]);

  useEffect(() => { fetchAll(); }, []);

  function addLog(msg: string) {
    setLog((prev) => [`[${new Date().toLocaleTimeString('en-IN')}] ${msg}`, ...prev.slice(0, 19)]);
  }

  async function fetchAll() { await Promise.all([fetchLeads(), fetchTeam(), fetchJobs()]); }
  async function fetchLeads() { const r = await fetch('/api/leads').catch(() => null); const d = await r?.json().catch(() => null); setLeads(d?.leads ?? []); }
  async function fetchTeam()  { const r = await fetch('/api/team').catch(() => null);  const d = await r?.json().catch(() => null); setTeam(d?.members ?? []); }
  async function fetchJobs()  {
    const r = await fetch('/api/scheduler').catch(() => null);
    const d = await r?.json().catch(() => null);
    const fetchedJobs = d?.jobs ?? [];
    setJobs(fetchedJobs);
    setOptimisticJobs((prev) => prev.filter((opt) => !fetchedJobs.some((job: ScheduledJob) => job.targetId === opt.targetId)));
  }

  async function handleAddSelf() {
    setLoading(true);
    const res = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_self', languages: ['EN', 'KN', 'HI'] }) });
    const d   = await res.json();
    addLog(d.success ? `✅ Added as team member (ID: ${d.member.id.slice(0, 8)}...)` : `❌ ${d.error}`);
    fetchTeam(); setLoading(false);
  }

  async function handleBulkAssign() {
    const unassigned = leads.filter(l => l.status === 'NEW' || l.status === 'CONTACTED');
    if (!unassigned.length) { addLog('⚠️ No unassigned leads found'); return; }
    setLoading(true);
    const res = await fetch('/api/assignment/assign', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadIds: unassigned.map(l => l.id) }) });
    const d   = await res.json();
    addLog(`✅ Bulk assign: ${d.assigned} assigned, ${d.failed} failed`);
    fetchLeads(); setLoading(false);
  }

  async function handleBulkFollowUp() {
    setLoading(true);
    const body: any = { action: 'bulk_follow_up' };
    if (selectedLeadIds.length > 0) {
      body.leadIds = selectedLeadIds;
    }

    const res = await fetch('/api/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d   = await res.json();

    if (d.success) {
      addLog(`✅ Scheduled ${d.scheduled} follow-up calls${selectedLeadIds.length > 0 ? ' for selected leads' : ' for assigned leads'}`);
      setSelectedLeadIds([]);
    } else {
      addLog(`❌ ${d.error}`);
    }

    fetchJobs(); setLoading(false);
  }

  async function handleClearJobs() {
    setLoading(true);
    const res = await fetch('/api/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_pending' }),
    });
    const d   = await res.json();
    if (d.success) {
      addLog(`✅ Cleared ${d.deleted ?? 0} scheduled job(s)`);
      setSelectedLeadIds([]);
      setOptimisticJobs([]);
      fetchJobs();
    } else {
      addLog(`❌ ${d.error}`);
    }
    setLoading(false);
  }

  async function handleAssignLead(leadId: string) {
    setLoading(true);
    setSelectedLeadIds((prev) => {
      const alreadySelected = prev.includes(leadId);
      const nextSelection = alreadySelected ? prev.filter((id) => id !== leadId) : [...prev, leadId];

      setOptimisticJobs((jobs) => {
        const lead = leads.find((item) => item.id === leadId);
        if (!lead) return jobs;

        const optimisticId = `optimistic-${lead.id}`;
        const now = Date.now();
        const scheduledFor = new Date(now + 2 * 60 * 1000).toISOString();

        if (alreadySelected) {
          return jobs.filter((job) => job.id !== optimisticId);
        }

        const newJob: ScheduledJob = {
          id: optimisticId,
          jobType: 'CALL',
          targetId: lead.id,
          scheduledFor,
          status: 'PENDING',
          attempts: 0,
          leadName: lead.firstName ?? lead.email,
          leadPhone: lead.phone ?? '',
        };

        return [newJob, ...jobs.filter((job) => job.id !== optimisticId)];
      });

      addLog(alreadySelected ? '❌ Removed lead from scheduled follow-ups' : '✅ Added lead to scheduled follow-ups');
      return nextSelection;
    });
    setLoading(false);
  }

  async function handleToggleAvailability(memberId: string, current: boolean) {
    const res = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_availability', memberId, isAvailable: !current }) });
    const d   = await res.json();
    if (d.success) { addLog(`✅ Availability set to ${!current ? 'Available' : 'Unavailable'}`); fetchTeam(); }
  }

  function toggleLeadSelection(leadId: string) {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  }

  const actionBtns = [
    { label: 'Add Me as Team Member', icon: Users,    color: '#6366f1', handler: handleAddSelf },
    { label: 'Auto-Assign All Leads', icon: Zap,      color: '#3b82f6', handler: handleBulkAssign },
    { label: 'Schedule Follow-ups',   icon: Calendar, color: '#f59e0b', handler: handleBulkFollowUp },
    { label: 'Clear Scheduled Jobs',  icon: RefreshCw, color: '#ef4444', handler: handleClearJobs },
  ];

  const visibleJobs = [
    ...optimisticJobs,
    ...jobs.filter((job) => !optimisticJobs.some((opt) => opt.targetId === job.targetId)),
  ];

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>Assignment & Scheduler</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>Test lead auto-assignment and 24/7 scheduling</p>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '12px' }}>
        {actionBtns.map((btn) => (
          <button
            key={btn.label}
            onClick={btn.handler}
            disabled={loading}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              padding: '18px 12px', borderRadius: '16px', cursor: 'pointer',
              background: `${btn.color}18`, border: `1px solid ${btn.color}35`,
              color: '#fff', fontSize: '13px', fontWeight: 500,
              opacity: loading ? 0.5 : 1, transition: 'all 0.15s',
            }}
          >
            <btn.icon size={20} style={{ color: btn.color }} />
            {btn.label}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: '18px', color: 'rgba(255,255,255,0.55)', fontSize: '12px' }}>
        {selectedLeadIds.length > 0
          ? `Selected leads: ${selectedLeadIds.length}. Schedule follow-ups will target selected leads only.`
          : 'No selected leads. Schedule follow-ups will target assigned leads only.'}
      </div>

      {/* Four panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Team Members */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Users size={15} style={{ color: '#818cf8' }} />
              Team Members ({team.length})
            </div>
            <button onClick={fetchTeam} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw size={14} />
            </button>
          </div>
          {team.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.2)' }}>
              <Users size={28} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
              <p style={{ fontSize: '13px' }}>No team members yet</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>Click &ldquo;Add Me as Team Member&rdquo; above</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {team.map((member) => (
                <div key={member.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', margin: 0 }}>
                      {member.user.firstName ?? ''} {member.user.lastName ?? member.user.email}
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
                      {member.currentLeadCount}/{member.maxLeadsPerDay} leads · {member.totalAssigned} total · {member.languages.join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleAvailability(member.id, member.isAvailable)}
                    style={{
                      fontSize: '11px', fontWeight: 500, padding: '4px 10px', borderRadius: '100px', cursor: 'pointer', border: 'none',
                      background: member.isAvailable ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)',
                      color: member.isAvailable ? '#6ee7b7' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {member.isAvailable ? '🟢 Available' : '⚪ Unavailable'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scheduled Jobs */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Clock size={15} style={{ color: '#f59e0b' }} />
              Scheduled Jobs ({visibleJobs.length})
            </div>
            <button onClick={fetchJobs} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw size={14} />
            </button>
          </div>
          {visibleJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.2)' }}>
              <Clock size={28} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
              <p style={{ fontSize: '13px' }}>No pending jobs</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>Click &ldquo;Schedule Follow-ups&rdquo; to create jobs</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
              {visibleJobs.map((job) => (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', margin: 0 }}>
                      {job.jobType} · {job.leadName ?? job.leadPhone ?? job.targetId}
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
                      {job.leadPhone ? `Phone: ${job.leadPhone} · ` : ''}{new Date(job.scheduledFor).toLocaleString('en-IN')} · Attempt {job.attempts}
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '100px', background: STATUS_COLOR[job.status]?.bg ?? 'rgba(255,255,255,0.07)', color: STATUS_COLOR[job.status]?.text ?? 'rgba(255,255,255,0.4)' }}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leads — Assign Individually */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Zap size={15} style={{ color: '#3b82f6' }} />
              Leads — Assign Individually ({leads.length})
            </div>
            <button onClick={fetchLeads} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw size={14} />
            </button>
          </div>
          {leads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>No leads found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
              {leads.slice(0, 20).map((lead) => {
                const selected = selectedLeadIds.includes(lead.id);
                return (
                  <div key={lead.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '12px', background: selected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selected ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.06)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => handleAssignLead(lead.id)}
                          style={{
                            position: "absolute",
                            opacity: 0,
                            width: "100%",
                            height: "100%",
                            margin: 0,
                            cursor: "pointer",
                          }}
                        />
                        <span
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            border: "1.5px solid rgba(255,255,255,0.3)",
                            background: selected
                              ? "rgba(99,102,241,0.18)"
                              : "rgba(255,255,255,0.03)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {selected && (
                            <span
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: "#8b5cf6",
                              }}
                            />
                          )}
                        </span>
                      </label>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', margin: 0 }}>{lead.firstName ?? lead.email}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>{lead.status} · {lead.phone ?? 'no phone'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAssignLead(lead.id)}
                      disabled={loading}
                      style={{ fontSize: '11px', fontWeight: 500, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', border: 'none', background: selected ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)', color: selected ? '#86efac' : '#93c5fd', opacity: loading ? 0.5 : 1 }}
                    >
                      {selected ? 'Scheduled' : 'Schedule'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
            <CheckCircle size={15} style={{ color: '#10b981' }} />
            Activity Log
          </div>
          {log.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>
              No activity yet — run an action above
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '260px', overflowY: 'auto', fontFamily: 'monospace' }}>
              {log.map((entry, i) => (
                <p key={i} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '7px 10px', margin: 0 }}>
                  {entry}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}