//@ts-nocheck
'use client';
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Calendar,
  CalendarCheck,
  CheckCircle,
  Clock,
  Edit,
  Phone,
  Plus,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { getDateRangeFromPreset, type DatePreset } from "@/lib/dashboard-date-filters";

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

const Card = ({ children, onClick, style }) => (
  <div onClick={onClick} style={{
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: 20, ...style,
    cursor: onClick ? "pointer" : "default",
    transition: "border-color 0.2s",
  }}>
    {children}
  </div>
);

const StatCard = ({ icon: Icon, label, value, sub, subColor = C.green, color = C.accent, trend }) => {
  const num = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  const prefix = String(value).match(/^[^0-9]*/)?.[0] || "";
  const suffix = String(value).match(/[^0-9.]*$/)?.[0] || "";
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
        {prefix}{num % 1 !== 0 ? num.toFixed(1) : Math.floor(num).toLocaleString("en-IN")}{suffix}
      </div>
      <div style={{ fontSize: 12, color: C.textMuted }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: subColor, marginTop: 4, fontWeight: 500 }}>{sub}</div>}
    </Card>
  );
};

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
    <div style={{ background: C.accentGlow, borderRadius: 10, padding: 8 }}>
      <Icon size={18} color={C.accent} />
    </div>
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: C.textMuted }}>{subtitle}</div>}
    </div>
  </div>
);

const statusConfig = {
  confirmed: { label: "Confirmed", color: "green" },
  reminder_sent: { label: "Reminder Sent", color: "accent" },
  no_show: { label: "No Show", color: "red" },
  pending: { label: "Pending", color: "amber" },
  cancelled: { label: "Cancelled", color: "red" },
};

