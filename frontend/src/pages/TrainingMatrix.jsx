import React, { useEffect, useState, useRef } from "react";
import api, { formatError } from "@/utils/api";
import {
  Plus, Trash2, RefreshCw, X, Users, BookOpen, CheckCircle, Clock,
  ChevronDown, ChevronUp, Mail, Phone, Search, FileText, Send,
} from "lucide-react";

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

  // Rule form state
  const [docSearch, setDocSearch] = useState("");
  const [docResults, setDocResults] = useState([]);
  const [docSearching, setDocSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [ruleError, setRuleError] = useState("");
  const [ruleSaving, setRuleSaving] = useState(false);
  const [sending, setSending] = useState({});
  const searchTimeout = useRef(null);

  // General
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { fetchMatrix(); fetchRules(); fetchAllUsers(); }, []);

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

  const fetchAllUsers = async () => {
    try {
      const { data } = await api.get("/users");
      setAllUsers(data.filter((u) => u.is_active));
    } catch (_) {}
  };

  const handleDocSearch = (val) => {
    setDocSearch(val);
    setSelectedDoc(null);
    clearTimeout(searchTimeout.current);
    if (!val.trim()) { setDocResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setDocSearching(true);
      try {
        const { data } = await api.get(`/documents?search=${encodeURIComponent(val)}&limit=10`);
        setDocResults(data.items || []);
      } catch (_) { setDocResults([]); }
      finally { setDocSearching(false); }
    }, 300);
  };

  const selectDoc = (doc) => {
    setSelectedDoc(doc);
    setDocSearch(`${doc.doc_number} — ${doc.title}`);
    setDocResults([]);
  };

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const openRuleModal = () => {
    setSelectedDoc(null);
    setDocSearch("");
    setDocResults([]);
    setSelectedUserIds([]);
    setUserSearch("");
    setRuleError("");
    setRuleModal(true);
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    setRuleError("");
    if (!selectedDoc) { setRuleError("Please select a document"); return; }
    if (selectedUserIds.length === 0) { setRuleError("Please select at least one user"); return; }
    setRuleSaving(true);
    try {
      await api.post("/training/rules", {
        document_id: selectedDoc.id,
        document_number: selectedDoc.doc_number,
        document_title: selectedDoc.title,
        doc_type: selectedDoc.doc_type,
        assigned_user_ids: selectedUserIds,
      });
      setSuccess("Training assignment created");
      setRuleModal(false);
      fetchRules();
    } catch (err) { setRuleError(formatError(err)); }
    finally { setRuleSaving(false); }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Remove training assignment for "${rule.document_number}"?`)) return;
    try {
      await api.delete(`/training/rules/${rule.id}`);
      setSuccess("Training assignment removed");
      fetchRules();
    } catch (err) { setError(formatError(err)); }
  };

  const handleSendNow = async (rule) => {
    setSending((prev) => ({ ...prev, [rule.id]: true }));
    try {
      const { data } = await api.post(`/training/rules/${rule.id}/send`);
      setSuccess(data.message);
      fetchMatrix();
    } catch (err) { setError(formatError(err)); }
    finally { setSending((prev) => ({ ...prev, [rule.id]: false })); }
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

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const filteredUsers = allUsers.filter((u) =>
    !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.position || "").toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.department || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  const totalPending = matrixUsers.reduce((s, u) => s + u.pending_training, 0);
  const totalCompleted = matrixUsers.reduce((s, u) => s + u.completed_training, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Training Matrix</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Assign training to users and track completion</p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Users", value: matrixUsers.length, color: "text-foreground" },
          { label: "Training Due", value: totalPending, color: "text-amber-600 dark:text-amber-400" },
          { label: "Training Completed", value: totalCompleted, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Active Rules", value: rules.length, color: "text-blue-600 dark:text-blue-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-border rounded-md p-4 bg-card">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{matrixLoading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {[
          { id: "matrix", label: "User Matrix", icon: Users },
          { id: "rules", label: "Add Training", icon: BookOpen },
        ].map(({ id, label, icon: Icon }) => (
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
                <th className="text-center px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Training Due</th>
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
                        {u.email && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{u.email}</span>}
                        {u.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{u.phone}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.pending_training > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Clock className="w-3 h-3" />{u.pending_training}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.completed_training > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <CheckCircle className="w-3 h-3" />{u.completed_training}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {expandedUser === u.id ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                    </td>
                  </tr>

                  {expandedUser === u.id && (
                    <tr>
                      <td colSpan={7} className="bg-muted/20 px-6 py-4 border-b border-border">
                        {recordsLoading[u.id] ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />Loading…
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
                                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Due Date</th>
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
                                    <td className="py-2 pr-4">
                                      {r.due_date ? (
                                        <span className={
                                          r.status === "completed" ? "text-muted-foreground" :
                                          new Date(r.due_date) < new Date() ? "text-red-600 dark:text-red-400 font-medium" :
                                          new Date(r.due_date) < new Date(Date.now() + 7*24*60*60*1000) ? "text-amber-600 dark:text-amber-400 font-medium" :
                                          "text-muted-foreground"
                                        }>{formatDate(r.due_date)}</span>
                                      ) : "—"}
                                    </td>
                                    <td className="py-2 pr-4 text-muted-foreground">{formatDate(r.completed_at)}</td>
                                    <td className="py-2">
                                      {r.status === "completed" ? (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">Training Completed</span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Training Due</span>
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

      {/* ─── ADD TRAINING TAB ─── */}
      {tab === "rules" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Assign specific documents to specific users. When the document is approved, those users automatically receive a training sign-off request.
            </p>
            <button onClick={openRuleModal}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0 ml-4">
              <Plus className="w-4 h-4" /> Add Training
            </button>
          </div>

          <div className="border border-border rounded-md overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Document</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Assigned Users</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden md:table-cell">Created By</th>
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
                      No training assignments yet. Click <strong>Add Training</strong> to assign a document to users.
                    </td>
                  </tr>
                ) : rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-foreground text-xs">{rule.document_number}</span>
                      <p className="text-muted-foreground text-xs mt-0.5">{rule.document_title}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{rule.doc_type}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(rule.assigned_users || []).slice(0, 3).map((u) => (
                          <span key={u.user_id} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{u.user_name}</span>
                        ))}
                        {(rule.assigned_users || []).length > 3 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{rule.assigned_users.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{rule.created_by}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleSendNow(rule)}
                          disabled={sending[rule.id]}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                          title="Send training to assigned users now" aria-label="Send now">
                          {sending[rule.id]
                            ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            : <Send className="w-3 h-3" />}
                          {sending[rule.id] ? "Sending…" : "Send Now"}
                        </button>
                        <button onClick={() => handleDeleteRule(rule)}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                          title="Remove assignment" aria-label="Remove assignment">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Add Training Modal ─── */}
      {ruleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRuleModal(false)} />
          <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-lg z-10 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">Add Training Assignment</h3>
              <button onClick={() => setRuleModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {ruleError && (
              <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
                {ruleError}
              </div>
            )}

            <form onSubmit={handleCreateRule} className="space-y-5">

              {/* Document search */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Search Document <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => handleDocSearch(e.target.value)}
                    placeholder="Search by doc number or keyword…"
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {docSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {/* Search results dropdown */}
                {docResults.length > 0 && !selectedDoc && (
                  <div className="mt-1 border border-border rounded-md bg-card shadow-lg max-h-48 overflow-y-auto">
                    {docResults.map((doc) => (
                      <button key={doc.id} type="button" onClick={() => selectDoc(doc)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-mono text-xs font-semibold text-foreground">{doc.doc_number}</span>
                          <span className="text-xs text-muted-foreground truncate">{doc.title}</span>
                          <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{doc.doc_type}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected doc confirmation */}
                {selectedDoc && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-md">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-semibold">{selectedDoc.doc_number}</span>
                      <span className="text-xs text-muted-foreground ml-2 truncate">{selectedDoc.title}</span>
                    </div>
                    <button type="button" onClick={() => { setSelectedDoc(null); setDocSearch(""); }}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* User picker */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Assign to Users <span className="text-red-500">*</span>
                  {selectedUserIds.length > 0 && (
                    <span className="ml-2 text-primary font-semibold">{selectedUserIds.length} selected</span>
                  )}
                </label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by name, position, department…"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring mb-2"
                />
                <div className="border border-border rounded-md max-h-56 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground text-center">No users found</p>
                  ) : filteredUsers.map((u) => (
                    <label key={u.id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer border-b border-border/50 last:border-0 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={() => toggleUser(u.id)}
                        className="rounded border-input accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-none">{u.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {u.position && <span>{u.position}</span>}
                          {u.position && u.department && <span> · </span>}
                          {u.department && <span>{u.department}</span>}
                          {!u.position && !u.department && <span>{u.email}</span>}
                        </p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLORS[u.role] || "bg-muted text-muted-foreground"}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setRuleModal(false)}
                  className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted">Cancel</button>
                <button type="submit" disabled={ruleSaving}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50">
                  {ruleSaving ? "Saving…" : "Assign Training"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
