import React, { useEffect, useState, useRef } from "react";
import api, { formatError } from "@/utils/api";
import {
  Plus, Trash2, RefreshCw, X, Users, BookOpen, CheckCircle, Clock,
  ChevronDown, ChevronUp, Mail, Phone, Search, FileText, Send, Download, Eye,
  ShieldCheck, AlertTriangle, Edit2,
} from "lucide-react";
import { tokenStore } from "@/utils/api";

const ROLE_LABELS = {
  admin: "Administrator", author: "Author", reviewer: "Reviewer",
  approver: "Approver", readonly: "Read Only",
  training_coordinator: "Training Coordinator",
};
const ROLE_COLORS = {
  admin: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  author: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  reviewer: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approver: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  readonly: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  training_coordinator: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
};

function EHSStatusBadge({ status }) {
  if (status === "overdue") return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium inline-flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" /> Overdue
    </span>
  );
  if (status === "due") return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium inline-flex items-center gap-1">
      <Clock className="w-3 h-3" /> Renewal Due
    </span>
  );
  if (status === "completed") return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
      <CheckCircle className="w-3 h-3" /> Current
    </span>
  );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 font-medium inline-flex items-center">
      Pending
    </span>
  );
}

const EMPTY_EHS = { name: "", user_id: "", completed_date: "", expiry_date: "", notes: "" };

