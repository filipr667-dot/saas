import React, { useEffect, useState } from "react";
import api, { formatError } from "@/utils/api";
import { Plus, Edit2, UserX, RefreshCw, X } from "lucide-react";

const ROLES = ["admin", "author", "reviewer", "approver", "readonly"];
const ROLE_LABELS = { admin: "Administrator", author: "Author", reviewer: "Reviewer", approver: "Approver", readonly: "Read Only" };
const ROLE_COLORS = {
  admin: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  author: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  reviewer: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approver: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  readonly: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const EMPTY_FORM = { email: "", name: "", role: "author", password: "", department: "" };

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
    setForm({ email: u.email, name: u.name, role: u.role, password: "", department: u.department || "" });
    setEditId(u.id);
    setError("");
    setModal("edit");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (modal === "create") {
        await api.post("/users", form);
        setSuccess("User created successfully");
      } else {
        const payload = { name: form.name, role: form.role, department: form.department };
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
    if (!window.confirm(`Deactivate ${u.name}?`)) return;
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
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Role</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Department</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Status</th>
              <th className="text-right px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded" /></td>
                  ))}
                </tr>
              ))
            ) : users.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.id}`} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || "bg-muted text-muted-foreground"}`}>{ROLE_LABELS[u.role]}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.department || "—"}</td>
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
          <div data-testid="user-modal" className="relative bg-card border border-border rounded-md p-6 w-full max-w-md z-10 shadow-xl">
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

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Role *</label>
                <select data-testid="user-role-select"
                  value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Department</label>
                <input type="text" data-testid="user-dept-input"
                  value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
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
