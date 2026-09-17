//@ts-nocheck
'use client';
import { useState, useEffect } from "react";
import {
  UserPlus, Calendar, PhoneCall, Target, Heart, DollarSign,
  PieChart as PieChartIcon, TrendingUp, Stethoscope, Activity, ArrowUpRight, Clock,
  IndianRupee
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

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

const tooltipStyle = { backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text };

const Pulse = ({ color = "green", size = 8 }) => (
  <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
    <span style={{
      position: "absolute", inset: 0, borderRadius: "50%",
      background: color === "green" ? C.green : color === "accent" ? C.accent : color === "amber" ? C.amber : C.red,
      opacity: 0.4, animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite"
    }} />
    <span style={{
      position: "relative", width: size, height: size, borderRadius: "50%",
      background: color === "green" ? C.green : color === "accent" ? C.accent : color === "amber" ? C.amber : C.red,
    }} />
  </span>
);

const Card = ({ children, onClick, style }) => (
  <div onClick={onClick} style={{
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: 20, ...style,
    cursor: onClick ? "pointer" : "default",
    transition: "border-color 0.2s",
  }}
    onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = C.accentGlow)}
    onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = C.border)}
  >
    {children}
  </div>
);

const StatCard = ({ icon: Icon, label, value, sub, subColor = C.green, color = C.accent, trend }) => {
  const [count, setCount] = useState(0);
  const num = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  const prefix = String(value).match(/^[^0-9]*/)?.[0] || "";
  const suffix = String(value).match(/[^0-9.]*$/)?.[0] || "";
  useEffect(() => {
    let s = 0, t = setInterval(() => {
      s += num / 40;
      if (s >= num) { setCount(num); clearInterval(t); } else setCount(s);
    }, 20);
    return () => clearInterval(t);
  }, [num]);
  return (
    <Card style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `${color}08` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ background: `${color}20`, borderRadius: 10, padding: 8 }}>
          <Icon size={18} color={color} />
        </div>
        {trend && (
          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: C.green, fontWeight: 600 }}>
            <ArrowUpRight size={12} />{trend}
          </span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: -1, marginBottom: 2 }}>
        {prefix}{num % 1 !== 0 ? num.toFixed(1) : Math.floor(count).toLocaleString("en-IN")}{suffix}
      </div>
      <div style={{ fontSize: 12, color: C.textMuted }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: subColor, marginTop: 4, fontWeight: 500 }}>{sub}</div>}
    </Card>
  );
};

const SectionTitle = ({ icon: Icon, title, subtitle, action }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ background: C.accentGlow, borderRadius: 10, padding: 8 }}>
        <Icon size={18} color={C.accent} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: C.textMuted }}>{subtitle}</div>}
      </div>
    </div>
    {action && <button style={{ fontSize: 11, color: C.accent, background: "none", border: "none", cursor: "pointer" }}>{action}</button>}
  </div>
);

const statusConfig = {
  confirmed: { label: "Confirmed", color: "green" },
  reminder_sent: { label: "Reminder Sent", color: "accent" },
  no_show: { label: "No Show", color: "red" },
  pending: { label: "Pending", color: "amber" },
  new: { label: "New", color: "accent" },
  converted: { label: "Converted", color: "green" },
  followup: { label: "Follow-up", color: "amber" },
  active: { label: "Active", color: "green" },
};

