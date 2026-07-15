//@ts-nocheck
'use client';
import { useState } from "react";
import {
  Users, UserPlus, UserCheck, Database, Search, Plus, X,
  Phone, MessageSquare, Eye, Target, Activity, ArrowUpRight, Upload
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

const Card = ({ children, style }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: 20, ...style,
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

const Badge = ({ children, color }) => {
  const colors = { green: [C.green, C.greenGlow], accent: [C.accent, C.accentGlow], amber: [C.amber, `${C.amber}20`], red: [C.red, `${C.red}20`], purple: [C.purple, `${C.purple}20`], gray: [C.textMuted, `${C.textMuted}10`] };
  const [textColor, bgColor] = colors[color] || colors.gray;
  return <span style={{ display: "inline-block", fontSize: 10, padding: "3px 8px", borderRadius: 6, background: bgColor, color: textColor, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
};

// Add Patient Modal Component
const AddPatientModal = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    age: "",
    gender: "",
    source: "manual",
    intent: "enquiry",
    preferredLanguage: "EN",
    tags: [],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tag) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.phone && !form.email) {
      setError("Phone or email is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/patients/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          age: form.age ? parseInt(form.age) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create patient');
      }

      setForm({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        age: "",
        gender: "",
        source: "manual",
        intent: "enquiry",
        preferredLanguage: "EN",
        tags: [],
      });

      onSuccess?.(data.patient);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const commonTags = ["VIP", "High Risk", "Booking", "Follow-up", "Blocked"];

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: C.surface, borderRadius: 16, padding: 24,
        maxWidth: 600, width: "90%", maxHeight: "90vh", overflowY: "auto",
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>Add New Patient</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            background: `${C.red}20`, border: `1px solid ${C.red}40`,
            borderRadius: 8, padding: 12, marginBottom: 16, color: C.red, fontSize: 12,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                placeholder="John"
                style={{
                  width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Doe"
                style={{
                  width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                }}
              />
            </div>
          </div>

          {/* Contact Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                Phone *
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                style={{
                  width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="john@example.com"
                style={{
                  width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                }}
              />
            </div>
          </div>

          {/* Demographics Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                Age
              </label>
              <input
                type="number"
                name="age"
                value={form.age}
                onChange={handleChange}
                placeholder="30"
                min="1"
                max="150"
                style={{
                  width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                Gender
              </label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                style={{
                  width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                }}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* CRM Data Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                Source
              </label>
              <select
                name="source"
                value={form.source}
                onChange={handleChange}
                style={{
                  width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                }}
              >
                <option value="manual">Manual Entry</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="call">Voice Call</option>
                <option value="chat">Chat</option>
                <option value="direct">Direct</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                Intent
              </label>
              <select
                name="intent"
                value={form.intent}
                onChange={handleChange}
                style={{
                  width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                }}
              >
                <option value="enquiry">Enquiry</option>
                <option value="booking">Booking</option>
                <option value="pricing">Pricing</option>
                <option value="support">Support</option>
              </select>
            </div>
          </div>

          {/* Language */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Preferred Language
            </label>
            <select
              name="preferredLanguage"
              value={form.preferredLanguage}
              onChange={handleChange}
              style={{
                width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
              }}
            >
              <option value="EN">English</option>
              <option value="HI">Hindi</option>
              <option value="ES">Spanish</option>
              <option value="FR">French</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>
              Tags
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {commonTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  style={{
                    padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: form.tags.includes(tag) ? C.accentGlow : C.card,
                    border: `1px solid ${form.tags.includes(tag) ? C.accent + "50" : C.border}`,
                    color: form.tags.includes(tag) ? C.accent : C.textMuted,
                    cursor: "pointer",
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "10px 16px", background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.text, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 1, padding: "10px 16px", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600,
                cursor: "pointer", opacity: loading ? 0.7 : 1,
              }}
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Book Appointment Modal Component
const BookAppointmentModal = ({ patient, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [error, setError] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({
    appointmentType: "OPD",
    scheduledDate: "",
    scheduledTime: "10:00",
    doctorId: "",
    notes: "",
  });

  // Fetch available doctors when date changes
  const handleDateChange = async (date) => {
    console.log('[BookAppointment] Date changed to:', date);
    setForm(prev => ({ ...prev, scheduledDate: date, doctorId: "" }));
    setDoctors([]); // Clear previous doctors
    
    if (date) {
      setLoadingDoctors(true);
      try {
        const url = `/api/doctors/available?date=${date}`;
        console.log('[BookAppointment] Fetching doctors from:', url);
        const res = await fetch(url);
        const data = await res.json();
        console.log('[BookAppointment] Doctors API Response:', { success: data.success, count: data.doctors?.length, doctors: data.doctors });
        
        if (data.success && data.doctors && data.doctors.length > 0) {
          setDoctors(data.doctors);
          console.log('[BookAppointment] ✅ Loaded', data.doctors.length, 'doctors');
        } else if (data.success && (!data.doctors || data.doctors.length === 0)) {
          console.log('[BookAppointment] ⚠️  No doctors found for this date');
          setDoctors([]);
        } else {
          console.error('[BookAppointment] ❌ API error:', data.error);
          setDoctors([]);
        }
      } catch (err) {
        console.error('[BookAppointment] ❌ Fetch error:', err);
        setDoctors([]);
      } finally {
        setLoadingDoctors(false);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "scheduledDate") {
      handleDateChange(value);
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.scheduledDate || !form.scheduledTime) {
      setError("Date and time are required");
      return;
    }

    setLoading(true);
    try {
      const dateTime = new Date(`${form.scheduledDate}T${form.scheduledTime}`);
      
      const res = await fetch('/api/appointments/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          appointmentType: form.appointmentType,
          doctorId: form.doctorId || undefined,
          scheduledAt: dateTime.toISOString(),
          notes: form.notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to book appointment');
      }

      // Clear cache immediately
      localStorage.removeItem('hospital_dashboard_cache');
      localStorage.removeItem('hospital_dashboard_cache_crm');
      localStorage.removeItem('hospital_dashboard_cache_overview');
      localStorage.removeItem('hospital_dashboard_cache_time');
      
      onSuccess?.(data.appointment);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Set minimum date to today
  const today = new Date().toISOString().split('T')[0];
  const selectedDoctor = doctors.find(d => d.id === form.doctorId);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1001,
    }}>
      <div style={{
        background: C.surface, borderRadius: 16, padding: 24,
        maxWidth: 500, width: "90%", maxHeight: "90vh", overflowY: "auto",
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
            Book Appointment for {patient.name}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            background: `${C.red}20`, border: `1px solid ${C.red}40`,
            borderRadius: 8, padding: 12, marginBottom: 16, color: C.red, fontSize: 12,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Patient Info */}
          <div style={{ background: C.card, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Patient</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{patient.name}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{patient.phone}</div>
          </div>

          {/* Appointment Type */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Appointment Type
            </label>
            <select
              name="appointmentType"
              value={form.appointmentType}
              onChange={handleChange}
              style={{
                width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
              }}
            >
              <option value="OPD">OPD (Out-Patient Dept)</option>
              <option value="CONSULTATION">Consultation</option>
              <option value="FOLLOW_UP">Follow-up</option>
              <option value="PROCEDURE">Procedure</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Date & Time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                Date *
              </label>
              <input
                type="date"
                name="scheduledDate"
                value={form.scheduledDate}
                onChange={handleChange}
                min={today}
                style={{
                  width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                Time *
              </label>
              <input
                type="time"
                name="scheduledTime"
                value={form.scheduledTime}
                onChange={handleChange}
                style={{
                  width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                }}
              />
            </div>
          </div>

          {/* Doctor Selection */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Select Doctor {loadingDoctors && "(Loading...)"}
            </label>
            <select
              name="doctorId"
              value={form.doctorId}
              onChange={handleChange}
              disabled={!form.scheduledDate || loadingDoctors}
              style={{
                width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 8, color: form.doctorId ? C.text : C.textMuted, fontSize: 12, outline: "none",
                opacity: !form.scheduledDate ? 0.6 : 1,
              }}
            >
              <option value="">
                {loadingDoctors ? "Loading doctors..." : form.scheduledDate ? (doctors.length > 0 ? "Select a doctor" : "No doctors available") : "Select date first"}
              </option>
              {doctors.map(doc => (
                <option key={doc.id} value={doc.id}>
                  Dr. {doc.name} - {doc.specialization}
                </option>
              ))}
            </select>
            {form.scheduledDate && !loadingDoctors && doctors.length === 0 && (
              <div style={{ fontSize: 11, color: C.amber, marginTop: 6, fontWeight: 500 }}>
                ⚠️ No doctors available on this date. Try another date or proceed without doctor.
              </div>
            )}
            {selectedDoctor && (
              <div style={{ fontSize: 11, color: C.green, marginTop: 6, fontWeight: 500 }}>
                ✓ {selectedDoctor.name} is available on {form.scheduledDate}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Add any notes about this appointment..."
              rows={3}
              style={{
                width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.text, fontSize: 12, outline: "none",
                fontFamily: "inherit", resize: "vertical",
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "10px 16px", background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.text, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 1, padding: "10px 16px", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600,
                cursor: "pointer", opacity: loading ? 0.7 : 1,
              }}
              disabled={loading}
            >
              {loading ? "Booking..." : "Book Appointment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ModalShell = ({ title, children, onClose, maxWidth = 520 }) => (
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

const PatientDetailsModal = ({ patient, onClose, onBook }) => (
  <ModalShell title="Patient Details" onClose={onClose}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div style={{ background: C.card, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Name</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{patient.name}</div>
      </div>
      <div style={{ background: C.card, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Department</div>
        <div style={{ fontSize: 13, color: C.text }}>{patient.dept || 'General'}</div>
      </div>
      <div style={{ background: C.card, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Phone</div>
        <div style={{ fontSize: 13, color: C.text }}>{patient.phone || '—'}</div>
      </div>
      <div style={{ background: C.card, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Email</div>
        <div style={{ fontSize: 13, color: C.text }}>{patient.email || '—'}</div>
      </div>
      <div style={{ background: C.card, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Age</div>
        <div style={{ fontSize: 13, color: C.text }}>{patient.age ?? '—'}</div>
      </div>
      <div style={{ background: C.card, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Visits</div>
        <div style={{ fontSize: 13, color: C.text }}>{patient.visits ?? 0}</div>
      </div>
    </div>
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Tags</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(patient.tags?.length ? patient.tags : ['No tags']).map((tag) => (
          <Badge key={tag} color="accent">{tag}</Badge>
        ))}
      </div>
    </div>
    <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
      <button
        onClick={onClose}
        style={{ flex: 1, padding: "10px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: "pointer" }}
      >
        Close
      </button>
      <button
        onClick={() => onBook(patient)}
        style={{ flex: 1, padding: "10px 16px", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600 }}
      >
        Book Appointment
      </button>
    </div>
  </ModalShell>
);

const SendMessageModal = ({ patient, onClose, onSend }) => {
  const [channel, setChannel] = useState("WHATSAPP");
  const [message, setMessage] = useState(`Hello ${patient.name}, this is a follow-up from our hospital team. How may we help you today?`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSend({ channel, message, setError });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title={`Message ${patient.name}`} onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: C.red, fontSize: 12 }}>{error}</div>}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Channel</div>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="SMS">SMS</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Message</div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} style={{ width: "100%", padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: "pointer" }}>Cancel</button>
          <button type="submit" disabled={loading} style={{ flex: 1, padding: "10px 16px", background: `linear-gradient(135deg, ${C.green}, ${C.accent})`, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", opacity: loading ? 0.7 : 1, fontWeight: 600 }}>
            {loading ? "Sending..." : "Send Message"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const ImportPatientsModal = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose an Excel file");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/patients/import-excel", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Import Patients from Excel" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: C.red, fontSize: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12, color: C.textMuted }}>
          Upload `.xlsx`, `.xls`, or `.csv` with columns like `firstName`, `lastName`, `phone`, `email`, `age`, `gender`, `language`.
        </div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ width: "100%", padding: "12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: "pointer" }}>Cancel</button>
          <button type="submit" disabled={loading} style={{ flex: 1, padding: "10px 16px", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", opacity: loading ? 0.7 : 1, fontWeight: 600 }}>
            {loading ? "Importing..." : "Import Patients"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

export function CRMTab({ patients, stats }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [patientList, setPatientList] = useState(patients);
  const [bookingPatient, setBookingPatient] = useState(null);
  const [detailsPatient, setDetailsPatient] = useState(null);
  const [messagePatient, setMessagePatient] = useState(null);
  const [busyPatientId, setBusyPatientId] = useState("");

  const filtered = patientList.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search) ||
    p.dept.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddPatientSuccess = (newPatient) => {
    const mappedPatient = {
      id: newPatient.id,
      name: newPatient.fullName || `${newPatient.firstName || ''} ${newPatient.lastName || ''}`.trim() || 'Unknown',
      phone: newPatient.phone ?? '—',
      email: newPatient.email ?? '—',
      age: newPatient.age ?? null,
      dept: 'General',
      tags: newPatient.tags ?? [],
      visits: 0,
      lastVisit: 'just now',
      status: 'new',
    };
    setPatientList([mappedPatient, ...patientList]);
  };

  const handleBookingSuccess = (appointment) => {
    // Clear localStorage cache so dashboard refreshes with new appointment
    localStorage.removeItem('hospital_dashboard_cache');
    localStorage.removeItem('hospital_dashboard_cache_crm');
    localStorage.removeItem('hospital_dashboard_cache_overview');
    localStorage.removeItem('hospital_dashboard_cache_time');
    setBookingPatient(null);
    // Show success message
    alert(`✅ Appointment booked for ${new Date(appointment.scheduledAt).toLocaleDateString()} at ${new Date(appointment.scheduledAt).toLocaleTimeString()}`);
  };

  const reloadPatients = async () => {
    const res = await fetch('/api/patients?limit=200');
    const data = await res.json();
    if (res.ok) {
      setPatientList((data.patients || []).map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone ?? '—',
        email: p.email ?? '—',
        age: p.age ?? null,
        dept: p.department?.name ?? 'General',
        tags: p.tags ?? [],
        visits: p.totalVisits ?? 0,
        lastVisit: p.lastVisitAt ? new Date(p.lastVisitAt).toLocaleDateString() : '—',
        status: String(p.patientStatus || 'new').toLowerCase() === 'new' ? 'new' : 'active',
      })));
    }
  };

  const handleSendMessage = async (patient, payload) => {
    const res = await fetch('/api/patients/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: patient.id,
        action: 'message',
        channel: payload.channel,
        message: payload.message,
        sendSmsBackup: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send message');
    if (payload.channel === 'WHATSAPP') {
      alert(`✅ WhatsApp accepted by provider and SMS backup sent to ${patient.name}`);
    } else {
      alert(`✅ SMS sent to ${patient.name}`);
    }
  };

  const handleCallPatient = async (patient) => {
    setBusyPatientId(patient.id);
    try {
      const res = await fetch('/api/patients/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          action: 'call',
          purpose: 'missed_call_followup',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start call');
      alert(`✅ AI call started for ${patient.name}`);
    } catch (err) {
      alert(`❌ ${err.message || 'Failed to start call'}`);
    } finally {
      setBusyPatientId("");
    }
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <StatCard icon={Users} label="Total Patients" value={stats?.totalPatients ?? patientList.length} color={C.accent} sub="All time records" />
          <StatCard icon={UserPlus} label="New This Month" value={stats?.newPatientsThisMonth ?? 0} color={C.green} sub="Recent additions" />
          <StatCard icon={UserCheck} label="Returning" value={patientList.filter(p => (p.visits ?? 0) > 1).length} color={C.purple} sub="Repeat visits" />
          <StatCard icon={Database} label="AI Enriched" value={`${Math.min(100, Math.round((patientList.filter(p => (p.tags?.length ?? 0) > 0).length / Math.max(1, patientList.length)) * 100))}%`} color={C.amber} sub="Auto-tagged records" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <SectionTitle icon={Users} title="Patient Database" subtitle={`${patientList.length} shown`} />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted }} />
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search patients..."
                    style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, outline: "none" }}
                  />
                </div>
                <button onClick={() => setShowImportModal(true)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Upload size={13} /> Import Excel
                </button>
                <button onClick={() => setShowAddModal(true)} style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: "none", borderRadius: 8, padding: "7px 12px", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Plus size={13} /> Add Patient
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(patient => (
                <div key={patient.id} onClick={() => setSelected(patient === selected ? null : patient)}
                  style={{
                    padding: "12px 14px", borderRadius: 12, background: selected?.id === patient.id ? `${C.accent}08` : C.surface,
                    border: `1px solid ${selected?.id === patient.id ? C.accent + "50" : C.border}`,
                    cursor: "pointer", transition: "all 0.2s"
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                      background: `linear-gradient(135deg, ${C.accent}40, ${C.purple}40)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 700, color: C.accent
                    }}>{patient.name[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{patient.name}</span>
                        {patient.tags.map(tag => (
                          <Badge key={tag} color={tag === "VIP" ? "amber" : tag === "High Risk" ? "red" : "accent"}>{tag}</Badge>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{patient.dept} · Age {patient.age} · {patient.phone}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: C.textDim }}>{patient.visits} visits</div>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{patient.lastVisit}</div>
                    </div>
                    <Badge color={patient.status === "active" ? "green" : patient.status === "new" ? "accent" : "gray"}>{patient.status}</Badge>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCallPatient(patient); }}
                        disabled={busyPatientId === patient.id}
                        style={{ background: C.accentGlow, border: `1px solid ${C.accent}40`, borderRadius: 6, padding: 5, cursor: "pointer", opacity: busyPatientId === patient.id ? 0.6 : 1 }}
                        title="Call patient"
                      ><Phone size={11} color={C.accent} /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMessagePatient(patient); }}
                        style={{ background: C.greenGlow, border: `1px solid ${C.green}40`, borderRadius: 6, padding: 5, cursor: "pointer" }}
                        title="Send message"
                      ><MessageSquare size={11} color={C.green} /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailsPatient(patient); }}
                        style={{ background: C.border, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: 5, cursor: "pointer" }}
                        title="View details"
                      ><Eye size={11} color={C.textDim} /></button>
                    </div>
                  </div>

                  {selected?.id === patient.id && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div style={{ background: C.card, borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>Contact Info</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>{patient.phone}</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>{patient.email}</div>
                      </div>
                      <div style={{ background: C.card, borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>Visit History</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>{patient.visits} total visits</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>Last: {patient.lastVisit}</div>
                      </div>
                      <div style={{ background: C.card, borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>Quick Actions</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setBookingPatient(patient);
                            }}
                            style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: "none", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 10, cursor: "pointer" }}
                          >
                            Book Appt
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMessagePatient(patient);
                            }}
                            style={{ background: C.greenGlow, border: `1px solid ${C.green}40`, borderRadius: 6, padding: "4px 8px", color: C.green, fontSize: 10, cursor: "pointer" }}
                          >
                            Send Msg
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <SectionTitle icon={Target} title="Lead Scoring" subtitle="AI-powered patient prioritization" />
              {[
                { label: "Hot Leads", count: 156, color: C.red, icon: "🔥", desc: "Need immediate follow-up" },
                { label: "Warm Leads", count: 423, color: C.amber, icon: "⚡", desc: "Engaged, nurture now" },
                { label: "Cold Leads", count: 891, color: C.textMuted, icon: "❄️", desc: "Long-term pipeline" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{l.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{l.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: l.color }}>{l.count}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{l.desc}</div>
                  </div>
                </div>
              ))}
            </Card>

            <Card style={{ flex: 1 }}>
              <SectionTitle icon={Activity} title="Activity" subtitle="Recent actions" />
              {[
                { action: "Patient added", time: "2 min ago", color: C.green },
                { action: "Call scheduled", time: "15 min ago", color: C.accent },
                { action: "Email opened", time: "1 hr ago", color: C.amber },
              ].map((a, i) => (
                <div key={i} style={{ fontSize: 11, color: C.textDim, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: a.color }}>• {a.action}</span>
                  <span style={{ color: C.textMuted }}>{a.time}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddPatientModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddPatientSuccess}
        />
      )}

      {showImportModal && (
        <ImportPatientsModal
          onClose={() => setShowImportModal(false)}
          onSuccess={async (result) => {
            await reloadPatients();
            localStorage.removeItem('hospital_dashboard_cache');
            localStorage.removeItem('hospital_dashboard_cache_crm');
            localStorage.removeItem('hospital_dashboard_cache_overview');
            localStorage.removeItem('hospital_dashboard_cache_time');
            alert(`✅ Imported patients\nCreated: ${result.created}\nUpdated: ${result.updated}\nSkipped: ${result.skipped}`);
          }}
        />
      )}

      {bookingPatient && (
        <BookAppointmentModal
          patient={bookingPatient}
          onClose={() => setBookingPatient(null)}
          onSuccess={handleBookingSuccess}
        />
      )}

      {detailsPatient && (
        <PatientDetailsModal
          patient={detailsPatient}
          onClose={() => setDetailsPatient(null)}
          onBook={(patient) => {
            setDetailsPatient(null);
            setBookingPatient(patient);
          }}
        />
      )}

      {messagePatient && (
        <SendMessageModal
          patient={messagePatient}
          onClose={() => setMessagePatient(null)}
          onSend={(payload) => handleSendMessage(messagePatient, payload)}
        />
      )}
    </>
  );
}
