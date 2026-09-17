//@ts-nocheck
'use client';
import { useState, useEffect } from "react";
import {
    MessageCircle, UserPlus, CalendarCheck, Brain, Clock,
    Bot, Send, Globe, Smartphone, MessageSquare, ArrowUpRight
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

const Badge = ({ children, color = "gray", size = "md" }) => {
    const colors = { green: [C.green, C.greenGlow], accent: [C.accent, C.accentGlow], amber: [C.amber, `${C.amber}20`], red: [C.red, `${C.red}20`], purple: [C.purple, `${C.purple}20`], gray: [C.textMuted, `${C.textMuted}10`] };
    const [textColor, bgColor] = colors[color] || colors.gray;
    return <span style={{ display: "inline-block", fontSize: size === "md" ? 10 : 8, padding: size === "md" ? "3px 8px" : "2px 6px", borderRadius: 6, background: bgColor, color: textColor, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
};

export function AIChatTab({ faqTopics, chat, stats }) {
    const [chatDemo, setChatDemo] = useState([
        { role: "ai", text: "Hello! Welcome to City Hospital. How can I help you today? Are you looking to book an appointment or have a query?", time: "10:00 AM" },
        { role: "user", text: "I want to book an appointment with a cardiologist", time: "10:02 AM" },
        { role: "ai", text: "Great! We have excellent cardiologists available. We have Dr. Kapoor (Mon/Wed/Fri) and Dr. Mehta (Tue/Thu/Sat). Which day works for you?", time: "10:02 AM" },
        { role: "user", text: "Tomorrow afternoon", time: "10:03 AM" },
        { role: "ai", text: "Perfect! Dr. Mehta has slots available tomorrow (Thu) at 3:00 PM, 4:00 PM, and 4:30 PM. Which would you prefer?", time: "10:03 AM" },
    ]);
    const [input, setInput] = useState("");
    const [typing, setTyping] = useState(false);

    const send = () => {
        if (!input.trim()) return;
        setChatDemo(prev => [...prev, { role: "user", text: input, time: "Now" }]);
        setInput("");
        setTyping(true);
        setTimeout(() => {
            setTyping(false);
            setChatDemo(prev => [...prev, {
                role: "ai",
                text: "Thank you! I've noted your preference. Can I have your name and contact number to confirm the appointment?",
                time: "Now"
            }]);
        }, 1500);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
                <StatCard icon={MessageCircle} label="Active Chats" value={chat?.activeChats ?? 0} color={C.accent} sub="Live channels" />
                <StatCard icon={UserPlus} label="Leads Today" value={stats?.todayLeads ?? 0} trend="+0%" color={C.green} sub="via chat channels" />
                <StatCard icon={CalendarCheck} label="Booked via Chat" value={chat?.bookedViaChat ?? 0} color={C.purple} sub="AI assisted" />
                <StatCard icon={Brain} label="FAQ Resolved" value={faqTopics?.length ? `${Math.min(100, 80 + faqTopics.length)}%` : "0%"} color={C.amber} sub="Auto intent detection" />
                <StatCard icon={Clock} label="Avg Response" value={`${chat?.avgResponseSec ?? 0}s`} color={C.accent} sub="Instant AI reply" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 20 }}>
                <Card style={{ display: "flex", flexDirection: "column" }}>
                    <SectionTitle icon={MessageCircle} title="Live Chat Preview" subtitle="Real conversation simulation" />
                    <div style={{ background: C.surface, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Bot size={18} color="#fff" />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Hospital AI Assistant</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <Pulse color="green" size={6} />
                                    <span style={{ fontSize: 10, color: C.green }}>Online</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                            <Badge color="green">WhatsApp</Badge>
                            <Badge color="accent">Website</Badge>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, minHeight: 260, maxHeight: 320, padding: "4px 0" }}>
                        {chatDemo.map((msg, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                                {msg.role === "ai" && (
                                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.accentGlow, border: `1px solid ${C.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <Bot size={12} color={C.accent} />
                                    </div>
                                )}
                                <div style={{
                                    maxWidth: "75%", padding: "8px 12px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                                    background: msg.role === "user" ? `linear-gradient(135deg, ${C.accent}cc, ${C.purple}cc)` : C.surface,
                                    border: msg.role === "user" ? "none" : `1px solid ${C.border}`,
                                    fontSize: 12, color: C.text, lineHeight: 1.5
                                }}>
                                    {msg.text}
                                    <div style={{ fontSize: 9, color: msg.role === "user" ? "rgba(255,255,255,0.5)" : C.textMuted, marginTop: 4 }}>{msg.time}</div>
                                </div>
                            </div>
                        ))}
                        {typing && (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.accentGlow, border: `1px solid ${C.accent}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Bot size={12} color={C.accent} />
                                </div>
                                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "12px 12px 12px 2px", padding: "10px 14px", display: "flex", gap: 4 }}>
                                    {[0, 1, 2].map(i => (
                                        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.textMuted, display: "inline-block", animation: `bounce 1s ${i * 0.2}s infinite` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <input
                            value={input} onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && send()}
                            placeholder="Type a message..."
                            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 12, outline: "none" }}
                        />
                        <button onClick={send} style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: "none", borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                            <Send size={14} color="#fff" />
                        </button>
                    </div>
                </Card>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <Card>
                        <SectionTitle icon={Brain} title="Intent Detection" subtitle="What patients are asking" />
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {faqTopics.map(f => (
                                <div key={f.topic} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}20` }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                            <span style={{ fontSize: 12, color: C.text }}>{f.topic}</span>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                <span style={{ fontSize: 10, color: C.textMuted }}>{f.count} queries</span>
                                                <Badge color="green">{f.handled} AI</Badge>
                                                <span style={{ fontSize: 10, color: f.trend.startsWith("+") ? C.green : C.red }}>{f.trend}</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 4, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: f.handled, background: `linear-gradient(90deg, ${C.green}, ${C.accent})` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card>
                        <SectionTitle icon={Globe} title="Active Channels" subtitle="Chat deployment status" />
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {[
                                { name: "Website Chatbot", desc: "Embedded on hospital website", status: "live", chats: 47, icon: Globe, color: C.accent },
                                { name: "WhatsApp AI", desc: "Business API integration", status: "live", chats: 83, icon: Smartphone, color: C.green },
                                { name: "WhatsApp Broadcast", desc: "Bulk reminders & campaigns", status: "live", chats: 122, icon: MessageSquare, color: C.purple },
                            ].map(ch => (
                                <div key={ch.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}20` }}>
                                    <div style={{ background: `${ch.color}20`, borderRadius: 8, padding: 8 }}>
                                        <ch.icon size={16} color={ch.color} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{ch.name}</div>
                                        <div style={{ fontSize: 10, color: C.textMuted }}>{ch.desc}</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{ch.chats}</div>
                                        <div style={{ fontSize: 9, color: C.textMuted }}>today</div>
                                    </div>
                                    <Badge color="green">Live</Badge>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
