import React, { useEffect, useState } from "react";
import api, { formatError } from "@/utils/api";
import {
  Plus, Trash2, RefreshCw, X, Users, BookOpen, CheckCircle, Clock,
  ChevronDown, ChevronUp, Mail, Phone,
} from "lucide-react";

const ROLES = ["admin", "author", "reviewer", "approver", "readonly"];
const ROLE_LABELS = {
  admin: "Administrator", author: "Author", reviewer: "Reviewer",
  approver: "Approver", readonly: "Read Only",
};
const ROLE_COLORS = {
  admin: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  author: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  reviewer: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approver: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  readonly: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const TABS = ["matrix", "rules"];

export default function TrainingMatrix() {
  const [tab, setTab] = useState("matrix");

  // Matrix state
  const [matrixUsers, setMatrixUsers] = useState([]);
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState(null);
  const [userRecords, setUserRecords] = useState({});
  const [recordsLoading, setRecordsLoading] = useState({});

  // Rules state
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [ruleModal, setRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({ doc_type: "", applicable_roles: [], applicable_departments: [], applicable_positions: [] });
  const [ruleError, setRuleError] = useState("");
  const [ruleSaving, setRuleSaving] = useState(false);
  const [docTypes, setDocTypes] = useState([]);

  // General
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { fetchMatrix(); fetchRules(); fetchDocTypes(); }, []);

  const fetchMatrix = async () => {
    setMatrixLoading(true);
    try {
      const { data } = await api.get("/training/matrix");
      setMatrixUsers(data);
    } catch (e) { setError(formatError(e)); }
    finally { setMatrixLoading(false); }
  };

  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const { data } = await api.get("/training/rules");
      setRules(data);
    } catch (e) { setError(formatError(e)); }
    finally { setRulesLoading(false); }
  };

  const fetchDocTypes = async () => {
    try {
      const { data } = await api.get("/settings/doc-types");
      setDocTypes(data.filter((dt) => dt.is_active));
    } catch (_) {}
  };

  const toggleExpandUser = async (userId) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    if (!userRecords[userId]) {
      setRecordsLoading((prev) => ({ ...prev, [userId]: true }));
      try {
        const { data } = await api.get(`/training/records?user_id=${userId}`);
        setUserRecords((prev) => ({ ...prev, [userId]: data }));
      } catch (_) {}
      finally { setRecordsLoading((prev) => ({ ...prev, [userId]: false })); }
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    setRuleError("");
    setRuleSaving(true);
    try {
      await api.post("/training/rules", ruleForm);
      setSuccess("Training rule created");
      setRuleModal(false);
      fetchRules();
    } catch (err) { setRuleError(formatError(err)); }
    finally { setRuleSaving(false); }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Delete training rule for "${rule.doc_type}"?`)) return;
    try {
      await api.delete(`/training/rules/${rule.id}`);
      setSuccess("Rule deleted");
      fetchRules();
    } catch (err) { setError(formatError(err)); }
  };

  const toggleRole = (role) => {
    setRuleForm((prev) => ({
      ...prev,
      applicable_roles: prev.applicable_roles.includes(role)
        ? prev.applicable_roles.filter((r) => r !== role)
        : [...prev.applicable_roles, role],
    }));
  };

  const openRuleModal = () => {
    setRuleForm({ doc_type: "", applicable_roles: [], applicable_departments: [], applicable_positions: [] });
    setRuleError("");
    setRuleModal(true);
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Training Matrix</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage training rules and track user completion</p>
        </div>
        <button onClick={() => { fetchMatrix(); fetchRules(); }}
          className="p-2 rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground"
          title="Refresh" aria-label="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">{success}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {[{ id: "matrix", label: "User Matrix", icon: Users }, { id: "rules", label: "Training Rules", icon: BookOpen }].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ─── MATRIX TAB ─── */}
      {tab === "matrix" && (
        <div className="border border-border rounded-md overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden md:table-cell">Position</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden sm:table-cell">Department</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden lg:table-cell">Contact</th>
                <th className="text-center px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Pending</th>
                <th className="text-center px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Completed</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {matrixLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : matrixUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">No users found</td>
                </tr>
              ) : matrixUsers.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => toggleExpandUser(u.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.name}</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || "bg-muted text-muted-foreground"}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.position || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{u.department || "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {u.email && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />{u.email}
                          </span>
                        )}
                        {u.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />{u.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.pending_training > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Clock className="w-3 h-3" />{u.pending_training}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.completed_training > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <CheckCircle className="w-3 h-3" />{u.completed_training}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {expandedUser === u.id ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                    </td>
                  </tr>

                  {/* Expanded records */}
                  {expandedUser === u.id && (
                    <tr>
                      <td colSpan={7} className="bg-muted/20 px-6 py-4 border-b border-border">
                        {recordsLoading[u.id] ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            Loading records…
                          </div>
                        ) : !userRecords[u.id] || userRecords[u.id].length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">No training records for this user.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Document</th>
                                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Type</th>
                                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Assigned</th>
                                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Completed</th>
                                  <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {userRecords[u.id].map((r) => (
                                  <tr key={r.id}>
                                    <td className="py-2 pr-4">
                                      <span className="font-mono font-semibold text-foreground">{r.document_number}</span>
                                      <span className="text-muted-foreground ml-2">{r.document_title}</span>
                                    </td>
                                    <td className="py-2 pr-4 text-muted-foreground">{r.doc_type}</td>
                                    <td className="py-2 pr-4 text-muted-foreground">{formatDate(r.assigned_at)}</td>
                                    <td className="py-2 pr-4 text-muted-foreground">{formatDate(r.completed_at)}</td>
                                    <td className="py-2">
                                      {r.status === "completed" ? (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
                                          Signed Off
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                                          Pending
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── RULES TAB ─── */}
      {tab === "rules" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Configure which document types trigger training for which roles. When a document of that type is approved, training records are automatically created for all matching users.
            </p>
            <button onClick={openRuleModal}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0 ml-4">
              <Plus className="w-4 h-4" /> New Rule
            </button>
          </div>

          <div className="border border-border rounded-md overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Document Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Applicable Roles</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden md:table-cell">Positions</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden lg:table-cell">Departments</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden sm:table-cell">Created By</th>
                  <th className="text-right px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rulesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">
                      No training rules defined. Create one to start assigning training on document approval.
                    </td>
                  </tr>
                ) : rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{rule.doc_type}</td>
                    <td className="px-4 py-3">
                      {rule.applicable_roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">All roles</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {rule.applicable_roles.map((r) => (
                            <span key={r} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[r] || "bg-muted text-muted-foreground"}`}>
                              {ROLE_LABELS[r] || r}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {(rule.applicable_positions || []).length === 0
                        ? <span className="italic">All positions</span>
                        : rule.applicable_positions.join(", ")}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {(rule.applicable_departments || []).length === 0
                        ? <span className="italic">All depts</span>
                        : rule.applicable_departments.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{rule.created_by}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDeleteRule(rule)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                        title="Delete rule" aria-label="Delete rule">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── New Rule Modal ─── */}
      {ruleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRuleModal(false)} />
          <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-md z-10 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">New Training Rule</h3>
              <button onClick={() => setRuleModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {ruleError && (
              <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
                {ruleError}
              </div>
            )}

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Document Type *</label>
                {docTypes.length > 0 ? (
                  <select value={ruleForm.doc_type} onChange={(e) => setRuleForm({ ...ruleForm, doc_type: e.target.value })} required
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">Select a document type…</option>
                    {docTypes.map((dt) => <option key={dt.id} value={dt.name}>{dt.name}</option>)}
                  </select>
                ) : (
                  <input type="text" value={ruleForm.doc_type} onChange={(e) => setRuleForm({ ...ruleForm, doc_type: e.target.value })} required
                    placeholder="e.g. Work Instruction"
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">
                  Applicable Roles <span className="text-muted-foreground/70 font-normal">(leave all unchecked = all roles)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button key={r} type="button" onClick={() => toggleRole(r)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors
                        ${ruleForm.applicable_roles.includes(r)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input text-muted-foreground hover:border-primary hover:text-primary"}`}>
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Filter by Position / Job Title <span className="text-muted-foreground/70 font-normal">(comma-separated, or leave blank for all)</span>
                </label>
                <input type="text"
                  value={ruleForm.applicable_positions.join(", ")}
                  onChange={(e) => setRuleForm({
                    ...ruleForm,
                    applicable_positions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })}
                  placeholder="e.g. Engineer, Line Operator, QA Technician"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Filter by Department <span className="text-muted-foreground/70 font-normal">(comma-separated, or leave blank for all)</span>
                </label>
                <input type="text"
                  value={ruleForm.applicable_departments.join(", ")}
                  onChange={(e) => setRuleForm({
                    ...ruleForm,
                    applicable_departments: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })}
                  placeholder="e.g. Production, Quality"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setRuleModal(false)}
                  className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted">Cancel</button>
                <button type="submit" disabled={ruleSaving}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50">
                  {ruleSaving ? "Saving…" : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
