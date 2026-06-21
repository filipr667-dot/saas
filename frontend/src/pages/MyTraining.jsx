import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatError } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, Clock, FileText, X, Eye, Download, ExternalLink, AlertTriangle, FolderOpen } from "lucide-react";
import { tokenStore } from "@/utils/api";

// Doc types that don't require training sign-off — live in My Documents tab
const NO_SIGNOFF_TYPES = ["Form", "Register"];

const STATUS_TABS = [
  { id: "pending", label: "Training Due" },
  { id: "completed", label: "Training Completed" },
  { id: "my_documents", label: "My Documents" },
];

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function EHSStatusBadge({ record }) {
  const s = record.status;
  if (s === "overdue") return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" /> Overdue
    </span>
  );
  if (s === "due") return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium flex items-center gap-1">
      <Clock className="w-3 h-3" /> Renewal Due
    </span>
  );
  if (s === "completed") return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium flex items-center gap-1">
      <CheckCircle className="w-3 h-3" /> Current
    </span>
  );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 font-medium">
      Pending
    </span>
  );
}

export default function MyTraining() {
  const { user } = useAuth();
  const [tab, setTab] = useState("pending");
  const [records, setRecords] = useState([]);
  const [ehsRecords, setEhsRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [signModal, setSignModal] = useState(null);
  const [password, setPassword] = useState("");
  const [comments, setComments] = useState("");
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState("");

  const [detailRecord, setDetailRecord] = useState(null);
  const [myDocs, setMyDocs] = useState([]);

  useEffect(() => { fetchAll(); }, [tab]);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "my_documents") {
        const [formsRes, regsRes] = await Promise.all([
          api.get("/documents?doc_type=Form&limit=100"),
          api.get("/documents?doc_type=Register&limit=100"),
        ]);
        const forms = formsRes.data.items || [];
        const regs = regsRes.data.items || [];
        const combined = [...forms, ...regs].filter(d =>
          ["active", "review_due", "review_overdue"].includes(d.status)
        );
        combined.sort((a, b) => a.doc_number?.localeCompare(b.doc_number) || 0);
        setMyDocs(combined);
      } else {
        const [recRes, ehsRes] = await Promise.all([
          api.get(`/training/records?status=${tab}`),
          api.get("/training/ehs"),
        ]);
        // Exclude Forms and Registers — those live in My Documents tab
        setRecords(recRes.data.filter(r => !NO_SIGNOFF_TYPES.includes(r.doc_type)));

        const ehs = ehsRes.data;
        if (tab === "pending") {
          setEhsRecords(ehs.filter(r => r.status === "pending" || r.status === "due" || r.status === "overdue"));
        } else {
          setEhsRecords(ehs.filter(r => r.status === "completed"));
        }
      }
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  const openSignModal = (record) => {
    setSignModal(record);
    setPassword("");
    setComments("");
    setSignError("");
  };

  const handleSignOff = async (e) => {
    e.preventDefault();
    setSignError("");
    setSigning(true);
    try {
      await api.post(`/training/records/${signModal.id}/signoff`, { password, comments });
      setSuccess(`Training sign-off completed for ${signModal.document_number}`);
      setSignModal(null);
      fetchAll();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setSignError(formatError(err));
    } finally {
      setSigning(false);
    }
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

  const totalDue = records.length + ehsRecords.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">My Training</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Documents and certifications requiring your attention
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">{success}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {STATUS_TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {id === "pending" ? <Clock className="w-4 h-4" /> : id === "completed" ? <CheckCircle className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-border rounded-md p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-48 mb-2" />
              <div className="h-3 bg-muted rounded w-72" />
            </div>
          ))}
        </div>
      ) : tab === "my_documents" ? (
        myDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-1">No forms or registers</h3>
            <p className="text-sm text-muted-foreground">Published forms and registers will appear here for reference.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">Forms and registers don't require sign-off — use them for reference.</p>
            {myDocs.map((doc) => (
              <div key={doc.id} className="border border-border rounded-md p-4 bg-card flex items-center justify-between gap-4 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-mono text-sm font-semibold text-foreground">{doc.doc_number}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{doc.doc_type}</span>
                      {doc.status === "review_due" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Review Due</span>
                      )}
                      {doc.status === "review_overdue" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">Review Overdue</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground truncate">{doc.title}</p>
                  </div>
                </div>
                <Link
                  to={`/documents/${doc.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-input bg-background hover:bg-muted text-muted-foreground transition-colors text-xs font-medium flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View
                </Link>
              </div>
            ))}
          </div>
        )
      ) : records.length === 0 && ehsRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {tab === "pending" ? (
            <>
              <CheckCircle className="w-12 h-12 text-emerald-500 mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground">You have no pending training sign-offs.</p>
            </>
          ) : (
            <>
              <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-1">No completed training</h3>
              <p className="text-sm text-muted-foreground">Completed sign-offs will appear here.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* ── Document training records ── */}
          {records.map((record) => (
            <div key={record.id}
              className={`border rounded-md p-4 bg-card transition-colors
                ${record.status === "pending"
                  ? "border-amber-200 dark:border-amber-800/60 hover:border-amber-400 dark:hover:border-amber-600"
                  : "border-border hover:border-emerald-400 dark:hover:border-emerald-600"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-sm font-semibold text-foreground">{record.document_number}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{record.doc_type}</span>
                    {record.status === "pending" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Training Due
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Training Completed
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground font-medium mb-1 truncate">{record.document_title}</p>
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <span className="text-muted-foreground">Rev {record.document_rev}</span>
                    <span className="text-muted-foreground">Assigned {formatDate(record.assigned_at)}</span>
                    {record.status === "pending" && record.due_date && (() => {
                      const due = new Date(record.due_date);
                      const now = new Date();
                      const overdue = due < now;
                      const soonDue = due < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                      return (
                        <span className={`font-medium ${overdue ? "text-red-600 dark:text-red-400" : soonDue ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                          {overdue ? "Overdue — " : "Due "}{formatDate(record.due_date)}
                        </span>
                      );
                    })()}
                    {record.status === "completed" && record.completed_at && (
                      <span className="text-muted-foreground">Signed off {formatDate(record.completed_at)}</span>
                    )}
                  </div>
                  {record.status === "completed" && record.signature?.comments && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{record.signature.comments}"</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* View Document button */}
                  {record.document_id && (
                    <Link
                      to={`/documents/${record.document_id}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-input bg-background hover:bg-muted text-muted-foreground transition-colors text-xs font-medium"
                      title="View document">
                      <ExternalLink className="w-3.5 h-3.5" /> View Doc
                    </Link>
                  )}
                  {record.status === "completed" && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setDetailRecord(record)}
                        className="p-2 rounded-md border border-input bg-background hover:bg-muted text-muted-foreground transition-colors"
                        title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => downloadCertificate(record)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-input bg-background hover:bg-muted text-muted-foreground transition-colors text-xs font-medium">
                        <Download className="w-4 h-4" /> Certificate
                      </button>
                    </div>
                  )}
                  {record.status === "pending" && (
                    <button onClick={() => openSignModal(record)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                      <CheckCircle className="w-4 h-4" /> Sign Off
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* ── EHS / standalone training records ── */}
          {ehsRecords.length > 0 && (
            <>
              {records.length > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">EHS & Certifications</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              {ehsRecords.map((record) => (
                <div key={record.id}
                  className={`border rounded-md p-4 bg-card transition-colors
                    ${record.status === "overdue" ? "border-red-200 dark:border-red-800/60" :
                      record.status === "due" ? "border-amber-200 dark:border-amber-800/60" :
                      "border-border"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm text-foreground">{record.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">EHS</span>
                        <EHSStatusBadge record={record} />
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-wrap">
                        {record.completed_date && (
                          <span className="text-muted-foreground">Completed: {formatDateShort(record.completed_date)}</span>
                        )}
                        {record.expiry_date && (
                          <span className={
                            record.status === "overdue" ? "text-red-600 dark:text-red-400 font-medium" :
                            record.status === "due" ? "text-amber-600 dark:text-amber-400 font-medium" :
                            "text-muted-foreground"
                          }>Expires: {formatDateShort(record.expiry_date)}</span>
                        )}
                        {record.assigned_by && (
                          <span className="text-muted-foreground">Assigned by {record.assigned_by}</span>
                        )}
                      </div>
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{record.notes}"</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ─── Sign-Off Modal ─── */}
      {signModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSignModal(null)} />
          <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-md z-10 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Electronic Sign-Off</h3>
              <button onClick={() => setSignModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="bg-muted/40 rounded-md p-3 mb-4 text-sm space-y-1">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 flex-shrink-0">Document</span>
                <span className="font-mono font-semibold">{signModal.document_number}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 flex-shrink-0">Title</span>
                <span className="font-medium">{signModal.document_title}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 flex-shrink-0">Type</span>
                <span>{signModal.doc_type}</span>
              </div>
            </div>

            {signModal.document_id && (
              <div className="mb-4">
                <Link to={`/documents/${signModal.document_id}`}
                  onClick={() => setSignModal(null)}
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open document to read before signing off
                </Link>
              </div>
            )}

            <p className="text-xs text-muted-foreground mb-4">
              By signing off, you confirm you have read, understood, and will comply with this document.
              Your password is required as an electronic signature.
            </p>

            {signError && (
              <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">{signError}</div>
            )}

            <form onSubmit={handleSignOff} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Your Password *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus
                  placeholder="Enter your password to sign"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Comments <span className="font-normal text-muted-foreground/70">(optional)</span></label>
                <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2}
                  placeholder="Any notes or comments…"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setSignModal(null)}
                  className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted">Cancel</button>
                <button type="submit" disabled={signing || !password}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" />
                  {signing ? "Signing…" : "Confirm Sign-Off"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ─── */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailRecord(null)} />
          <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-md z-10 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">Sign-Off Record</h3>
              <button onClick={() => setDetailRecord(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ["Document", <span className="font-mono font-semibold">{detailRecord.document_number}</span>],
                ["Title", detailRecord.document_title],
                ["Type", detailRecord.doc_type],
                ["Revision", `Rev ${detailRecord.document_rev}`],
                ["Assigned", formatDate(detailRecord.assigned_at)],
                ["Signed off", formatDate(detailRecord.completed_at)],
                ["Signed by", detailRecord.signature?.user_name],
                ["IP Address", detailRecord.signature?.ip_address],
              ].map(([label, value]) => value && (
                <div key={label} className="flex gap-3">
                  <span className="text-muted-foreground w-28 flex-shrink-0">{label}</span>
                  <span className="text-foreground">{value}</span>
                </div>
              ))}
              {detailRecord.signature?.comments && (
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-28 flex-shrink-0">Comments</span>
                  <span className="text-foreground italic">"{detailRecord.signature.comments}"</span>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setDetailRecord(null)}
                className="px-4 py-2 text-sm rounded-md border border-input hover:bg-muted">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
