"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Loader2,
  X,
  Users,
  Phone,
  Mail,
  Upload,
} from "lucide-react";
import { QuickActionsPanel } from "../../../components/dashboard/QuickActionsPanel";
import {
  type DatePreset,
  getDateRangeFromPreset,
} from "@/lib/dashboard-date-filters";

interface Lead {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phone?: string | null;
  score?: number | null;
  tier?: string | null;
  status: string;
  createdAt: string;
}

const TIER_COLOR: Record<string, string> = {
  HOT: "#ef4444",
  WARM: "#f59e0b",
  COLD: "#6b7280",
};
const STATUS_COLOR: Record<string, string> = {
  NEW: "#6366f1",
  CONTACTED: "#06b6d4",
  ENGAGED: "#8b5cf6",
  QUALIFIED: "#10b981",
  MEETING_SET: "#a855f7",
  WON: "#10b981",
  LOST: "#6b7280",
};

function leadDisplayFirstName(lead: Lead): string {
  const fn = lead.firstName?.trim();
  if (fn) return fn;
  const local = lead.email?.split("@")[0]?.trim();
  if (local) return local;
  const phone = lead.phone?.trim();
  if (phone) return phone;
  return "Contact";
}

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "custom", label: "Custom" },
];

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "HI", label: "Hindi" },
  { code: "TA", label: "Tamil" },
  { code: "TE", label: "Telugu" },
  { code: "KN", label: "Kannada" },
  { code: "ML", label: "Malayalam" },
  { code: "MR", label: "Marathi" },
  { code: "BN", label: "Bengali" },
  { code: "GU", label: "Gujarati" },
  { code: "PA", label: "Punjabi" },
];

const inp: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: "10px",
  fontSize: "13px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

