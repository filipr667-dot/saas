import React, { useEffect, useState } from "react";
import api, { formatError } from "@/utils/api";
import { Plus, Edit2, X } from "lucide-react";

export default function Settings() {
  const [docTypes, setDocTypes] = useState([]);
  const [emailConfig, setEmailConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", prefix: "", review_period_months: 12 });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dtRes, emailRes] = await Promise.all([
        api.get("/settings/doc-types"),
        api.get("/settings/email-config"),
      ]);
      setDocTypes(dtRes.data);
      setEmailConfig(emailRes.data);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setForm({ name: "", prefix: "", review_period_months: 12 });
    setEditId(null);
    setError("");
    setModal("create");
  };

  const openEdit = (dt) => {
    setForm({ name: dt.name, prefix: dt.prefix, review_period_months: dt.review_period_months });
    setEditId(dt.id);
    setError("");
    setModal("edit");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (modal === "create") {
        await api.post("/settings/doc-types", form);
        setSuccess("Document type created");
      } else {
        await api.put(`/settings/doc-types/${editId}`, {
          name: form.name,
          review_period_months: parseInt(form.review_period_months),
        });
        setSuccess("Document type updated");
      }
      setModal(null);
      fetchAll();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (dt) => {
    try {
      await api.put(`/settings/doc-types/${dt.id}`, { is_active: !dt.is_active });
      setSuccess(`Document type ${dt.is_active ? "deactivated" : "activated"}`);
      fetchAll();
    } catch (err) {
      setError(formatError(err));
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure document types, review periods, and system settings</p>
      </div>

      {error && !modal && (
        <div className="px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}
      {success && (
        <div className="px-3 py-2.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">{success}</div>
      )}

      {/* Document Types */}
      <div className="border border-border rounded-md bg-card">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <p className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Document Types</p>
            <p className="text-xs text-muted-foreground mt-0.5">Configure document categories and their review periods</p>
          </div>
          <button data-testid="add-doc-type-btn" onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Add Type
          </button>
        </div>

        <div className="divide-y divide-border">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-3 animate-pulse flex items-center gap-4">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-16" />
                <div className="h-4 bg-muted rounded w-24 ml-auto" />
              </div>
            ))
          ) : docTypes.map((dt) => (
            <div key={dt.id} data-testid={`doc-type-${dt.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    {dt.prefix}
                  </span>
                  <span className="text-sm font-medium text-foreground">{dt.name}</span>
                  {!dt.is_active && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Inactive</span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{dt.review_period_months}mo review</span>
              <div className="flex gap-1">
                <button data-testid={`edit-type-${dt.id}`} onClick={() => openEdit(dt)}
                  title={`Edit ${dt.name}`} aria-label={`Edit ${dt.name}`}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button data-testid={`toggle-type-${dt.id}`} onClick={() => toggleActive(dt)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors
                    ${dt.is_active ? "hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" :
                    "hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600"}`}
                  title={dt.is_active ? `Deactivate ${dt.name}` : `Activate ${dt.name}`}
                  aria-label={dt.is_active ? `Deactivate ${dt.name}` : `Activate ${dt.name}`}>
                  {dt.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Configuration */}
      {emailConfig && (
        <div className="border border-border rounded-md bg-card">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Email Notifications</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Resend API</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                ${emailConfig.resend_configured
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                {emailConfig.resend_configured ? "Configured" : "Not Configured"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sender Email</span>
              <span className="text-sm font-mono text-foreground">{emailConfig.sender_email}</span>
            </div>
            {!emailConfig.resend_configured && (
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                Email notifications are disabled. Add your Resend API key to RESEND_API_KEY in the backend .env file to enable email notifications.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Future Training Module */}
      <div className="border border-border rounded-md bg-card">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Training Module</p>
        </div>
        <div className="px-5 py-6 text-center">
          <p className="text-sm text-muted-foreground">Training module (employee acknowledgements, competency tracking) is prepared in the database schema and will be available in a future release.</p>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div data-testid="doc-type-modal" className="relative bg-card border border-border rounded-md p-6 w-full max-w-sm z-10 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">{modal === "create" ? "Add Document Type" : "Edit Document Type"}</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Name *</label>
                <input type="text" data-testid="type-name-input"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>

              {modal === "create" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Prefix (e.g. POL) *</label>
                  <input type="text" data-testid="type-prefix-input"
                    value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })} required
                    maxLength={6}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Review Period (months) *</label>
                <input type="number" data-testid="type-period-input" min={1} max={120}
                  value={form.review_period_months} onChange={(e) => setForm({ ...form, review_period_months: e.target.value })} required
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                <p className="text-xs text-muted-foreground mt-1">Default: Policy/WI/Form=36mo, Procedure/Register/Manual=12mo</p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setModal(null)}
                  className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted">Cancel</button>
                <button type="submit" data-testid="save-type-btn" disabled={saving}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