export default function TrainingMatrix() {
  const [tab, setTab] = useState("matrix");

  // Matrix state
  const [matrixUsers, setMatrixUsers] = useState([]);
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState(null);
  const [userRecords, setUserRecords] = useState({});
  const [userEhsRecords, setUserEhsRecords] = useState({});
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

  // Matrix filter + overdue
  const [matrixFilter, setMatrixFilter] = useState(null);
  const [overdueCount, setOverdueCount] = useState(null);

  // Record detail modal
  const [recordDetail, setRecordDetail] = useState(null);

  // EHS state
  const [ehsRecords, setEhsRecords] = useState([]);
  const [ehsLoading, setEhsLoading] = useState(false);
  const [ehsModal, setEhsModal] = useState(false);
  const [ehsForm, setEhsForm] = useState(EMPTY_EHS);
  const [ehsEditId, setEhsEditId] = useState(null);
  const [ehsSaving, setEhsSaving] = useState(false);
  const [ehsError, setEhsError] = useState("");
  const [ehsUserSearch, setEhsUserSearch] = useState("");
  const [ehsFilter, setEhsFilter] = useState("all"); // "all" | "overdue" | "due" | "completed" | "pending"
  const [ehsCertFile, setEhsCertFile] = useState(null);   // File object selected for upload
  const [ehsCertUploading, setEhsCertUploading] = useState(false);

  // General
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { fetchMatrix(); fetchRules(); fetchAllUsers(); fetchOverdueStats(); fetchEhs(); }, []);

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

  const fetchOverdueStats = async () => {
    try {
      const { data } = await api.get("/training/stats");
      setOverdueCount(data.overdue ?? 0);
    } catch (_) {}
  };

  const fetchEhs = async () => {
    setEhsLoading(true);
    try {
      const { data } = await api.get("/training/ehs");
      setEhsRecords(data);
    } catch (_) {}
    finally { setEhsLoading(false); }
  };

  const openEhsCert = async (record, forDownload = false) => {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
      (!window.location.hostname.includes("localhost") ? "https://api.lapisims.com" : "http://localhost:8001");
    const token = tokenStore.getAccess();
    try {
      const url = `${BACKEND_URL}/api/training/ehs/${record.id}/cert${forDownload ? "?download=true" : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setError("Certificate not found"); return; }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (forDownload) {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = record.cert_file_name || "certificate";
        a.click();
      } else {
        window.open(objectUrl, "_blank");
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch (e) {
      setError("Could not load certificate");
    }
  };

  const uploadEhsCert = async (recordId) => {
    if (!ehsCertFile) return;
    setEhsCertUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", ehsCertFile);
      await api.post(`/training/ehs/${recordId}/cert`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (e) {
      setError("Record saved but certificate upload failed: " + (e?.response?.data?.detail || e.message));
    } finally {
      setEhsCertUploading(false);
    }
  };

  const handleDocSearch = (val) => {
    setDocSearch(val);
    setSelectedDoc(null);
    clearTimeout(searchTimeout.current);
    if (!val.trim()) { setDocResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setDocSearching(true);
      try {
        const { data } = await api.get(`/documents?search=${encodeURIComponent(val)}&limit=20`);
        setDocResults((data.items || []).filter((d) => d.status !== "obsolete"));
      } catch (_) { setDocResults([]); }
      finally { setDocSearching(false); }
    }, 300);
  };

  const selectDoc = (doc) => {
    setSelectedDoc(doc);
    setDocSearch(`${doc.doc_number} Rev ${doc.rev_number ?? 0} — ${doc.title}`);
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
        document_rev: selectedDoc.rev_number ?? 0,
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
        const [recRes] = await Promise.all([
          api.get(`/training/records?user_id=${userId}`),
        ]);
        setUserRecords((prev) => ({ ...prev, [userId]: recRes.data }));
        // Filter EHS records for this user from existing data
        const uEhs = ehsRecords.filter(r => r.user_id === userId);
        setUserEhsRecords((prev) => ({ ...prev, [userId]: uEhs }));
      } catch (_) {}
      finally { setRecordsLoading((prev) => ({ ...prev, [userId]: false })); }
    } else {
      // Still refresh EHS from current state
      const uEhs = ehsRecords.filter(r => r.user_id === userId);
      setUserEhsRecords((prev) => ({ ...prev, [userId]: uEhs }));
    }
  };

  // EHS CRUD
  const openEhsCreate = () => {
    setEhsForm(EMPTY_EHS);
    setEhsEditId(null);
    setEhsError("");
    setEhsUserSearch("");
    setEhsCertFile(null);
    setEhsModal(true);
  };

  const openEhsEdit = (record) => {
    setEhsForm({
      name: record.name || "",
      user_id: record.user_id || "",
      completed_date: record.completed_date || "",
      expiry_date: record.expiry_date || "",
      notes: record.notes || "",
      _existingCert: record.cert_file_name || null,
    });
    setEhsEditId(record.id);
    setEhsError("");
    setEhsUserSearch("");
    setEhsCertFile(null);
    setEhsModal(true);
  };

  const handleEhsSubmit = async (e) => {
    e.preventDefault();
    setEhsError("");
    if (!ehsForm.name.trim()) { setEhsError("Training name is required"); return; }
    if (!ehsForm.user_id) { setEhsError("Please select a user"); return; }
    if (!ehsForm.expiry_date) { setEhsError("Expiry date is required"); return; }
    setEhsSaving(true);
    try {
      const body = { ...ehsForm };
      delete body._existingCert;
      if (!body.completed_date) delete body.completed_date;
      if (!body.notes) delete body.notes;
      let savedId = ehsEditId;
      if (ehsEditId) {
        await api.put(`/training/ehs/${ehsEditId}`, body);
        setSuccess("EHS record updated");
      } else {
        const { data } = await api.post("/training/ehs", body);
        savedId = data.id;
        setSuccess("EHS record created");
      }
      if (ehsCertFile && savedId) {
        await uploadEhsCert(savedId);
        setSuccess(prev => prev + " · Certificate uploaded");
      }
      setEhsModal(false);
      fetchEhs();
    } catch (err) { setEhsError(formatError(err)); }
    finally { setEhsSaving(false); }
  };

  const handleEhsDelete = async (record) => {
    if (!window.confirm(`Delete EHS record "${record.name}" for ${record.user_name}?`)) return;
    try {
      await api.delete(`/training/ehs/${record.id}`);
      setSuccess("EHS record deleted");
      fetchEhs();
    } catch (err) { setError(formatError(err)); }
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const downloadCertificate = async (record) => {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
      (!window.location.hostname.includes("localhost") ? "https://api.lapisims.com" : "http://localhost:8001");
    const token = tokenStore.getAccess();
    const res = await fetch(`${BACKEND_URL}/api/training/records/${record.id}/certificate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setError("Could not generate certificate"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-certificate-${record.document_number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredUsers = allUsers.filter((u) =>
    !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.position || "").toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.department || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  const ehsModalUsers = allUsers.filter((u) =>
    !ehsUserSearch || u.name.toLowerCase().includes(ehsUserSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(ehsUserSearch.toLowerCase())
  );

  const totalPending = matrixUsers.reduce((s, u) => s + u.pending_training, 0);
  const totalCompleted = matrixUsers.reduce((s, u) => s + u.completed_training, 0);

  const filteredMatrixUsers = matrixFilter === "pending"
    ? matrixUsers.filter((u) => u.pending_training > 0)
    : matrixFilter === "completed"
    ? matrixUsers.filter((u) => u.completed_training > 0)
    : matrixFilter === "overdue"
    ? matrixUsers.filter((u) => (u.overdue_training ?? 0) > 0)
    : matrixUsers;

  const toggleMatrixFilter = (f) => setMatrixFilter((prev) => prev === f ? null : f);

  const filteredEhsRecords = ehsFilter === "all"
    ? ehsRecords
    : ehsRecords.filter(r => r.status === ehsFilter);

  const ehsOverdue = ehsRecords.filter(r => r.status === "overdue").length;
  const ehsDue = ehsRecords.filter(r => r.status === "due").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Training Matrix</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Assign training to users and track completion</p>
        </div>
        <button onClick={() => { fetchMatrix(); fetchRules(); fetchEhs(); }}
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
          { label: "Training Overdue", value: overdueCount ?? "—", color: "text-red-600 dark:text-red-400" },
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
          { id: "ehs", label: "EHS & Certifications", icon: ShieldCheck },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-4 h-4" />{label}
            {id === "ehs" && (ehsOverdue > 0 || ehsDue > 0) && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white font-semibold leading-none">
                {ehsOverdue + ehsDue}
              </span>
            )}
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
                <th className="text-center px-4 py-2.5">
                  <button onClick={() => toggleMatrixFilter("pending")}
                    className={`text-xs font-mono tracking-widest uppercase transition-colors px-2 py-0.5 rounded ${
                      matrixFilter === "pending"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                        : "text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
                    }`}>Training Due</button>
                </th>
                <th className="text-center px-4 py-2.5">
                  <button onClick={() => toggleMatrixFilter("completed")}
                    className={`text-xs font-mono tracking-widest uppercase transition-colors px-2 py-0.5 rounded ${
                      matrixFilter === "completed"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                    }`}>Completed</button>
                </th>
                <th className="text-center px-4 py-2.5">
                  <button onClick={() => toggleMatrixFilter("overdue")}
                    className={`text-xs font-mono tracking-widest uppercase transition-colors px-2 py-0.5 rounded ${
                      matrixFilter === "overdue"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                        : "text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                    }`}>Overdue</button>
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {matrixLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredMatrixUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    {matrixFilter ? `No users with ${matrixFilter === "pending" ? "training due" : matrixFilter === "completed" ? "completed training" : "overdue training"}.` : "No users found"}
                  </td>
                </tr>
              ) : filteredMatrixUsers.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => toggleExpandUser(u.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.name}</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || "bg-muted text-muted-foreground"}`}>
                        {ROLE_LABELS[u.role] || u.role}
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
                    <td className="px-4 py-3 text-center">
                      {(u.overdue_training ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <Clock className="w-3 h-3" />{u.overdue_training}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {expandedUser === u.id ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                    </td>
                  </tr>

                  {expandedUser === u.id && (
                    <tr>
                      <td colSpan={8} className="bg-muted/20 px-6 py-4 border-b border-border">
                        {recordsLoading[u.id] ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />Loading…
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Document training records */}
                            {(!userRecords[u.id] || userRecords[u.id].length === 0) ? (
                              <p className="text-sm text-muted-foreground">No document training records for this user.</p>
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
                                          <span className="text-xs font-mono text-muted-foreground ml-1">Rev {r.document_rev ?? 0}</span>
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
                                          <div className="flex items-center gap-1.5">
                                            {r.status === "completed" ? (
                                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">Completed</span>
                                            ) : new Date(r.due_date) < new Date() ? (
                                              <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">Overdue</span>
                                            ) : (
                                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Due</span>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); setRecordDetail(r); }}
                                              className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                                              title="View details"><Eye className="w-3.5 h-3.5" /></button>
                                            {r.status === "completed" && (
                                              <button onClick={(e) => { e.stopPropagation(); downloadCertificate(r); }}
                                                className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                                                title="Download certificate"><Download className="w-3.5 h-3.5" /></button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* EHS records for this user */}
                            {userEhsRecords[u.id] && userEhsRecords[u.id].length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                  <ShieldCheck className="w-3.5 h-3.5" /> EHS &amp; Certifications
                                </p>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Name</th>
                                        <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Completed</th>
                                        <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Expires</th>
                                        <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                      {userEhsRecords[u.id].map((r) => (
                                        <tr key={r.id}>
                                          <td className="py-2 pr-4 font-medium text-foreground">{r.name}</td>
                                          <td className="py-2 pr-4 text-muted-foreground">{formatDate(r.completed_date)}</td>
                                          <td className="py-2 pr-4 text-muted-foreground">{formatDate(r.expiry_date)}</td>
                                          <td className="py-2"><EHSStatusBadge status={r.status} /></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
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
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-foreground text-xs">{rule.document_number}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">Rev {rule.document_rev ?? 0}</span>
                      </div>
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
                        <button onClick={() => handleSendNow(rule)} disabled={sending[rule.id]}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                          {sending[rule.id]
                            ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            : <Send className="w-3 h-3" />}
                          {sending[rule.id] ? "Sending…" : "Send Now"}
                        </button>
                        <button onClick={() => handleDeleteRule(rule)}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors">
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

      {/* ─── EHS TAB ─── */}
      {tab === "ehs" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Manage standalone EHS training records, certifications, and compliance items with expiry tracking.
            </p>
            <button onClick={openEhsCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0 ml-4">
              <Plus className="w-4 h-4" /> Add EHS Record
            </button>
          </div>

          {/* EHS status filter chips */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {[
              { id: "all", label: "All" },
              { id: "overdue", label: "Overdue", cls: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
              { id: "due", label: "Renewal Due", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
              { id: "completed", label: "Current", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
              { id: "pending", label: "Pending", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
            ].map(({ id, label, cls }) => (
              <button key={id} onClick={() => setEhsFilter(id)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors border
                  ${ehsFilter === id
                    ? (cls || "bg-primary text-primary-foreground border-primary")
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-background"}`}>
                {label}
                <span className="ml-1.5 text-xs opacity-70">
                  {id === "all" ? ehsRecords.length : ehsRecords.filter(r => r.status === id).length}
                </span>
              </button>
            ))}
          </div>

          <div className="border border-border rounded-md overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Training / Certification</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">User</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden sm:table-cell">Completed</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Expires</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ehsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredEhsRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      {ehsFilter === "all"
                        ? "No EHS records yet. Click Add EHS Record to create one."
                        : `No ${ehsFilter} records.`}
                    </td>
                  </tr>
                ) : filteredEhsRecords.map((record) => (
                  <tr key={record.id}
                    className={`hover:bg-muted/30 transition-colors
                      ${record.status === "overdue" ? "bg-red-50/30 dark:bg-red-900/10" :
                        record.status === "due" ? "bg-amber-50/30 dark:bg-amber-900/10" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{record.name}</p>
                      {record.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{record.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-foreground">{record.user_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(record.completed_date)}</td>
                    <td className="px-4 py-3">
                      <span className={
                        record.status === "overdue" ? "text-red-600 dark:text-red-400 font-medium" :
                        record.status === "due" ? "text-amber-600 dark:text-amber-400 font-medium" :
                        "text-muted-foreground"
                      }>{formatDate(record.expiry_date)}</span>
                    </td>
                    <td className="px-4 py-3"><EHSStatusBadge status={record.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {record.has_cert && <>
                          <button onClick={() => openEhsCert(record, false)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                            title="View certificate">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEhsCert(record, true)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                            title="Download certificate">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </>}
                        <button onClick={() => openEhsEdit(record)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                          title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleEhsDelete(record)}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                          title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Record Detail Modal ─── */}
      {recordDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRecordDetail(null)} />
          <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-md z-10 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">Training Record</h3>
              <button onClick={() => setRecordDetail(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 flex-shrink-0">Document</span>
                <span className="font-mono font-semibold text-foreground">{recordDetail.document_number}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">Rev {recordDetail.document_rev ?? 0}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 flex-shrink-0">Title</span>
                <span className="text-foreground">{recordDetail.document_title}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 flex-shrink-0">User</span>
                <span className="text-foreground">{recordDetail.user_name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 flex-shrink-0">Status</span>
                {recordDetail.status === "completed" ? (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">Completed</span>
                ) : new Date(recordDetail.due_date) < new Date() ? (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">Overdue</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Pending</span>
                )}
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 flex-shrink-0">Assigned</span>
                <span className="text-foreground">{formatDate(recordDetail.assigned_at)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 flex-shrink-0">Due Date</span>
                <span className={
                  recordDetail.status === "completed" ? "text-muted-foreground" :
                  new Date(recordDetail.due_date) < new Date() ? "text-red-600 dark:text-red-400 font-medium" :
                  "text-foreground"
                }>{formatDate(recordDetail.due_date)}</span>
              </div>
              {recordDetail.status === "completed" && (
                <>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28 flex-shrink-0">Completed</span>
                    <span className="text-foreground">{formatDate(recordDetail.completed_at)}</span>
                  </div>
                  {recordDetail.signature && (
                    <>
                      <div className="border-t border-border pt-3 mt-3">
                        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Electronic Signature</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-28 flex-shrink-0">Signed by</span>
                            <span className="text-foreground">{recordDetail.signature.user_name}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-28 flex-shrink-0">Timestamp</span>
                            <span className="text-foreground">{formatDate(recordDetail.signature.timestamp)}</span>
                          </div>
                          {recordDetail.signature.comments && (
                            <div className="flex gap-2">
                              <span className="text-muted-foreground w-28 flex-shrink-0">Comments</span>
                              <span className="text-foreground">{recordDetail.signature.comments}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => { downloadCertificate(recordDetail); setRecordDetail(null); }}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                        <Download className="w-4 h-4" /> Download Certificate
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
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
              <button onClick={() => setRuleModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {ruleError && (
              <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">{ruleError}</div>
            )}
            <form onSubmit={handleCreateRule} className="space-y-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Search Document <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input type="text" value={docSearch} onChange={(e) => handleDocSearch(e.target.value)}
                    placeholder="Search by doc number or keyword…"
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                  {docSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                {docResults.length > 0 && !selectedDoc && (
                  <div className="mt-1 border border-border rounded-md bg-card shadow-lg max-h-48 overflow-y-auto">
                    {docResults.map((doc) => (
                      <button key={doc.id} type="button" onClick={() => selectDoc(doc)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-mono text-xs font-semibold text-foreground">{doc.doc_number}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono flex-shrink-0">Rev {doc.rev_number ?? 0}</span>
                          <span className="text-xs text-muted-foreground truncate">{doc.title}</span>
                          <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{doc.doc_type}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedDoc && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-md">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-semibold">{selectedDoc.doc_number}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono ml-1.5">Rev {selectedDoc.rev_number ?? 0}</span>
                      <span className="text-xs text-muted-foreground ml-2 truncate">{selectedDoc.title}</span>
                    </div>
                    <button type="button" onClick={() => { setSelectedDoc(null); setDocSearch(""); }}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Assign to Users <span className="text-red-500">*</span>
                  {selectedUserIds.length > 0 && <span className="ml-2 text-primary font-semibold">{selectedUserIds.length} selected</span>}
                </label>
                <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by name, position, department…"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring mb-2" />
                <div className="border border-border rounded-md max-h-56 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground text-center">No users found</p>
                  ) : filteredUsers.map((u) => (
                    <label key={u.id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer border-b border-border/50 last:border-0 transition-colors">
                      <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleUser(u.id)}
                        className="rounded border-input accent-primary" />
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
                        {ROLE_LABELS[u.role] || u.role}
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

      {/* ─── EHS Add / Edit Modal ─── */}
      {ehsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEhsModal(false)} />
          <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-lg z-10 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">{ehsEditId ? "Edit EHS Record" : "Add EHS Record"}</h3>
              <button onClick={() => setEhsModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {ehsError && (
              <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">{ehsError}</div>
            )}
            <form onSubmit={handleEhsSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Training / Certification Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={ehsForm.name}
                  onChange={(e) => setEhsForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Manual Handling, First Aid, COSHH Awareness…"
                  autoFocus
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Assign to User <span className="text-red-500">*</span>
                </label>
                <input type="text" value={ehsUserSearch}
                  onChange={(e) => setEhsUserSearch(e.target.value)}
                  placeholder="Search users…"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring mb-2" />
                <div className="border border-border rounded-md max-h-44 overflow-y-auto">
                  {ehsModalUsers.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground text-center">No users found</p>
                  ) : ehsModalUsers.map((u) => (
                    <label key={u.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-border/50 last:border-0 transition-colors
                        ${ehsForm.user_id === u.id ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                      <input type="radio" name="ehs_user" value={u.id}
                        checked={ehsForm.user_id === u.id}
                        onChange={() => setEhsForm(f => ({ ...f, user_id: u.id }))}
                        className="accent-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-none">{u.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Completed Date <span className="font-normal text-muted-foreground/70">(optional)</span>
                  </label>
                  <input type="date" value={ehsForm.completed_date}
                    onChange={(e) => setEhsForm(f => ({ ...f, completed_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Expiry Date <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={ehsForm.expiry_date}
                    onChange={(e) => setEhsForm(f => ({ ...f, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Notes <span className="font-normal text-muted-foreground/70">(optional)</span>
                </label>
                <textarea value={ehsForm.notes}
                  onChange={(e) => setEhsForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Any additional notes…"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
              </div>

              {/* Certificate upload */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Certificate <span className="font-normal text-muted-foreground/70">(optional — PDF or image, max 20 MB)</span>
                </label>
                {ehsForm._existingCert && !ehsCertFile && (
                  <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md text-xs text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1 truncate">Current: {ehsForm._existingCert}</span>
                    <span className="text-muted-foreground">Select a new file to replace</span>
                  </div>
                )}
                <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-input bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors text-sm text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 truncate">
                    {ehsCertFile ? ehsCertFile.name : "Click to select certificate…"}
                  </span>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
                    onChange={(e) => setEhsCertFile(e.target.files?.[0] || null)} />
                </label>
                {ehsCertFile && (
                  <button type="button" onClick={() => setEhsCertFile(null)}
                    className="mt-1 text-xs text-muted-foreground hover:text-foreground underline">
                    Remove selected file
                  </button>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setEhsModal(false)}
                  className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted">Cancel</button>
                <button type="submit" disabled={ehsSaving || ehsCertUploading}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50">
                  <ShieldCheck className="w-4 h-4" />
                  {ehsCertUploading ? "Uploading cert…" : ehsSaving ? "Saving…" : (ehsEditId ? "Update Record" : "Create Record")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