const Badge = ({ children, color }) => {
  const colors = { green: [C.green, C.greenGlow], accent: [C.accent, C.accentGlow], amber: [C.amber, `${C.amber}20`], red: [C.red, `${C.red}20`], purple: [C.purple, `${C.purple}20`], gray: [C.textMuted, `${C.textMuted}10`] };
  const [textColor, bgColor] = colors[color] || colors.gray;
  return <span style={{ display: "inline-block", fontSize: 10, padding: "3px 8px", borderRadius: 6, background: bgColor, color: textColor, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
};

const ModalShell = ({ title, children, onClose, maxWidth = 560 }) => (
  <div style={{
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1002,
  }}>
    <div style={{
      background: C.surface, borderRadius: 16, padding: 24,
      maxWidth, width: "90%", maxHeight: "90vh", overflowY: "auto",
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 0 }}>
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const AppointmentEditModal = ({ appointment, departments, onClose, onSave }) => {
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({
    appointmentType: appointment.appointmentType || "OPD",
    departmentId: appointment.department?.id || "",
    doctorId: appointment.doctor?.id || "",
    scheduledDate: new Date(appointment.scheduledAt).toISOString().split("T")[0],
    scheduledTime: new Date(appointment.scheduledAt).toTimeString().slice(0, 5),
    notes: appointment.notes || "",
  });

  const loadDoctors = async (departmentName, date) => {
    if (!date) return;
    setLoadingDoctors(true);
    try {
      const qs = new URLSearchParams({ date });
      if (departmentName) qs.set("department", departmentName);
      const res = await fetch(`/api/doctors/available?${qs.toString()}`);
      const data = await res.json();
      setDoctors(data.doctors || []);
    } finally {
      setLoadingDoctors(false);
    }
  };

  useEffect(() => {
    const departmentName = departments.find((d) => d.id === form.departmentId)?.name;
    loadDoctors(departmentName, form.scheduledDate);
  }, []);

  const onField = async (name, value) => {
    const next = { ...form, [name]: value };
    if (name === "departmentId" || name === "scheduledDate") {
      const departmentName = departments.find((d) => d.id === (name === "departmentId" ? value : next.departmentId))?.name;
      next.doctorId = "";
      setForm(next);
      await loadDoctors(departmentName, name === "scheduledDate" ? value : next.scheduledDate);
      return;
    }
    setForm(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    await onSave({
      appointmentId: appointment.id,
      appointmentType: form.appointmentType,
      departmentId: form.departmentId || null,
      doctorId: form.doctorId || null,
      scheduledAt: new Date(`${form.scheduledDate}T${form.scheduledTime}`).toISOString(),
      notes: form.notes || null,
    });
  };

  return (
    <ModalShell title={`Update Appointment`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12, color: C.textMuted }}>{appointment.patient?.fullName || "Patient"}</div>
        <select value={form.appointmentType} onChange={(e) => onField("appointmentType", e.target.value)} style={{ width: "100%", padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}>
          <option value="OPD">OPD</option>
          <option value="CONSULTATION">Consultation</option>
          <option value="FOLLOW_UP">Follow-up</option>
          <option value="PROCEDURE">Procedure</option>
          <option value="URGENT">Urgent</option>
        </select>
        <select value={form.departmentId} onChange={(e) => onField("departmentId", e.target.value)} style={{ width: "100%", padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}>
          <option value="">Select department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input type="date" value={form.scheduledDate} onChange={(e) => onField("scheduledDate", e.target.value)} style={{ width: "100%", padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
          <input type="time" value={form.scheduledTime} onChange={(e) => onField("scheduledTime", e.target.value)} style={{ width: "100%", padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
        </div>
        <select value={form.doctorId} onChange={(e) => onField("doctorId", e.target.value)} style={{ width: "100%", padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}>
          <option value="">{loadingDoctors ? "Loading doctors..." : "Select doctor (optional)"}</option>
          {doctors.map((doc) => <option key={doc.id} value={doc.id}>Dr. {doc.name} - {doc.specialization || "General"}</option>)}
        </select>
        <textarea value={form.notes} onChange={(e) => onField("notes", e.target.value)} rows={3} placeholder="Notes" style={{ width: "100%", padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: "pointer" }}>Cancel</button>
          <button type="submit" style={{ flex: 1, padding: "10px 16px", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600 }}>Save Changes</button>
        </div>
      </form>
    </ModalShell>
  );
};

export function AppointmentsTab({ appointments, remindersByChannel }) {
  const [filter, setFilter] = useState("all");
  const [apptList, setApptList] = useState(appointments || []);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [editAppointment, setEditAppointment] = useState(null);
  const [patients, setPatients] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [quickBooking, setQuickBooking] = useState(false);
  const [quickForm, setQuickForm] = useState({
    patientId: "",
    departmentId: "",
    doctorId: "",
    appointmentType: "OPD",
    scheduledDate: new Date().toISOString().split("T")[0],
    scheduledTime: "10:00",
    duration: 30,
    notes: "",
  });

  useEffect(() => {
    setApptList(appointments || []);
  }, [appointments]);

  useEffect(() => {
    const loadSupportData = async () => {
      const [patientRes, deptRes] = await Promise.all([
        fetch('/api/patients?limit=50'),
        fetch('/api/departments'),
      ]);
      const patientJson = await patientRes.json();
      const deptJson = await deptRes.json();
      if (patientRes.ok) setPatients(patientJson.patients || []);
      if (deptRes.ok) setDepartments(deptJson.departments || []);
    };
    loadSupportData();
  }, []);

  useEffect(() => {
    const loadDoctors = async () => {
      if (!quickForm.scheduledDate) return;
      const departmentName = departments.find((d) => d.id === quickForm.departmentId)?.name;
      const qs = new URLSearchParams({ date: quickForm.scheduledDate });
      if (departmentName) qs.set("department", departmentName);
      const res = await fetch(`/api/doctors/available?${qs.toString()}`);
      const data = await res.json();
      if (res.ok) setDoctors(data.doctors || []);
    };
    loadDoctors();
  }, [quickForm.departmentId, quickForm.scheduledDate, departments]);

  const dateFiltered = useMemo(() => {
    const { from, to } = getDateRangeFromPreset(datePreset, customFrom, customTo);
    if (!from && !to) return apptList;
    return apptList.filter((a) => {
      const dt = new Date(a.scheduledAt).getTime();
      if (Number.isNaN(dt)) return false;
      if (from && dt < from.getTime()) return false;
      if (to && dt > to.getTime()) return false;
      return true;
    });
  }, [apptList, datePreset, customFrom, customTo]);

  const filtered = useMemo(
    () => (filter === "all" ? dateFiltered : dateFiltered.filter((a) => a.status === filter)),
    [dateFiltered, filter]
  );

  const statusIcon = (s) => ({
    confirmed: <CheckCircle size={14} color={C.green} />,
    reminder_sent: <Bell size={14} color={C.accent} />,
    no_show: <XCircle size={14} color={C.red} />,
    pending: <Clock size={14} color={C.amber} />,
    cancelled: <XCircle size={14} color={C.red} />,
  })[s] || <AlertCircle size={14} color={C.textMuted} />;

  const refreshAppointments = async () => {
    setRefreshing(true);
    try {
      localStorage.removeItem('hospital_dashboard_cache');
      localStorage.removeItem('hospital_dashboard_cache_appointments');
      localStorage.removeItem('hospital_dashboard_cache_overview');
      localStorage.removeItem('hospital_dashboard_cache_time');
      const res = await fetch('/api/hospital/dashboard?section=appointments&forceRefresh=true', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (data.appointments) setApptList(data.appointments);
    } finally {
      setRefreshing(false);
    }
  };

  const updateLocalAppointment = (id, patch) => {
    setApptList((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const performAction = async (id, fn) => {
    setBusyId(id);
    try {
      await fn();
      localStorage.removeItem('hospital_dashboard_cache');
      localStorage.removeItem('hospital_dashboard_cache_appointments');
      localStorage.removeItem('hospital_dashboard_cache_overview');
      localStorage.removeItem('hospital_dashboard_cache_time');
    } catch (error) {
      alert(`❌ ${error.message || 'Action failed'}`);
    } finally {
      setBusyId("");
    }
  };

  const handleConfirmAppointment = async (appt) => performAction(appt.id, async () => {
    const res = await fetch('/api/appointments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: appt.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to confirm appointment');
    updateLocalAppointment(appt.id, { status: 'confirmed' });
    alert(`✅ Appointment confirmed and notification sent for ${appt.patient?.fullName || 'patient'}`);
  });

  const handleCancelAppointment = async (appt) => performAction(appt.id, async () => {
    const res = await fetch('/api/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: appt.id, status: 'CANCELLED' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to cancel appointment');
    updateLocalAppointment(appt.id, { status: 'cancelled' });
    alert(`✅ Appointment cancelled`);
  });

  const handleReminder = async (appt) => performAction(appt.id, async () => {
    const res = await fetch('/api/appointments/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: appt.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      const whatsappStatus = data.whatsappError ? `WhatsApp failed: ${data.whatsappError}` : 'WhatsApp sent';
      const smsStatus = data.smsError ? (data.reminders?.sms?.isTrialAccountError ? 'SMS - Trial Account (phone needs verification)' : `SMS failed: ${data.smsError}`) : 'SMS sent';
      throw new Error(data.error || `Failed to send reminder - ${whatsappStatus}, ${smsStatus}`);
    }
    updateLocalAppointment(appt.id, { status: appt.status === 'pending' ? 'reminder_sent' : appt.status });
    const smsStatus = data.reminders.sms.success ? '✓ Sent' : (data.reminders.sms.isTrialAccountError ? '⚠ Trial Account' : '✗ Failed');
    alert(`${data.message}\n\n📱 WhatsApp: ${data.reminders.whatsapp.success ? '✓ Sent' : '✗ Failed'}\n💬 SMS: ${smsStatus}`);
  });

  const handleCall = async (appt) => performAction(appt.id, async () => {
    const res = await fetch('/api/patients/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: appt.patient?.id,
        action: 'call',
        purpose: 'appointment_reminder',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start call');
    alert(`✅ AI call started for ${appt.patient?.fullName || 'patient'}`);
  });

  const handleSaveEdit = async (payload, isReschedule = false) => {
    await performAction(payload.appointmentId, async () => {
      const res = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          ...(isReschedule ? { status: 'RESCHEDULED' } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update appointment');
      updateLocalAppointment(payload.appointmentId, {
        appointmentType: payload.appointmentType,
        department: payload.departmentId ? { ...departments.find((d) => d.id === payload.departmentId) } : null,
        doctor: payload.doctorId ? { ...doctors.find((d) => d.id === payload.doctorId) } : null,
        scheduledAt: payload.scheduledAt,
        notes: payload.notes,
        ...(isReschedule ? { status: 'pending' } : {}),
      });
      setEditAppointment(null);
      if (isReschedule) {
        await fetch('/api/appointments/reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: payload.appointmentId }),
        }).catch(() => null);
      }
      alert(`✅ Appointment ${isReschedule ? 'rescheduled' : 'updated'}`);
    });
  };

  const handleQuickBook = async () => {
    if (!quickForm.patientId || !quickForm.scheduledDate || !quickForm.scheduledTime) {
      alert("Please select patient, date and time");
      return;
    }
    setQuickBooking(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: quickForm.patientId,
          departmentId: quickForm.departmentId || null,
          doctorId: quickForm.doctorId || null,
          appointmentType: quickForm.appointmentType,
          scheduledAt: new Date(`${quickForm.scheduledDate}T${quickForm.scheduledTime}`).toISOString(),
          duration: Number(quickForm.duration || 30),
          notes: quickForm.notes || null,
          bookedVia: 'manual',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to book appointment');

      const created = {
        ...data.appointment,
        patient: {
          id: data.appointment.patient?.id,
          fullName: data.appointment.patient?.name || patients.find((p) => p.id === quickForm.patientId)?.name || 'Patient',
        },
        status: 'pending',
      };
      setApptList((prev) => [...prev, created].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));

      const confirmRes = await fetch('/api/appointments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: data.appointment.id }),
      });
      if (confirmRes.ok) {
        updateLocalAppointment(data.appointment.id, { status: 'confirmed' });
      }

      setQuickForm({
        patientId: "",
        departmentId: "",
        doctorId: "",
        appointmentType: "OPD",
        scheduledDate: new Date().toISOString().split("T")[0],
        scheduledTime: "10:00",
        duration: 30,
        notes: "",
      });
      localStorage.removeItem('hospital_dashboard_cache');
      localStorage.removeItem('hospital_dashboard_cache_appointments');
      localStorage.removeItem('hospital_dashboard_cache_overview');
      localStorage.removeItem('hospital_dashboard_cache_time');
      alert("✅ Appointment booked and confirmation sent");
    } catch (error) {
      alert(`❌ ${error.message || 'Quick book failed'}`);
    } finally {
      setQuickBooking(false);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  const formatTime = (date) => new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <StatCard icon={Calendar} label="Total Appointments" value={apptList.length} color={C.accent} sub="Past, present, future" />
        <StatCard icon={CheckCircle} label="Confirmed" value={apptList.filter(a => a.status === 'confirmed').length} color={C.green} sub="All periods" />
        <StatCard icon={Clock} label="Upcoming" value={apptList.filter(a => new Date(a.scheduledAt) >= new Date()).length} color={C.purple} sub="Today onward" />
        <StatCard icon={XCircle} label="No Shows" value={apptList.filter(a => a.status === 'no_show').length} color={C.red} sub="All periods" />
        <StatCard icon={RefreshCw} label="Pending / Rescheduled" value={apptList.filter(a => a.status === 'pending').length} color={C.amber} sub="Awaiting confirmation" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <SectionTitle icon={CalendarCheck} title="Appointments" subtitle="Past, present & future tracking" />
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={refreshAppointments}
                disabled={refreshing}
                style={{
                  background: C.accentGlow,
                  border: `1px solid ${C.accent}40`,
                  borderRadius: 8,
                  padding: "6px 10px",
                  cursor: refreshing ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: C.accent,
                  fontWeight: 600,
                  opacity: refreshing ? 0.6 : 1,
                }}
              >
                <RefreshCw size={12} style={{ transform: refreshing ? "rotate(180deg)" : "none", transition: "transform 0.3s" }} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              {["all", "confirmed", "pending", "no_show"].map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 10, cursor: "pointer",
                  background: filter === f ? C.accentGlow : "transparent",
                  border: filter === f ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                  color: filter === f ? C.accent : C.textMuted
                }}>{f === "all" ? "All" : f === "no_show" ? "No Show" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            {[
              { id: "all", label: "All" },
              { id: "yesterday", label: "Yesterday" },
              { id: "today", label: "Today" },
              { id: "tomorrow", label: "Tomorrow" },
              { id: "this_week", label: "This Week" },
              { id: "last_week", label: "Last Week" },
              { id: "this_month", label: "This Month" },
              { id: "custom", label: "Custom" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as DatePreset)}
                style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 10, cursor: "pointer",
                  background: datePreset === p.id ? C.greenGlow : "transparent",
                  border: datePreset === p.id ? `1px solid ${C.green}` : `1px solid ${C.border}`,
                  color: datePreset === p.id ? C.green : C.textMuted
                }}
              >
                {p.label}
              </button>
            ))}
            {datePreset === "custom" && (
              <>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", color: C.text, fontSize: 11 }} />
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", color: C.text, fontSize: 11 }} />
              </>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length > 0 ? filtered.map((appt) => (
              <div key={appt.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 14px", borderRadius: 12, background: C.surface,
                border: `1px solid ${appt.status === "confirmed" ? C.green + "30" : appt.status === "no_show" ? C.red + "30" : C.border}`,
              }}>
                <div style={{ textAlign: "center", minWidth: 60 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{formatTime(appt.scheduledAt)}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{formatDate(appt.scheduledAt)}</div>
                </div>
                <div style={{ width: 1, height: 36, background: C.border }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{appt.patient?.fullName || "Patient"}</span>
                    <Badge color="gray">{appt.appointmentType || appt.type || "Appointment"}</Badge>
                    {appt.status === "confirmed" && (
                      <Badge color="green">Ref: {appt.id.slice(-6).toUpperCase()}</Badge>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {appt.doctor?.name || "Dr. Unassigned"} · {appt.department?.name || "General"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {statusIcon(appt.status)}
                  <Badge color={statusConfig[appt.status]?.color || "gray"}>{statusConfig[appt.status]?.label || appt.status}</Badge>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {appt.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleConfirmAppointment(appt)}
                        disabled={busyId === appt.id}
                        style={{
                          background: C.green, border: "none", borderRadius: 6, padding: "6px 12px",
                          cursor: busyId === appt.id ? "wait" : "pointer", opacity: busyId === appt.id ? 0.6 : 1,
                          fontWeight: 700, fontSize: 11, color: "#fff", whiteSpace: "nowrap"
                        }}
                      >
                        {busyId === appt.id ? "⏳..." : "✓ Confirm"}
                      </button>
                      <button
                        onClick={() => handleCancelAppointment(appt)}
                        disabled={busyId === appt.id}
                        style={{
                          background: "transparent", border: `1px solid ${C.red}40`, borderRadius: 6, padding: "5px 10px",
                          cursor: "pointer", fontWeight: 600, fontSize: 10, color: C.red
                        }}
                      >
                        ✕ Cancel
                      </button>
                    </>
                  )}
                  {appt.status === 'confirmed' && (
                    <button
                      onClick={() => setEditAppointment({ ...appt, mode: 'reschedule' })}
                      style={{
                        background: "transparent", border: `1px solid ${C.accent}40`, borderRadius: 6, padding: "5px 10px",
                        cursor: "pointer", fontWeight: 600, fontSize: 10, color: C.accent
                      }}
                    >
                      📅 Reschedule
                    </button>
                  )}
                  <button onClick={() => handleReminder(appt)} disabled={busyId === appt.id} style={{ background: C.accentGlow, border: `1px solid ${C.accent}40`, borderRadius: 8, padding: 6, cursor: "pointer", flexShrink: 0 }} title="Send reminder"><Bell size={11} color={C.accent} /></button>
                  <button onClick={() => handleCall(appt)} disabled={busyId === appt.id} style={{ background: C.greenGlow, border: `1px solid ${C.green}40`, borderRadius: 8, padding: 6, cursor: "pointer", flexShrink: 0 }} title="Call patient"><Phone size={11} color={C.green} /></button>
                  <button onClick={() => setEditAppointment({ ...appt, mode: 'edit' })} style={{ background: C.border, border: `1px solid ${C.borderLight}`, borderRadius: 8, padding: 6, cursor: "pointer", flexShrink: 0 }} title="Edit appointment"><Edit size={11} color={C.textDim} /></button>
                </div>
              </div>
            )) : (
              <div style={{ padding: "30px 20px", textAlign: "center", color: C.textMuted, fontSize: 12 }}>
                No appointments yet. Start by booking an appointment!
              </div>
            )}
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <SectionTitle icon={Plus} title="Quick Book" subtitle="New appointment" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Patient Name</div>
                <select value={quickForm.patientId} onChange={(e) => setQuickForm((prev) => ({ ...prev, patientId: e.target.value }))} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12, outline: "none" }}>
                  <option value="">Search or select patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name} {p.phone ? `• ${p.phone}` : ''}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Department</div>
                <select value={quickForm.departmentId} onChange={(e) => setQuickForm((prev) => ({ ...prev, departmentId: e.target.value, doctorId: "" }))} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12, outline: "none" }}>
                  <option value="">Select department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Doctor</div>
                <select value={quickForm.doctorId} onChange={(e) => setQuickForm((prev) => ({ ...prev, doctorId: e.target.value }))} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12, outline: "none" }}>
                  <option value="">Select doctor</option>
                  {doctors.map((doc) => <option key={doc.id} value={doc.id}>Dr. {doc.name} - {doc.specialization || "General"}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Duration (minutes)</div>
                <input type="number" min={10} step={5} value={quickForm.duration} onChange={(e) => setQuickForm((prev) => ({ ...prev, duration: Number(e.target.value || 30) }))} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12, outline: "none" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Date</div>
                  <input type="date" value={quickForm.scheduledDate} onChange={(e) => setQuickForm((prev) => ({ ...prev, scheduledDate: e.target.value }))} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12, outline: "none" }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Time</div>
                  <input type="time" value={quickForm.scheduledTime} onChange={(e) => setQuickForm((prev) => ({ ...prev, scheduledTime: e.target.value }))} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12, outline: "none" }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Notes</div>
                <textarea value={quickForm.notes} onChange={(e) => setQuickForm((prev) => ({ ...prev, notes: e.target.value }))} rows={2} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12, outline: "none", resize: "vertical" }} />
              </div>
              <button onClick={handleQuickBook} disabled={quickBooking} style={{
                width: "100%", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                border: "none", borderRadius: 10, padding: "10px", color: "#fff", fontSize: 12,
                fontWeight: 600, cursor: "pointer", marginTop: 4, opacity: quickBooking ? 0.7 : 1
              }}>
                {quickBooking ? "Booking..." : "📅 Book Appointment"}
              </button>
            </div>
          </Card>
        </div>
      </div>

      {editAppointment && (
        <AppointmentEditModal
          appointment={editAppointment}
          departments={departments}
          onClose={() => setEditAppointment(null)}
          onSave={(payload) => handleSaveEdit(payload, editAppointment.mode === 'reschedule')}
        />
      )}
    </div>
  );
}