// ── Add Lead Modal ──────────────────────────────────────────────────────────────
function AddLeadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    company: "",
    jobTitle: "",
    source: "manual",
    preferredLanguage: "EN",
    notes: "",
  });

  function set(key: string, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
    setError("");
  }

  async function handleSubmit() {
    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }
    if (!form.firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (!form.lastName.trim()) {
      setError("Last name is required");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required");
      return;
    }
    if (!form.company.trim()) {
      setError("Company is required");
      return;
    }
    if (!form.jobTitle.trim()) {
      setError("Job title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/leads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        onCreated();
        onClose();
      } else setError(data.error ?? "Failed to create lead");
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          overflowY: "auto",
          margin: "0 16px",
          background: "#111118",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          padding: "28px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#fff",
                margin: 0,
              }}
            >
              Add New Lead
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.35)",
                marginTop: "3px",
              }}
            >
              Fill in the lead details below
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "none",
              borderRadius: "8px",
              padding: "7px",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Email — required */}
          <div>
            <label
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.5)",
                display: "block",
                marginBottom: "5px",
              }}
            >
              Email <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="lead@company.com"
              type="email"
              style={inp}
            />
          </div>

          {/* First + Last name */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                First Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                placeholder="Rajesh"
                style={inp}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Last Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                placeholder="Kumar"
                style={inp}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.5)",
                display: "block",
                marginBottom: "5px",
              }}
            >
              Phone Number <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+91 98765 43210"
              type="tel"
              style={inp}
            />
            <p
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.2)",
                marginTop: "3px",
              }}
            >
              Required for voice calls and WhatsApp
            </p>
          </div>

          {/* Company + Job Title */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Company <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Acme Corp"
                style={inp}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Job Title <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                value={form.jobTitle}
                onChange={(e) => set("jobTitle", e.target.value)}
                placeholder="CEO"
                style={inp}
              />
            </div>
          </div>

          {/* Source + Language */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Source <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 13px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  outline: "none",
                  cursor: "pointer",
                  boxSizing: "border-box" as const,
                }}
              >
                <option
                  value="manual"
                  style={{ background: "#111118", color: "#fff" }}
                >
                  Manual Entry
                </option>
                <option
                  value="website"
                  style={{ background: "#111118", color: "#fff" }}
                >
                  Website
                </option>
                <option
                  value="referral"
                  style={{ background: "#111118", color: "#fff" }}
                >
                  Referral
                </option>
                <option
                  value="linkedin"
                  style={{ background: "#111118", color: "#fff" }}
                >
                  LinkedIn
                </option>
                <option
                  value="cold_outreach"
                  style={{ background: "#111118", color: "#fff" }}
                >
                  Cold Outreach
                </option>
                <option
                  value="event"
                  style={{ background: "#111118", color: "#fff" }}
                >
                  Event
                </option>
                <option
                  value="other"
                  style={{ background: "#111118", color: "#fff" }}
                >
                  Other
                </option>
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Preferred Language <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={form.preferredLanguage}
                onChange={(e) => set("preferredLanguage", e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 13px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  outline: "none",
                  cursor: "pointer",
                  boxSizing: "border-box" as const,
                }}
              >
                {LANGUAGES.map((l) => (
                  <option
                    key={l.code}
                    value={l.code}
                    style={{ background: "#111118", color: "#fff" }}
                  >
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes — optional */}
          <div>
            <label
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.5)",
                display: "block",
                marginBottom: "5px",
              }}
            >
              Notes{" "}
              <span
                style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}
              >
                (optional)
              </span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any additional context about this lead..."
              rows={3}
              style={{ ...inp, resize: "none" as const, lineHeight: "1.5" }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#fca5a5",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                padding: "11px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 600,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "#fff",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <>
                  <Loader2
                    size={15}
                    style={{ animation: "spin 1s linear infinite" }}
                  />{" "}
                  Saving...
                </>
              ) : (
                <>
                  <Plus size={15} /> Add Lead
                </>
              )}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "11px 20px",
                borderRadius: "12px",
                fontSize: "14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Leads Page ────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatus] = useState("");
  const [agentId, setAgentId] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string>("");
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const { from, to } = getDateRangeFromPreset(
      datePreset,
      customFrom,
      customTo,
    );
    if (from) params.set("from", from.toISOString());
    if (to) params.set("to", to.toISOString());
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setLoading(false);
  }, [search, statusFilter, datePreset, customFrom, customTo]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  async function handleDeleteLead(leadId: string) {
    const confirmed = window.confirm(
      "Delete this lead? This action cannot be undone.",
    );
    if (!confirmed) return;

    setDeletingLeadId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      const data = await res.json();
      if (data?.success) {
        if (selected?.id === leadId) {
          setSelected(null);
        }
        setSelectedLeadIds((prev) => prev.filter((id) => id !== leadId));
        await fetchLeads();
      } else {
        window.alert(data?.error ?? "Failed to delete lead");
      }
    } catch (error) {
      window.alert("Unable to delete lead. Please try again.");
    } finally {
      setDeletingLeadId(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedLeadIds.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedLeadIds.length} selected lead${selectedLeadIds.length > 1 ? "s" : ""}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedLeadIds }),
      });
      const data = await res.json();
      if (data?.success) {
        setSelected(null);
        setSelectedLeadIds([]);
        await fetchLeads();
      } else {
        window.alert(data?.error ?? "Failed to delete selected leads");
      }
    } catch (error) {
      window.alert("Unable to delete selected leads. Please try again.");
    } finally {
      setBulkDeleting(false);
    }
  }

  const allSelected =
    leads.length > 0 && selectedLeadIds.length === leads.length;

  function toggleLeadSelected(leadId: string, checked: boolean) {
    setSelectedLeadIds((prev) => {
      if (checked) {
        return prev.includes(leadId) ? prev : [...prev, leadId];
      }
      return prev.filter((id) => id !== leadId);
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedLeadIds(checked ? leads.map((l) => l.id) : []);
  }

  useEffect(() => {
    fetch("/api/agent/default")
      .then((r) => r.json())
      .then((d) => setAgentId(d.agentId ?? ""))
      .catch(() => {});
  }, []);

  const statuses = [
    "",
    "NEW",
    "CONTACTED",
    "ENGAGED",
    "QUALIFIED",
    "MEETING_SET",
    "WON",
    "LOST",
  ];

  async function handleExcelPick(file: File) {
    setImportMsg("");
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/leads/import-excel", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setImportMsg(data?.error ?? "Excel import failed");
      } else {
        setImportMsg(
          `Imported: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped`,
        );
        await fetchLeads();
      }
    } catch {
      setImportMsg("Excel import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      style={{ padding: "28px 32px", background: "#0a0a0f", minHeight: "100%" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#fff",
              margin: 0,
            }}
          >
            Leads
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.35)",
              marginTop: "4px",
            }}
          >
            {leads.length} total leads
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {selectedLeadIds.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  padding: "9px 12px",
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#e0e7ff",
                  background: "rgba(99,102,241,0.16)",
                  border: "1px solid rgba(99,102,241,0.28)",
                }}
              >
                {selectedLeadIds.length} selected
              </span>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "9px 14px",
                  borderRadius: "12px",
                  fontSize: "13px",
                  fontWeight: 500,
                  background: bulkDeleting
                    ? "rgba(149,76,233,0.2)"
                    : "linear-gradient(135deg,#7c3aed,#4f46e5)",
                  color: bulkDeleting ? "#facc15" : "#fff",
                  border: "none",
                  cursor: bulkDeleting ? "not-allowed" : "pointer",
                }}
              >
                {bulkDeleting
                  ? `Deleting ${selectedLeadIds.length}`
                  : `Delete ${selectedLeadIds.length}`}
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.currentTarget.value = "";
              if (f) void handleExcelPick(f);
            }}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 14px",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: 500,
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: importing ? "not-allowed" : "pointer",
              opacity: importing ? 0.7 : 1,
            }}
            title="Import leads from Excel (.xlsx)"
          >
            {importing ? (
              <>
                <Loader2
                  size={15}
                  style={{ animation: "spin 1s linear infinite" }}
                />{" "}
                Importing
              </>
            ) : (
              <>
                <Upload size={15} /> Import Excel
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 18px",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: 500,
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </div>

      {importMsg && (
        <div
          style={{
            marginBottom: "14px",
            padding: "10px 14px",
            borderRadius: "12px",
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.22)",
            color: "rgba(255,255,255,0.8)",
            fontSize: "13px",
          }}
        >
          {importMsg}
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: "11px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(255,255,255,0.3)",
              }}
            />
            <input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...inp,
                paddingLeft: "32px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  padding: "7px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  border: "1px solid",
                  background:
                    statusFilter === s
                      ? "rgba(99,102,241,0.2)"
                      : "rgba(255,255,255,0.03)",
                  borderColor:
                    statusFilter === s
                      ? "rgba(99,102,241,0.4)"
                      : "rgba(255,255,255,0.07)",
                  color:
                    statusFilter === s ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                }}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
              marginRight: "4px",
            }}
          >
            Created
          </span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setDatePreset(p.id)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
                border: "1px solid",
                background:
                  datePreset === p.id
                    ? "rgba(16,185,129,0.15)"
                    : "rgba(255,255,255,0.03)",
                borderColor:
                  datePreset === p.id
                    ? "rgba(16,185,129,0.35)"
                    : "rgba(255,255,255,0.07)",
                color:
                  datePreset === p.id ? "#6ee7b7" : "rgba(255,255,255,0.4)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label
              style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}
            >
              From{" "}
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  ...inp,
                  marginLeft: "6px",
                  width: "auto",
                  minWidth: "140px",
                }}
              />
            </label>
            <label
              style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}
            >
              To{" "}
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  ...inp,
                  marginLeft: "6px",
                  width: "auto",
                  minWidth: "140px",
                }}
              />
            </label>
          </div>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "20px",
          overflow: "hidden",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "38px 2fr 1.5fr 1fr 1fr 1fr 110px",
            padding: "11px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => toggleSelectAll(e.target.checked)}
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
                background: allSelected
                  ? "rgba(99,102,241,0.18)"
                  : "rgba(255,255,255,0.03)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {allSelected && (
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
          {["Lead", "Company", "Tier", "Status", "Score", "Actions"].map(
            (h) => (
              <span
                key={h}
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.25)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {h}
              </span>
            ),
          )}
        </div>

        {loading ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "rgba(255,255,255,0.2)",
              fontSize: "13px",
            }}
          >
            Loading...
          </div>
        ) : leads.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <Users
              size={32}
              style={{
                color: "rgba(255,255,255,0.1)",
                margin: "0 auto 12px",
                display: "block",
              }}
            />
            <p
              style={{
                color: "rgba(255,255,255,0.25)",
                fontSize: "14px",
                margin: "0 0 8px",
              }}
            >
              No leads found
            </p>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                fontSize: "13px",
                color: "#818cf8",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Add your first lead →
            </button>
          </div>
        ) : (
          leads.map((lead, i) => {
            const displayFirst = leadDisplayFirstName(lead);
            const initials = (
              displayFirst[0] ??
              lead.email[0] ??
              "?"
            ).toUpperCase();
            const isRowSelected = selectedLeadIds.includes(lead.id);
            return (
              <div
                key={lead.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "38px 2fr 1.5fr 1fr 1fr 1fr 110px",
                  alignItems: "center",
                  padding: "11px 20px",
                  borderBottom:
                    i < leads.length - 1
                      ? "1px solid rgba(255,255,255,0.04)"
                      : "none",
                  background: isRowSelected
                    ? "rgba(99,102,241,0.08)"
                    : "transparent",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isRowSelected}
                    onChange={(e) =>
                      toggleLeadSelected(lead.id, e.target.checked)
                    }
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
                      background: isRowSelected
                        ? "rgba(99,102,241,0.18)"
                        : "rgba(255,255,255,0.03)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isRowSelected && (
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
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: "rgba(99,102,241,0.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#818cf8",
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#e2e8f0",
                      }}
                    >
                      {displayFirst}
                      {lead.lastName?.trim() ? ` ${lead.lastName.trim()}` : ""}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.28)",
                      }}
                    >
                      {lead.email}
                    </div>
                  </div>
                </div>
                <div
                  style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}
                >
                  {lead.company ?? "—"}
                </div>
                <div>
                  {lead.tier && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        padding: "3px 8px",
                        borderRadius: "100px",
                        background: `${TIER_COLOR[lead.tier]}18`,
                        color: TIER_COLOR[lead.tier],
                      }}
                    >
                      {lead.tier}
                    </span>
                  )}
                </div>
                <div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "3px 8px",
                      borderRadius: "100px",
                      background: `${STATUS_COLOR[lead.status] ?? "#6366f1"}18`,
                      color: STATUS_COLOR[lead.status] ?? "#6366f1",
                    }}
                  >
                    {lead.status}
                  </span>
                </div>
                <div
                  style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}
                >
                  {lead.score != null ? `${lead.score}/100` : "—"}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    flexWrap: "nowrap",
                  }}
                >
                  <button
                    onClick={() => setSelected(lead)}
                    style={{
                      padding: "6px 13px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 500,
                      background: "rgba(99,102,241,0.15)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      color: "#a5b4fc",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    ⚡ Actions
                  </button>
                  <details
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <summary
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        listStyle: "none",
                        margin: 0,
                        padding: "6px 10px",
                        minWidth: "38px",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.04)",
                        color: "#fff",
                        cursor: "pointer",
                        textAlign: "center",
                        fontSize: "18px",
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      ⋮
                    </summary>
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: "8px",
                        width: "160px",
                        background: "#111118",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "14px",
                        boxShadow: "0 18px 36px rgba(0,0,0,0.25)",
                        zIndex: 20,
                        padding: "8px",
                      }}
                    >
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        disabled={deletingLeadId === lead.id}
                        style={{
                          width: "100%",
                          padding: "9px 10px",
                          borderRadius: "12px",
                          border: "none",
                          background:
                            deletingLeadId === lead.id
                              ? "rgba(239,68,68,0.2)"
                              : "rgba(239,68,68,0.15)",
                          color: "#fca5a5",
                          cursor:
                            deletingLeadId === lead.id
                              ? "not-allowed"
                              : "pointer",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                      >
                        {deletingLeadId === lead.id
                          ? "Deleting..."
                          : "Delete lead"}
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Actions Panel */}
      {selected && (
        <QuickActionsPanel
          lead={selected}
          agentId={agentId}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Add Lead Modal */}
      {showAdd && (
        <AddLeadModal
          onClose={() => setShowAdd(false)}
          onCreated={fetchLeads}
        />
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
