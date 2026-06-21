import React, { useEffect, useState, useMemo } from "react";
import api, { formatError } from "@/utils/api";
import { Plus, Edit2, UserX, RefreshCw, X, Search, Package } from "lucide-react";

// ── Role config ────────────────────────────────────────────────────────────────

const SYSTEM_ROLES = [
  { value: "admin", label: "Administrator" },
  { value: "readonly", label: "Read Only" },
];

const DOC_ROLES = [
  { value: "author", label: "Author" },
  { value: "reviewer", label: "Reviewer" },
  { value: "approver", label: "Approver" },
];

// Training access — combinable with any base role, stored in doc_roles
const TRAINING_ACCESS_FLAG = "training_coordinator";

const MODULES = [
  { value: "asset_management", label: "Asset Management" },
  { value: "audit_trail", label: "Audit Trail" },
];

const ROLE_LABELS = {
  admin: "Administrator",
  author: "Author",
  reviewer: "Reviewer",
  approver: "Approver",
  readonly: "Read Only",
  training_coordinator: "Training Coordinator",
};

const ROLE_COLORS = {
  admin: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  author: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  reviewer: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approver: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  readonly: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  training_coordinator: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

const MODULE_COLORS = {
  asset_management: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  audit_trail: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const MODULE_LABELS = {
  asset_management: "Asset Mgmt",
  audit_trail: "Audit Trail",
};

const EMPTY_FORM = {
  email: "", name: "", role: "readonly",
  doc_roles: [], modules: [],
  password: "", department: "", phone: "", position: "",
};

function getRoleChips(user) {
  const chips = [];
  if (user.role) chips.push({ key: user.role, label: ROLE_LABELS[user.role] || user.role, color: ROLE_COLORS[user.role] || "bg-muted text-muted-foreground" });
  (user.doc_roles || []).forEach(r => chips.push({ key: r, label: ROLE_LABELS[r] || r, color: ROLE_COLORS[r] || "bg-muted text-muted-foreground" }));
  return chips;
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");

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

  const departments = useMemo(() => {
    return [...new Set(users.map(u => u.department).filter(Boolean))].sort();
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (filterStatus === "active" && !u.is_active) return false;
      if (filterStatus === "inactive" && u.is_active) return false;
      if (filterRole !== "all") {
        const allRoles = [u.role, ...(u.doc_roles || [])];
        if (!allRoles.includes(filterRole)) return false;
      }
      if (filterDept !== "all" && u.department !== filterDept) return false;
      if (q) {
        const allRoles = [u.role, ...(u.doc_roles || [])].join(" ");
        const hay = `${u.name} ${u.email} ${allRoles} ${u.department || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, filterRole, filterDept, filterStatus]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError("");
    setModal("create");
  };

  const openEdit = (u) => {
    setForm({
      email: u.email, name: u.name, role: u.role || "readonly",
      doc_roles: u.doc_roles || [], modules: u.modules || [],
      password: "", department: u.department || "", phone: u.phone || "", position: u.position || "",
    });
    setEditId(u.id);
    setError("");
    setModal("edit");
  };

  const toggleDocRole = (r) => {
    setForm(f => ({
      ...f,
      doc_roles: f.doc_roles.includes(r) ? f.doc_roles.filter(x => x !== r) : [...f.doc_roles, r],
    }));
  };

  const toggleModule = (m) => {
    setForm(f => ({
      ...f,
      modules: f.modules.includes(m) ? f.modules.filter(x => x !== m) : [...f.modules, m],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (modal === "create") {
        await api.post("/users", {
          email: form.email, name: form.name, role: form.role,
          doc_roles: form.doc_roles, modules: form.modules,
          password: form.password, department: form.department,
          phone: form.phone, position: form.position,
        });
        setSuccess("User created successfully");
      } else {
        const payload = {
          name: form.name, role: form.role, doc_roles: form.doc_roles,
          modules: form.modules, department: form.department,
          phone: form.phone, position: form.position,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editId}`, payload);
        setSuccess("User updated successfully");
      }
      setModal(null);
      fetchUsers();
      setTimeout(() => setSuccess(""), 4000);
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
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(formatError(err));
    }
  };

  const handleReactivate = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: true });
      setSuccess("User reactivated");
      fetchUsers();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(formatError(err));
    }
  };

  const allFilterRoles = [
    ...SYSTEM_ROLES,
    { value: "training_coordinator", label: "Training Coordinator" },
    ...DOC_ROLES,
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{filtered.length} of {users.length} users</p>
        <div className="flex gap-2">
          <button onClick={fetchUsers} aria-label="Refresh" title="Refresh"
            className="p-2 rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> New User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, role, department…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">All Roles</option>
          {allFilterRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error && !modal && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">{success}</div>
      )}

      <div className="border border-border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden md:table-cell">Email</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Roles</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden lg:table-cell">Modules</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden sm:table-cell">Department</th>
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
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No users match the current filters.</td>
              </tr>
            ) : filtered.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {getRoleChips(u).map(chip => (
                      <span key={chip.key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${chip.color}`}>{chip.label}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {(u.role === "admin" ? ["asset_management", "audit_trail"] : (u.modules || [])).map(m => (
                      <span key={m} className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODULE_COLORS[m] || "bg-muted text-muted-foreground"}`}>
                        {MODULE_LABELS[m] || m}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{u.department || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(u)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" title={`Edit ${u.name}`}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {u.is_active ? (
                      <button onClick={() => handleDeactivate(u)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors" title={`Deactivate ${u.name}`}>
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button onClick={() => handleReactivate(u)}
                        className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 transition-colors" title={`Reactivate ${u.name}`}>
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

      {/* Create / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-lg z-10 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">{modal === "create" ? "Create User" : "Edit User"}</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            {error && (
              <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">{error}</div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {modal === "create" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>

              {/* System role — pick one */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Access Level *</label>
                <div className="flex gap-2 flex-wrap">
                  {SYSTEM_ROLES.map(r => (
                    <button key={r.value} type="button"
                      onClick={() => setForm({ ...form, role: r.value })}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        form.role === r.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input bg-background text-muted-foreground hover:bg-muted"
                      }`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Document roles — pick multiple */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Document Roles <span className="font-normal text-muted-foreground/70">(optional — multiple)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DOC_ROLES.map(r => (
                    <button key={r.value} type="button"
                      onClick={() => toggleDocRole(r.value)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        form.doc_roles.includes(r.value)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-input bg-background text-muted-foreground hover:bg-muted"
                      }`}>
                      {r.label}
                    </button>
                  ))}
                </div>
                {form.doc_roles.includes("author") && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Note: authors cannot review or approve their own documents.
                  </p>
                )}
              </div>

              {/* Training access — combinable with any base role */}
              {form.role !== "admin" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Training Access <span className="font-normal text-muted-foreground/70">(optional)</span>
                  </label>
                  <button type="button"
                    onClick={() => toggleDocRole(TRAINING_ACCESS_FLAG)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      form.doc_roles.includes(TRAINING_ACCESS_FLAG)
                        ? "bg-teal-600 text-white border-teal-600"
                        : "border-input bg-background text-muted-foreground hover:bg-muted"
                    }`}>
                    <span className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                      form.doc_roles.includes(TRAINING_ACCESS_FLAG)
                        ? "bg-white border-white"
                        : "border-muted-foreground"
                    }`}>
                      {form.doc_roles.includes(TRAINING_ACCESS_FLAG) && (
                        <svg className="w-2.5 h-2.5 text-teal-600" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    Training Coordinator
                  </button>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Can view and manage the training matrix, records, and EHS certifications.
                  </p>
                </div>
              )}

              {/* Modules */}
              {form.role !== "admin" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    <Package className="w-3.5 h-3.5 inline mr-1" />
                    Feature Modules <span className="font-normal">(paid add-ons)</span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {MODULES.map(m => (
                      <button key={m.value} type="button"
                        onClick={() => toggleModule(m.value)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                          form.modules.includes(m.value)
                            ? "bg-orange-500 text-white border-orange-500"
                            : "border-input bg-background text-muted-foreground hover:bg-muted"
                        }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Department</label>
                <input type="text" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Position / Job Title</label>
                  <input type="text" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                    placeholder="e.g. Line Operator"
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Phone Number</label>
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g. +44 7700 000000"
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  {modal === "create" ? "Password *" : "New Password (leave blank to keep)"}
                </label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  required={modal === "create"}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setModal(null)}
                  className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── General tab ───────────────────────────────────────────────────────────────

function GeneralTab() {
  const [emailConfig, setEmailConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/settings/email-config")
      .then(r => setEmailConfig(r.data))
      .catch(e => setError(formatError(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}
      <div className="border border-border rounded-md bg-card">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Email Notifications</p>
        </div>
        {loading ? (
          <div className="px-5 py-4 animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-1/3" />
          </div>
        ) : emailConfig && (
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Resend API</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${emailConfig.resend_configured ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                {emailConfig.resend_configured ? "Configured" : "Not Configured"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sender Email</span>
              <span className="text-sm font-mono text-foreground">{emailConfig.sender_email}</span>
            </div>
            {!emailConfig.resend_configured && (
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                Email notifications are disabled. Add RESEND_API_KEY to backend environment variables to enable.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "users", label: "User Management" },
  { key: "general", label: "General" },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">User Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage users, roles and system configuration</p>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "users" && <UsersTab />}
      {activeTab === "general" && <GeneralTab />}
    </div>
  );
}
