import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatError } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Building2, UserCheck, RefreshCw, Search, AlertCircle } from "lucide-react";

const ROLE_LABELS = {
  admin: "Administrator",
  training_coordinator: "Training Coordinator",
  readonly: "Read Only",
  super_admin: "Super Admin",
};

export default function SuperAdmin() {
  const { startImpersonation } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [impersonating, setImpersonating] = useState(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/superadmin/users");
      setUsers(data);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

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
      setError(formatError(e));
    } finally {
      setImpersonating(null);
    }
  };

  const filteredUsers = users.filter((u) =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.department || "").toLowerCase().includes(search.toLowerCase()) ||
    (ROLE_LABELS[u.role] || u.role || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Super Admin</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform management — impersonate users and manage organisations</p>
        </div>
        <button onClick={fetchUsers}
          className="p-2 rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground"
          title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Users Section ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">All Users</h2>
          {!loading && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{users.length}</span>}
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
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden md:table-cell">Department</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Role</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden lg:table-cell">Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
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
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.department || "—"}</td>
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
                    {u.is_active ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== "super_admin" && (
                      <button
                        onClick={() => handleImpersonate(u)}
                        disabled={!!impersonating}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-md transition-colors disabled:opacity-50 ml-auto"
                      >
                        {impersonating === u.id ? (
                          <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
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

      {/* ── Companies Section (placeholder) ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Companies</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Coming soon</span>
        </div>

        <div className="border border-border border-dashed rounded-md p-10 text-center bg-card">
          <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-foreground mb-1">Multi-tenancy coming later</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Company management will be enabled when a second client is onboarded.
            You'll be able to manage organisations, switch between them, and assign company-level settings.
          </p>
        </div>
      </div>
    </div>
  );
}
