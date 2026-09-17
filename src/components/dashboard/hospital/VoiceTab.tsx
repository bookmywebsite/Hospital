//@ts-nocheck
'use client';
import { useState, useEffect } from "react";
import {
  PhoneIncoming, PhoneOutgoing, PhoneMissed, CalendarCheck, Clock,
  Phone, XCircle, Activity, Volume2, Bell, Edit, ArrowUpRight, PhoneForwarded
} from "lucide-react";

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

const Badge = ({ children, color = "gray", size = "md" }) => {
  const colors = { green: [C.green, C.greenGlow], accent: [C.accent, C.accentGlow], amber: [C.amber, `${C.amber}20`], red: [C.red, `${C.red}20`], purple: [C.purple, `${C.purple}20`], gray: [C.textMuted, `${C.textMuted}10`] };
  const [textColor, bgColor] = colors[color] || colors.gray;
  return <span style={{ display: "inline-block", fontSize: size === "md" ? 10 : 8, padding: size === "md" ? "3px 8px" : "2px 6px", borderRadius: 6, background: bgColor, color: textColor, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
};

export function VoiceTab({ liveQueue, voice, voiceScenarioStats }) {
  const [callSim, setCallSim] = useState(null);
  const [simTimer, setSimTimer] = useState(0);
  useEffect(() => {
    let interval;
    if (callSim === "active") {
      interval = setInterval(() => setSimTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callSim]);
  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const inboundScenarios = voiceScenarioStats?.inbound || [];
  const outboundScenarios = voiceScenarioStats?.outbound || [];
  const inboundTotal = inboundScenarios.reduce((sum, x) => sum + (x.count || 0), 0);
  const outboundTotal = outboundScenarios.reduce((sum, x) => sum + (x.count || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <StatCard icon={PhoneIncoming} label="Inbound Today" value={voice?.inbound ?? 0} color={C.green} sub="Live call logs" />
        <StatCard icon={PhoneOutgoing} label="Outbound Today" value={voice?.outbound ?? 0} trend="+0%" color={C.accent} sub="Follow-up calls" />
        <StatCard icon={PhoneMissed} label="Missed Calls" value={voice?.missed ?? 0} color={C.red} sub={`${voice?.callbacks?.done ?? 0} auto-callback`} />
        <StatCard icon={CalendarCheck} label="Booked via Voice" value={voice?.booked ?? 0} color={C.purple} sub="AI assisted" />
        <StatCard icon={Clock} label="Avg Call Duration" value={`${Math.floor((voice?.avgDurationSec ?? 0)/60)}m ${(voice?.avgDurationSec ?? 0)%60}s`} color={C.amber} sub="AI handled" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 20 }}>
        <Card>
          <SectionTitle icon={Phone} title="AI Receptionist" subtitle="Inbound call handler — live demo" />
          <div style={{ background: C.surface, borderRadius: 14, padding: 20, border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 16px",
              background: callSim === "active" ? `linear-gradient(135deg, ${C.green}, ${C.accent})` : callSim === "ringing" ? `linear-gradient(135deg, ${C.amber}, ${C.green})` : C.surface,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: callSim === "active" ? `0 0 30px ${C.green}60` : "none",
              transition: "all 0.4s", position: "relative", border: `2px solid ${C.border}`
            }}>
              <Phone size={28} color={callSim ? "#fff" : C.textMuted} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              {callSim === "active" ? "Call in Progress" : callSim === "ringing" ? "Incoming Call..." : "AI Receptionist Ready"}
            </div>
            {callSim === "active" && (
              <>
                <div style={{ fontFamily: "monospace", fontSize: 22, color: C.green, marginBottom: 8 }}>{fmtTime(simTimer)}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>Rajesh Kumar · +91 87654 32109</div>
                <Badge color="accent">Transcribing live</Badge>
                <div style={{ marginTop: 12, padding: "10px 14px", background: C.card, borderRadius: 10, textAlign: "left", fontSize: 11, lineHeight: 1.8, color: C.textDim }}>
                  <span style={{ color: C.accent }}>AI:</span> "Good morning! Thank you for calling City Hospital."<br />
                  <span style={{ color: C.purple }}>Patient:</span> "I want to book an appointment..."<br />
                  <span style={{ color: C.accent }}>AI:</span> "Of course! Let me check availability..."
                </div>
              </>
            )}
            {callSim === "ringing" && (
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>+91 87654 32109 · Connecting...</div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
              {!callSim && (
                <>
                  <button onClick={() => { setCallSim("ringing"); setTimeout(() => setCallSim("active"), 2000); }}
                    style={{ background: `linear-gradient(135deg, ${C.green}, ${C.accent})`, border: "none", borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <PhoneIncoming size={14} /> Simulate Inbound
                  </button>
                  <button onClick={() => setCallSim("active")}
                    style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: "none", borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <PhoneOutgoing size={14} /> Simulate Outbound
                  </button>
                </>
              )}
              {callSim && (
                <button onClick={() => { setCallSim(null); setSimTimer(0); }}
                  style={{ background: `rgba(255,77,109,0.2)`, border: `1px solid ${C.red}`, borderRadius: 10, padding: "8px 14px", color: C.red, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <XCircle size={14} /> End Call
                </button>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 14, background: `${C.amber}10`, borderRadius: 12, border: `1px solid ${C.amber}30` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <PhoneForwarded size={16} color={C.amber} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.amber }}>Auto Missed-Call Callback</span>
              <Badge color="green">Active</Badge>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
              {(voice?.callbacks?.missed ?? 0)} missed calls detected today → AI called back within 60 seconds → {(voice?.callbacks?.done ?? 0)} connected → {(voice?.callbacks?.booked ?? 0)} booked
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {[{ label: "Missed", val: voice?.callbacks?.missed ?? 0, color: C.text }, { label: "Called Back", val: voice?.callbacks?.done ?? 0, color: C.green }, { label: "Booked", val: voice?.callbacks?.booked ?? 0, color: C.accent }].map(m => (
                <div key={m.label} style={{ flex: 1, textAlign: "center", background: C.surface, borderRadius: 8, padding: "8px 4px" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.val}</div>
                  <div style={{ fontSize: 9, color: C.textMuted }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <SectionTitle icon={Activity} title="Live Call Queue" subtitle="Real-time status" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {liveQueue.map(call => (
                <div key={call.id} style={{
                  padding: "10px 14px", borderRadius: 12,
                  background: call.status === "in-progress" ? `${C.green}10` : call.status === "ringing" ? `${C.amber}10` : C.surface,
                  border: `1px solid ${call.status === "in-progress" ? C.green + "40" : call.status === "ringing" ? C.amber + "40" : C.border}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {call.status === "in-progress" && <Pulse color="green" size={7} />}
                      {call.status === "ringing" && <Pulse color="amber" size={7} />}
                      {call.status === "queued" && <Clock size={12} color={C.textMuted} />}
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{call.name}</span>
                      <Badge color={call.status === "in-progress" ? "green" : call.status === "ringing" ? "amber" : "gray"}>
                        {call.status === "in-progress" ? "In Call" : call.status === "ringing" ? "Ringing" : "Queued"}
                      </Badge>
                    </div>
                    {call.status === "in-progress" && (
                      <span style={{ fontFamily: "monospace", fontSize: 13, color: C.green }}>{call.duration}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textMuted }}>
                    <span>{call.dept} · {call.phone}</span>
                    <span>via {call.agent}</span>
                  </div>
                  {call.sentiment && call.status === "in-progress" && (
                    <div style={{ marginTop: 6 }}>
                      <Badge color={call.sentiment === "positive" ? "green" : "amber"}>
                        {call.sentiment === "positive" ? "😊 Positive" : "😐 Neutral"}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card>
              <SectionTitle icon={Volume2} title="Inbound Scenarios" subtitle={`${inboundScenarios.length} active`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {inboundScenarios.map((s) => {
                  const pct = inboundTotal > 0 ? Math.max(4, Math.round((s.count / inboundTotal) * 100)) : 0;
                  return (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                          <span style={{ color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                          <span style={{ color: C.textMuted }}>{s.count}</span>
                        </div>
                        <div style={{ height: 5, background: C.surface, borderRadius: 4, marginTop: 5, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: s.color, borderRadius: 4 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <SectionTitle icon={Bell} title="Outbound Scenarios" subtitle={`${outboundScenarios.length} active`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {outboundScenarios.map((s) => {
                  const pct = outboundTotal > 0 ? Math.max(4, Math.round((s.count / outboundTotal) * 100)) : 0;
                  return (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                          <span style={{ color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                          <span style={{ color: C.textMuted }}>{s.count}</span>
                        </div>
                        <div style={{ height: 5, background: C.surface, borderRadius: 4, marginTop: 5, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: s.color, borderRadius: 4 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
