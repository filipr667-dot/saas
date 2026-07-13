import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatError } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users, Building2, UserCheck, RefreshCw, Search, AlertCircle,
  Plus, X, Eye, EyeOff, ChevronRight, CheckCircle2, XCircle,
} from "lucide-react";

const ROLE_LABELS = {
  admin: "Administrator",
  training_coordinator: "Training Coordinator",
  readonly: "Read Only",
  super_admin: "Super Admin",
};

const PLAN_LABELS = { trial: "Trial", starter: "Starter", pro: "Pro", enterprise: "Enterprise" };
const PLAN_COLORS = {
  trial: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  starter: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  pro: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  enterprise: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const TABS = ["Users", "Organisations"];

const INPUT = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const LABEL = "block text-xs font-medium text-foreground mb-1";

export default function SuperAdmin() {
  const { startImpersonation } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("Users");

  // ── users state ──
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [search, setSearch] = useState("");
  const [impersonating, setImpersonating] = useState(null);

  // ── orgs state ──
  const [orgs, setOrgs] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState("");
  const [orgsLoaded, setOrgsLoaded] = useState(false);

  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [editOrg, setEditOrg] = useState(null);       // org being edited
  const [orgForm, setOrgForm] = useState({});
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgFormError, setOrgFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ── fetch ──
  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (tab === "Organisations" && !orgsLoaded) fetchOrgs();
  }, [tab]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const { data } = await api.get("/superadmin/users");
      setUsers(data);
    } catch (e) {
      setUsersError(formatError(e));
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchOrgs = async () => {
    setOrgsLoading(true);
    setOrgsError("");
    try {
      const { data } = await api.get("/superadmin/orgs");
      setOrgs(data);
      setOrgsLoaded(true);
    } catch (e) {
      setOrgsError(formatError(e));
    } finally {
      setOrgsLoading(false);
    }
  };

  // ── impersonation ──
  const handleImpersonate = async (targetUser) => {
    if (impersonating) return;
    setImpersonating(targetUser.id);
    try {
      const { data } = await api.post(`/superadmin/impersonate/${targetUser.id}`);
      startImpersonation(data.access_token, {
        id: targetUser.id,
        name: targetUser.name,
        role: targetUser.role,
        doc_roles: targetUser.doc_roles || [],
        modules: targetUser.modules || [],
        email: targetUser.email,
        department: targetUser.department,
      });
      navigate("/dashboard");
    } catch (e) {
      setUsersError(formatError(e));
    } finally {
      setImpersonating(null);
    }
  };

  // ── org create/edit ──
  const openCreate = () => {
    setOrgForm({ name: "", slug: "", plan: "trial", admin_email: "", admin_name: "", admin_password: "" });
    setOrgFormError("");
    setShowPassword(false);
    setEditOrg(null);
    setShowCreateOrg(true);
  };

  const openEdit = (org) => {
    setOrgForm({ name: org.name, plan: org.plan || "trial", is_active: org.is_active });
    setOrgFormError("");
    setEditOrg(org);
    setShowCreateOrg(false);
  };

  const closeOrgModal = () => {
    setShowCreateOrg(false);
    setEditOrg(null);
    setOrgFormError("");
  };

  const slugify = (v) => v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setOrgSaving(true);
    setOrgFormError("");
    try {
      await api.post("/superadmin/orgs", orgForm);
      await fetchOrgs();
      closeOrgModal();
    } catch (err) {
      setOrgFormError(formatError(err));
    } finally {
      setOrgSaving(false);
    }
  };

  const handleUpdateOrg = async (e) => {
    e.preventDefault();
    setOrgSaving(true);
    setOrgFormError("");
    try {
      await api.put(`/superadmin/orgs/${editOrg.id}`, {
        name: orgForm.name,
        plan: orgForm.plan,
        is_active: orgForm.is_active,
      });
      await fetchOrgs();
      closeOrgModal();
    } catch (err) {
      setOrgFormError(formatError(err));
    } finally {
      setOrgSaving(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.department || "").toLowerCase().includes(search.toLowerCase()) ||
    (ROLE_LABELS[u.role] || u.role || "").toLowerCase().includes(search.toLowerCase())
  );

  const activeError = tab === "Users" ? usersError : orgsError;

  return (
    <div>
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Super Admin</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform management — impersonate users and manage organisations</p>
        </div>
        <button
          onClick={tab === "Users" ? fetchUsers : () => { setOrgsLoaded(false); fetchOrgs(); }}
          className="p-2 rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground"
          title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* error banner */}
      {activeError && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{activeError}
        </div>
      )}

      {/* tabs */}
      <div className="flex gap-0 border-b border-border mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Users tab ── */}
      {tab === "Users" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">All Users</h2>
            {!usersLoading && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{users.length}</span>
            )}
          </div>

          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, role…"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="border border-border rounded-md overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden md:table-cell">Org</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden lg:table-cell">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      {search ? "No users match your search." : "No users found."}
                    </td>
                  </tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.name}</div>
                      {u.position && <div className="text-xs text-muted-foreground">{u.position}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                      {u.org_id || "default"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground inline-block w-fit">
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                        {(u.doc_roles || []).length > 0 && (
                          <span className="text-xs text-muted-foreground">{u.doc_roles.join(", ")}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {u.is_active
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">Active</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">Inactive</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== "super_admin" && (
                        <button
                          onClick={() => handleImpersonate(u)}
                          disabled={!!impersonating}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-md transition-colors disabled:opacity-50 ml-auto">
                          {impersonating === u.id
                            ? <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                            : <UserCheck className="w-3.5 h-3.5" />}
                          {impersonating === u.id ? "Switching…" : "Impersonate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Organisations tab ── */}
      {tab === "Organisations" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Organisations</h2>
              {!orgsLoading && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{orgs.length}</span>
              )}
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Organisation
            </button>
          </div>

          {orgsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : orgs.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-12 text-center bg-card">
              <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No organisations yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="border border-border rounded-md overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Organisation</th>
                    <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden sm:table-cell">Slug</th>
                    <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Plan</th>
                    <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden md:table-cell">Users</th>
                    <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden lg:table-cell">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orgs.map((org) => (
                    <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{org.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{org.id}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell font-mono text-xs">{org.slug}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLAN_COLORS[org.plan] || PLAN_COLORS.trial}`}>
                          {PLAN_LABELS[org.plan] || org.plan || "Trial"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-sm">{org.user_count ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {org.is_active !== false
                          ? <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                          : <span className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400"><XCircle className="w-3.5 h-3.5" /> Suspended</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(org)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/70 text-foreground rounded-md transition-colors ml-auto">
                          Edit <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Create Org Modal ── */}
      {showCreateOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">New Organisation</h3>
              <button onClick={closeOrgModal} className="p-1 hover:bg-muted rounded-md text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="p-5 space-y-4">
              {orgFormError && (
                <div className="px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs">
                  {orgFormError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={LABEL}>Organisation Name *</label>
                  <input
                    required
                    className={INPUT}
                    value={orgForm.name || ""}
                    onChange={(e) => {
                      const name = e.target.value;
                      setOrgForm((f) => ({ ...f, name, slug: slugify(name) }));
                    }}
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className={LABEL}>Slug *</label>
                  <input
                    required
                    className={INPUT}
                    value={orgForm.slug || ""}
                    onChange={(e) => setOrgForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="acme-corp"
                  />
                </div>
                <div>
                  <label className={LABEL}>Plan</label>
                  <select
                    className={INPUT}
                    value={orgForm.plan || "trial"}
                    onChange={(e) => setOrgForm((f) => ({ ...f, plan: e.target.value }))}>
                    {Object.entries(PLAN_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-1 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-3">Admin User</p>
                <div className="space-y-3">
                  <div>
                    <label className={LABEL}>Full Name *</label>
                    <input
                      required
                      className={INPUT}
                      value={orgForm.admin_name || ""}
                      onChange={(e) => setOrgForm((f) => ({ ...f, admin_name: e.target.value }))}
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Email *</label>
                    <input
                      required
                      type="email"
                      className={INPUT}
                      value={orgForm.admin_email || ""}
                      onChange={(e) => setOrgForm((f) => ({ ...f, admin_email: e.target.value }))}
                      placeholder="jane@acme.com"
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Password *</label>
                    <div className="relative">
                      <input
                        required
                        type={showPassword ? "text" : "password"}
                        className={INPUT + " pr-9"}
                        value={orgForm.admin_password || ""}
                        onChange={(e) => setOrgForm((f) => ({ ...f, admin_password: e.target.value }))}
                        placeholder="At least 10 characters"
                      />
                      <button type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Min 10 chars · uppercase · lowercase · digit · special char</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeOrgModal}
                  className="px-4 py-2 text-sm rounded-md border border-input bg-background hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={orgSaving}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 font-medium">
                  {orgSaving ? "Creating…" : "Create Organisation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Org Modal ── */}
      {editOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Edit Organisation</h3>
              <button onClick={closeOrgModal} className="p-1 hover:bg-muted rounded-md text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateOrg} className="p-5 space-y-4">
              {orgFormError && (
                <div className="px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs">
                  {orgFormError}
                </div>
              )}

              <div>
                <label className={LABEL}>Organisation Name</label>
                <input
                  className={INPUT}
                  value={orgForm.name || ""}
                  onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className={LABEL}>Plan</label>
                <select
                  className={INPUT}
                  value={orgForm.plan || "trial"}
                  onChange={(e) => setOrgForm((f) => ({ ...f, plan: e.target.value }))}>
                  {Object.entries(PLAN_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Active</p>
                  <p className="text-xs text-muted-foreground">Suspended orgs cannot log in</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOrgForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`relative w-10 h-5.5 rounded-full transition-colors ${orgForm.is_active !== false ? "bg-primary" : "bg-muted"}`}
                  style={{ height: "22px", width: "40px" }}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${orgForm.is_active !== false ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeOrgModal}
                  className="px-4 py-2 text-sm rounded-md border border-input bg-background hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={orgSaving}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 font-medium">
                  {orgSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
