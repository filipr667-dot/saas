import React, { useEffect, useState } from "react";
import api, { formatError } from "@/utils/api";
import { Plus, Edit2, UserX, RefreshCw, X } from "lucide-react";

// System roles — control access level (one per user)
const SYSTEM_ROLES = ["admin", "training_coordinator", "readonly"];
const SYSTEM_ROLE_LABELS = {
  admin: "Administrator",
  training_coordinator: "Training Coordinator",
  readonly: "Read Only",
};
const SYSTEM_ROLE_COLORS = {
  admin: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  training_coordinator: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  readonly: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

// Document workflow roles — can hold multiple simultaneously
const DOC_ROLE_OPTIONS = [
  { value: "author",   label: "Author",   desc: "Can create and edit documents" },
  { value: "reviewer", label: "Reviewer", desc: "Can review documents in workflow" },
  { value: "approver", label: "Approver", desc: "Can approve documents in workflow" },
];
const DOC_ROLE_COLORS = {
  author:   "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  reviewer: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approver: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

// Feature modules — unlock optional sections
const MODULE_OPTIONS = [
  { value: "asset_management", label: "Asset Management" },
  { value: "audit_trail",      label: "Audit Trail" },
];

const EMPTY_FORM = {
  email: "", name: "", role: "readonly", password: "",
  department: "", phone: "", position: "",
  doc_roles: [], modules: [],
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | "create" | "edit"
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError("");
    setModal("create");
  };

  const openEdit = (u) => {
    setForm({
      email: u.email,
      name: u.name,
      role: u.role || "readonly",
      password: "",
      department: u.department || "",
      phone: u.phone || "",
      position: u.position || "",
      doc_roles: u.doc_roles || [],
      modules: u.modules || [],
    });
    setEditId(u.id);
    setError("");
    setModal("edit");
  };

  const toggleDocRole = (r) =>
    setForm((f) => ({
      ...f,
      doc_roles: f.doc_roles.includes(r) ? f.doc_roles.filter((x) => x !== r) : [...f.doc_roles, r],
    }));

  const toggleModule = (m) =>
    setForm((f) => ({
      ...f,
      modules: f.modules.includes(m) ? f.modules.filter((x) => x !== m) : [...f.modules, m],
    }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (modal === "create") {
        await api.post("/users", {
          email: form.email,
          name: form.name,
          role: form.role,
          doc_roles: form.doc_roles,
          modules: form.modules,
          password: form.password,
          department: form.department,
          phone: form.phone,
          position: form.position,
        });
        setSuccess("User created successfully");
      } else {
        const payload = {
          name: form.name,
          role: form.role,
          doc_roles: form.doc_roles,
          modules: form.modules,
          department: form.department,
          phone: form.phone,
          position: form.position,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editId}`, payload);
        setSuccess("User updated successfully");
      }
      setModal(null);
      fetchUsers();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (u) => {
    if (!window.confirm(`Deactivate ${u.name}? They will no longer be able to log in.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      setSuccess("User deactivated");
      fetchUsers();
    } catch (err) {
      setError(formatError(err));
    }
  };

  const handleReactivate = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: true });
      setSuccess("User reactivated");
      fetchUsers();
    } catch (err) {
      setError(formatError(err));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} total users</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} data-testid="refresh-users"
            aria-label="Refresh user list" title="Refresh user list"
            className="p-2 rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button data-testid="create-user-btn" onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> New User
          </button>
        </div>
      </div>

      {error && !modal && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">{success}</div>
      )}

      <div className="border border-border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm" data-testid="users-table">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Email</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Access</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Workflow Roles</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Department</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Status</th>
              <th className="text-right px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded" /></td>
                  ))}
                </tr>
              ))
            ) : users.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.id}`} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{u.name}</p>
                  {u.position && <p className="text-xs text-muted-foreground mt-0.5">{u.position}</p>}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-sm">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SYSTEM_ROLE_COLORS[u.role] || "bg-muted text-muted-foreground"}`}>
                    {SYSTEM_ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.doc_roles?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {u.doc_roles.map((r) => (
                        <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOC_ROLE_COLORS[r] || "bg-muted text-muted-foreground"}`}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-sm">{u.department || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${u.is_active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button data-testid={`edit-user-${u.id}`} onClick={() => openEdit(u)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                      title={`Edit ${u.name}`} aria-label={`Edit ${u.name}`}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {u.is_active ? (
                      <button data-testid={`deactivate-user-${u.id}`} onClick={() => handleDeactivate(u)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                        title={`Deactivate ${u.name}`} aria-label={`Deactivate ${u.name}`}>
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button data-testid={`reactivate-user-${u.id}`} onClick={() => handleReactivate(u)}
                        className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 transition-colors"
                        title={`Reactivate ${u.name}`} aria-label={`Reactivate ${u.name}`}>
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div data-testid="user-modal" className="relative bg-card border border-border rounded-md p-6 w-full max-w-lg z-10 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">{modal === "create" ? "Create User" : "Edit User"}</h3>
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
              {modal === "create" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email *</label>
                  <input type="email" data-testid="user-email-input"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Name *</label>
                <input type="text" data-testid="user-name-input"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>

              {/* System role */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Access Level *</label>
                <select data-testid="user-role-select"
                  value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {SYSTEM_ROLES.map((r) => <option key={r} value={r}>{SYSTEM_ROLE_LABELS[r]}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {form.role === "admin" && "Full access to all features and all documents."}
                  {form.role === "training_coordinator" && "Can manage the training matrix and EHS records."}
                  {form.role === "readonly" && "Can view published documents. Assign workflow roles below for document actions."}
                </p>
              </div>

              {/* Document workflow roles */}
              {form.role !== "admin" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">Document Workflow Roles</label>
                  <div className="space-y-2">
                    {DOC_ROLE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-start gap-2.5 cursor-pointer px-3 py-2.5 rounded-md border border-border hover:bg-muted/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={form.doc_roles.includes(opt.value)}
                          onChange={() => toggleDocRole(opt.value)}
                          className="mt-0.5 rounded border-input"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground leading-tight">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Feature modules */}
              {form.role !== "admin" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">Feature Modules</label>
                  <div className="flex gap-2 flex-wrap">
                    {MODULE_OPTIONS.map((opt) => (
                      <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors text-sm
                        ${form.modules.includes(opt.value) ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
                        <input
                          type="checkbox"
                          checked={form.modules.includes(opt.value)}
                          onChange={() => toggleModule(opt.value)}
                          className="rounded border-input"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Admin users always have access to all modules.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Department</label>
                  <input type="text" data-testid="user-dept-input"
                    value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Position / Job Title</label>
                  <input type="text"
                    value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="e.g. Line Operator"
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Phone Number</label>
                <input type="text"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +44 7700 000000"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  {modal === "create" ? "Password *" : "New Password (leave blank to keep)"}
                </label>
                <input type="password" data-testid="user-password-input"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={modal === "create"}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setModal(null)}
                  className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted">Cancel</button>
                <button type="submit" data-testid="save-user-btn" disabled={saving}
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