const Badge = ({ children, color = "gray", size = "md" }) => {
  const colors = { green: [C.green, C.greenGlow], accent: [C.accent, C.accentGlow], amber: [C.amber, `${C.amber}20`], red: [C.red, `${C.red}20`], purple: [C.purple, `${C.purple}20`], gray: [C.textMuted, `${C.textMuted}10`] };
  const [textColor, bgColor] = colors[color] || colors.gray;
  return <span style={{ display: "inline-block", fontSize: size === "md" ? 10 : 8, padding: size === "md" ? "3px 8px" : "2px 6px", borderRadius: 6, background: bgColor, color: textColor, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
};

export function OverviewTab({ stats, sourceData = [], callData = [], weeklyData = [], deptData = [], aiAgents = [], recentLeads = [] }) {
  // Ensure array variables are actually arrays to prevent map errors
  const safeAiAgents = Array.isArray(aiAgents) ? aiAgents : [];
  const safeCallData = Array.isArray(callData) ? callData : [];
  const safeSourceData = Array.isArray(sourceData) ? sourceData : [];
  const safeWeeklyData = Array.isArray(weeklyData) ? weeklyData : [];
  const safeDeptData = Array.isArray(deptData) ? deptData : [];
  const safeRecentLeads = Array.isArray(recentLeads) ? recentLeads : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}>
        <StatCard icon={UserPlus} label="Today's Leads" value={stats.todayLeads} color={C.accent} sub="vs yesterday" />
        <StatCard icon={Calendar} label="Appointments" value={stats.appointmentsToday} color={C.green} sub={`${stats.appointmentsBooked} booked`} />
        <StatCard icon={PhoneCall} label="Calls Today" value={stats.callsToday} color={C.purple} sub={`${stats.callsAnswered} answered`} />
        <StatCard icon={Target} label="Conversion" value={`${stats.conversionRate}%`} color={C.amber} sub="Lead to appt" />
        <StatCard icon={Heart} label="Satisfaction" value={`${stats.satisfaction}/5`} color={C.red} sub="Patient rating" />
        <StatCard icon={IndianRupee} label="Revenue Today" value={`₹${(stats.revenueToday / 100000).toFixed(2)}L`} color={C.green} sub="Today's billing" />
      </div>

      {/* <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}>
        <StatCard icon={UserPlus} label="Total Patients" value={stats.totalPatients} color={C.accent} sub="All time" />
        <StatCard icon={UserPlus} label="New This Month" value={stats.newPatientsThisMonth ?? 0} color={C.green} sub="Patient CRM" />
        <StatCard icon={Target} label="Returning" value={stats.returningPatients ?? 0} color={C.purple} sub="Visits > 1" />
        <StatCard icon={Activity} label="AI Enriched" value={`${Math.round(((stats.aiEnrichedPatients ?? 0) / Math.max(1, stats.totalPatients ?? 1)) * 100)}%`} color={C.amber} sub="Tagged patients" />
        <StatCard icon={Calendar} label="All Appointments" value={stats.totalAppointmentsAllTime ?? 0} color={C.green} sub="Past + future" />
        <StatCard icon={Clock} label="Upcoming" value={stats.upcomingAppointmentsAllTime ?? 0} color={C.accent} sub="From today" />
      </div> */}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
        <Card>
          <SectionTitle icon={PieChartIcon} title="Lead Sources" subtitle="Where patients come from" />
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={safeSourceData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                {safeSourceData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n, p) => [`${v}%`, p.payload.name]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {safeSourceData.map(s => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: C.textDim }}>{s.name}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{s.count} leads</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{s.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={PhoneCall} title="Call Activity" subtitle="Inbound vs Outbound vs Missed" />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={safeCallData}>
              <defs>
                {[["ib", C.accent], ["ob", C.green], ["ms", C.red]].map(([id, color]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="time" stroke={C.textMuted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={C.textMuted} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="inbound" name="Inbound" stroke={C.accent} strokeWidth={2} fill="url(#ib)" />
              <Area type="monotone" dataKey="outbound" name="Outbound" stroke={C.green} strokeWidth={2} fill="url(#ob)" />
              <Area type="monotone" dataKey="missed" name="Missed" stroke={C.red} strokeWidth={2} fill="url(#ms)" />
              <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card>
          <SectionTitle icon={TrendingUp} title="Weekly Performance" subtitle="Leads · Appointments · Conversions" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={safeWeeklyData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="day" stroke={C.textMuted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={C.textMuted} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="leads" name="Leads" fill={C.accent} radius={[4, 4, 0, 0]} />
              <Bar dataKey="appointments" name="Appointments" fill={C.green} radius={[4, 4, 0, 0]} />
              <Bar dataKey="conversions" name="Conversions" fill={C.purple} radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle icon={Stethoscope} title="By Department" subtitle="Leads & bookings" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {safeDeptData.map(d => (
              <div key={d.dept}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.textDim }}>{d.dept}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{d.leads} leads</span>
                    <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>{d.bookings} booked</span>
                  </div>
                </div>
                <div style={{ height: 5, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(d.bookings / d.leads) * 100}%`, background: `linear-gradient(90deg, ${C.green}, ${C.accent})`, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle icon={UserPlus} title="Recent Leads" subtitle="Live patient enquiries & AI interactions" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Patient", "Source", "Intent", "Department", "Priority", "Status", "Time", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: C.textMuted, fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safeRecentLeads.map(lead => (
                <tr key={lead.id} style={{ borderBottom: `1px solid ${C.border}20` }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ color: C.text, fontWeight: 600 }}>{lead.name}</div>
                    <div style={{ color: C.textMuted, fontSize: 10 }}>{lead.phone}</div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge color={lead.source === "chatbot" ? "accent" : lead.source === "whatsapp" ? "green" : "purple"}>
                      {lead.source === "chatbot" ? "Chat" : lead.source === "whatsapp" ? "WhatsApp" : "Voice"}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge color={lead.intent === "booking" ? "green" : lead.intent === "pricing" ? "amber" : "accent"}>
                      {lead.intent}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 12px", color: C.textDim }}>{lead.dept}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge color={lead.priority === "hot" ? "red" : "amber"}>{lead.priority === "hot" ? "🔥 Hot" : "⚡ Warm"}</Badge>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge color={statusConfig[lead.status]?.color || "gray"}>{statusConfig[lead.status]?.label || lead.status}</Badge>
                  </td>
                  <td style={{ padding: "10px 12px", color: C.textMuted }}>{lead.time}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ background: C.accentGlow, border: `1px solid ${C.accent}40`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: C.accent, fontSize: 10 }}>Call</button>
                      <button style={{ background: C.greenGlow, border: `1px solid ${C.green}40`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: C.green, fontSize: 10 }}>Chat</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>AI Agents — Live Status</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {safeAiAgents.map(agent => (
            <Card key={agent.id} style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{agent.name}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{agent.lang} · {agent.type}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Pulse color="green" size={7} />
                  <span style={{ fontSize: 10, color: C.green }}>Active</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { label: agent.type === "chat" ? "Chats" : "Calls", val: agent.callsToday },
                  { label: "Booked", val: agent.booked },
                ].map(m => (
                  <div key={m.label} style={{ background: C.surface, borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{m.val}</div>
                    <div style={{ fontSize: 9, color: C.textMuted }}>{m.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: C.textMuted }}>Conversion</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{agent.conv}%</span>
              </div>
              <div style={{ height: 4, background: C.border, borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(agent.conv * 2.5, 100)}%`, background: `linear-gradient(90deg, ${C.green}, ${C.accent})` }} />
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 6 }}>Last active: {agent.last}</div>
            </Card>
          ))}
        </div>
      </div>
      
    </div>
  );
}
