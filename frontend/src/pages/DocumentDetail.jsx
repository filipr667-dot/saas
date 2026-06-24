import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api, { formatError } from "@/utils/api";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Download, Upload, Send, CheckCircle, XCircle, RotateCcw,
  ChevronLeft, FileText, User, Calendar, Clock, AlertCircle,
  History, Lock, Eye, Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function formatDate(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function formatDateOnly(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

function MetaRow({ label, value }) {
  return (
    <div className="flex py-2.5 border-b border-border last:border-0">
      <dt className="text-xs text-muted-foreground w-44 flex-shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-foreground flex-1">{value || "—"}</dd>
    </div>
  );
}

function SignatureModal({ title, doc, onSubmit, onClose }) {
  const [action, setAction] = useState("approve");
  const [comments, setComments] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return setError("Password is required for electronic signature");
    setLoading(true);
    setError("");
    try {
      await onSubmit({ action, comments, password });
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div data-testid="signature-modal" className="relative bg-card border border-border rounded-md p-6 w-full max-w-md shadow-xl z-10">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        {doc && (
          <div className="mb-4 px-3 py-2.5 rounded-md bg-muted/50 border border-border text-xs space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-foreground font-medium">{doc.doc_number}</span>
              <span className="text-muted-foreground">Rev {doc.rev_number}</span>
            </div>
            <div className="text-muted-foreground truncate">{doc.title}</div>
          </div>
        )}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Decision</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="approve" checked={action === "approve"}
                  onChange={() => setAction("approve")}
                  data-testid="action-approve" />
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Approve</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="reject" checked={action === "reject"}
                  onChange={() => setAction("reject")}
                  data-testid="action-reject" />
                <span className="text-sm text-red-600 dark:text-red-400 font-medium">Reject</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Comments {action === "reject" && <span className="text-red-500">*</span>}
            </label>
            <textarea
              data-testid="signature-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Add comments..."
              required={action === "reject"}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Electronic Signature (Re-enter password)
            </label>
            <input
              type="password"
              data-testid="signature-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              By submitting, I confirm this action is attributable to my user account and represents my electronic signature record.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              data-testid="signature-submit"
              disabled={loading}
              className={`px-4 py-2 text-sm rounded-md font-medium disabled:opacity-50 transition-opacity text-white
                ${action === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              {loading ? "Submitting..." : action === "approve" ? "Approve" : "Reject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [history, setHistory] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [tab, setTab] = useState("details");
  const [modal, setModal] = useState(null);
  const [confirmPending, setConfirmPending] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reviewers, setReviewers] = useState([]);
  const [selectedReviewers, setSelectedReviewers] = useState([]);
  const [selectedApprover, setSelectedApprover] = useState("");
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  const fetchDoc = async () => {
    try {
      const { data } = await api.get(`/documents/${id}`);
      setDoc(data);
      setSelectedApprover(data.approver_id || "");
      setSelectedReviewers(data.reviewer_ids || []);
    } catch (e) {
      setError(formatError(e));
    }
  };

  useEffect(() => {
    fetchDoc();
    api.get(`/documents/${id}/history`).then((r) => setHistory(r.data)).catch(() => {});
    api.get(`/documents/${id}/signatures`).then((r) => setSignatures(r.data)).catch(() => {});
    api.get("/users/reviewers-approvers").then((r) => setReviewers(r.data)).catch(() => {});
  }, [id]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(`/documents/${id}/upload`, form);
      setSuccess("File uploaded successfully");
      fetchDoc();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setFileUploading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedReviewers.length) return setError("Select at least one reviewer");
    if (!selectedApprover) return setError("Select an approver");
    setError("");
    try {
      await api.post(`/documents/${id}/submit`, {
        reviewer_ids: selectedReviewers,
        approver_id: selectedApprover,
      });
      setSuccess("Document submitted for review");
      setShowSubmitForm(false);
      fetchDoc();
    } catch (err) {
      setError(formatError(err));
    }
  };

  const handleReview = async ({ action, comments, password }) => {
    await api.post(`/documents/${id}/review`, { action, comments, password });
    setSuccess(`Review ${action}d successfully`);
    fetchDoc();
    api.get(`/documents/${id}/signatures`).then((r) => setSignatures(r.data)).catch(() => {});
  };

  const handleApprove = async ({ action, comments, password }) => {
    await api.post(`/documents/${id}/approve`, { action, comments, password });
    setSuccess(`Document ${action === "approve" ? "approved and activated" : "rejected"}`);
    fetchDoc();
    api.get(`/documents/${id}/signatures`).then((r) => setSignatures(r.data)).catch(() => {});
  };

  const handleRevise = async () => {
    try {
      const { data } = await api.post(`/documents/${id}/revise`);
      navigate(`/documents/${data.id}`);
    } catch (err) {
      setError(formatError(err));
    }
  };

  const handleDelete = () => {
    setConfirmPending({
      title: "Delete Draft",
      message: `Permanently delete "${doc.doc_number} — ${doc.title}"? This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmPending(null);
        try {
          await api.delete(`/documents/${id}`);
          navigate("/documents");
        } catch (err) {
          setError(formatError(err));
        }
      },
    });
  };

  const handleDownload = async () => {
    try {
      const resp = await api.get(`/documents/${id}/file`, { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || "document";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(formatError(err));
    }
  };

  if (!doc) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  const role = user?.role;
  const uid = user?.id;
  const docRoles = user?.doc_roles || [];
  const isDocController = docRoles.includes("document_controller");
  const isAuthor = doc.author_id === uid || role === "admin" || isDocController;
  const isReviewer = doc.reviewer_ids?.includes(uid);
  const isApprover = doc.approver_id === uid || role === "admin" || isDocController;
  const myReviewAction = doc.review_actions?.find((ra) => ra.reviewer_id === uid);
  const canEdit = ["draft", "rejected"].includes(doc.status) && isAuthor;
  const canUpload = ["draft", "rejected"].includes(doc.status) && isAuthor;
  const canSubmit = ["draft", "rejected"].includes(doc.status) && isAuthor && doc.file_path;
  const canDelete = ["draft", "rejected"].includes(doc.status) && (doc.author_id === uid || role === "admin" || isDocController);
  const canReview = doc.status === "under_review" && isReviewer && myReviewAction?.status === "pending";
  const canApprove = doc.status === "pending_approval" && isApprover;
  const canRevise = ["active", "review_due", "review_overdue"].includes(doc.status) && (role === "admin" || isDocController || docRoles.includes("author"));

  const tabs = [
    { key: "details", label: "Details" },
    { key: "workflow", label: "Workflow" },
    { key: "history", label: "Revision History" },
    { key: "signatures", label: "Signatures" },
  ];

  return (
    <div>
      {modal === "review" && (
        <SignatureModal title="Review Decision" doc={doc} onSubmit={handleReview} onClose={() => setModal(null)} />
      )}
      {modal === "approve" && (
        <SignatureModal title="Approval Decision" doc={doc} onSubmit={handleApprove} onClose={() => setModal(null)} />
      )}
      <ConfirmDialog
        open={!!confirmPending}
        title={confirmPending?.title}
        message={confirmPending?.message}
        confirmLabel={confirmPending?.confirmLabel || "Delete"}
        onConfirm={confirmPending?.onConfirm}
        onCancel={() => setConfirmPending(null)}
      />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/documents" className="hover:text-foreground transition-colors">Documents</Link>
        <span>/</span>
        <span className="font-mono text-xs">{doc.doc_number}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground border border-border rounded px-2 py-0.5">
              {doc.doc_number} Rev {doc.rev_number}
            </span>
            <StatusBadge status={doc.status} />
            {doc.status === "obsolete" && (
              <span className="text-xs font-bold text-red-600 dark:text-red-400 border-2 border-red-400 rounded px-2 py-0.5 uppercase tracking-wider">
                OBSOLETE
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight mt-2">{doc.title}</h1>
          {doc.description && <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {doc.file_path && (
            <button data-testid="download-file-btn" onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted transition-colors">
              <Download className="w-4 h-4" /> Download
            </button>
          )}
          {canEdit && (
            <Link to={`/documents/${id}/edit`} data-testid="edit-doc-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted transition-colors">
              Edit
            </Link>
          )}
          {canRevise && (
            <button data-testid="revise-doc-btn" onClick={handleRevise}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted transition-colors">
              <RotateCcw className="w-4 h-4" /> Create Revision
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          {canReview && (
            <button data-testid="review-action-btn" onClick={() => setModal("review")}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
              <CheckCircle className="w-4 h-4" /> Review
            </button>
          )}
          {canApprove && (
            <button data-testid="approve-action-btn" onClick={() => setModal("approve")}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors font-medium">
              <CheckCircle className="w-4 h-4" /> Approve
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border mb-5">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${tab === t.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Details Tab */}
      {tab === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 border border-border rounded-md bg-card">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Document Metadata</h3>
            </div>
            <dl className="px-5 py-2">
              <MetaRow label="Document Number" value={<span className="font-mono">{doc.doc_number}</span>} />
              <MetaRow label="Document Type" value={doc.doc_type} />
              <MetaRow label="Revision" value={`Rev ${doc.rev_number}`} />
              <MetaRow label="Status" value={<StatusBadge status={doc.status} />} />
              <MetaRow label="Author" value={doc.author_name} />
              <MetaRow label="Created" value={formatDate(doc.created_at)} />
              <MetaRow label="Submitted" value={formatDate(doc.submitted_at)} />
              <MetaRow label="Approved" value={formatDate(doc.approved_at)} />
              <MetaRow label="Effective Date" value={formatDateOnly(doc.effective_date)} />
              <MetaRow label="Next Review Date" value={formatDateOnly(doc.next_review_date)} />
              <MetaRow label="Review Period" value={doc.review_period_months ? `${doc.review_period_months} months` : null} />
              {doc.reviewer_ids?.length > 0 && doc.status === "draft" && (() => {
                const names = doc.reviewer_ids.map(
                  (rid) => reviewers.find((r) => r.id === rid)?.name || rid
                ).join(", ");
                return <MetaRow label="Reviewers" value={names} />;
              })()}
              {doc.approver_name && <MetaRow label="Approver" value={doc.approver_name} />}
              {doc.approval_comments && <MetaRow label="Approval Comments" value={doc.approval_comments} />}
            </dl>
          </div>

          <div className="space-y-4">
            {/* File */}
            <div className="border border-border rounded-md bg-card">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Attached File</h3>
              </div>
              <div className="p-4">
                {doc.file_path ? (
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">{(doc.file_size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={handleDownload} data-testid="inline-download-btn"
                      aria-label={`Download ${doc.file_name || "document"}`}
                      title="Download file"
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No file attached</p>
                )}
                {canUpload && (
                  <div className="mt-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Upload className="w-4 h-4" />
                      {fileUploading ? "Uploading..." : doc.file_path ? "Replace file" : "Upload file"}
                      <input
                        type="file"
                        data-testid="file-upload-input"
                        accept=".pdf,.docx,.xlsx"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={fileUploading}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX accepted</p>
                  </div>
                )}
              </div>
            </div>

            {/* Reviewers */}
            {doc.review_actions?.length > 0 && (
              <div className="border border-border rounded-md bg-card">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Review Status</h3>
                </div>
                <div className="p-4 space-y-2">
                  {doc.review_actions.map((ra) => (
                    <div key={ra.reviewer_id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{ra.reviewer_name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                        ${ra.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          ra.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                        {ra.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workflow Tab */}
      {tab === "workflow" && (
        <div className="space-y-4">
          {/* Submit for review */}
          {canSubmit && !showSubmitForm && (
            <div className="border border-border rounded-md bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">Submit for Review</h3>
              <p className="text-sm text-muted-foreground mb-4">Assign reviewers and an approver, then submit this document for review.</p>
              <button
                data-testid="show-submit-form-btn"
                onClick={() => setShowSubmitForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Send className="w-4 h-4" /> Submit for Review
              </button>
            </div>
          )}

          {canSubmit && showSubmitForm && (
            <div className="border border-border rounded-md bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Submit for Review</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">Assign Reviewers</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {reviewers.filter((r) => r.role === "admin" || (r.doc_roles || []).includes("reviewer") || (r.doc_roles || []).includes("document_controller")).map((r) => (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedReviewers.includes(r.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedReviewers([...selectedReviewers, r.id]);
                            else setSelectedReviewers(selectedReviewers.filter((x) => x !== r.id));
                          }}
                          data-testid={`reviewer-${r.id}`}
                        />
                        <span className="text-foreground">{r.name}</span>
                        <span className="text-xs text-muted-foreground">{r.email}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Assign Approver</label>
                  <select
                    value={selectedApprover}
                    onChange={(e) => setSelectedApprover(e.target.value)}
                    data-testid="approver-select"
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select approver...</option>
                    {reviewers.filter((r) => r.role === "admin" || (r.doc_roles || []).includes("approver") || (r.doc_roles || []).includes("document_controller")).map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.email})</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    data-testid="submit-for-review-btn"
                    onClick={handleSubmitReview}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Submit
                  </button>
                  <button onClick={() => setShowSubmitForm(false)}
                    className="px-4 py-2 border border-input rounded-md text-sm hover:bg-muted transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Workflow Timeline */}
          <div className="border border-border rounded-md bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Workflow Progress</h3>
            <div className="space-y-3">
              {[
                { step: "Draft", done: true },
                { step: "Under Review", done: ["under_review", "pending_approval", "active", "review_due", "review_overdue", "obsolete"].includes(doc.status) },
                { step: "Pending Approval", done: ["pending_approval", "active", "review_due", "review_overdue", "obsolete"].includes(doc.status) },
                { step: "Active", done: ["active", "review_due", "review_overdue"].includes(doc.status) },
              ].map(({ step, done }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                    ${done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Revision History Tab */}
      {tab === "history" && (
        <div className="border border-border rounded-md overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Rev</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Author</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Effective Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Approved</th>
                <th className="text-right px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((rev) => (
                <tr key={rev.id} className={`hover:bg-muted/30 ${rev.id === id ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">Rev {rev.rev_number}</td>
                  <td className="px-4 py-3"><StatusBadge status={rev.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{rev.author_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateOnly(rev.effective_date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateOnly(rev.approved_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/documents/${rev.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {rev.id === id ? "Current" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Signatures Tab */}
      {tab === "signatures" && (
        <div className="border border-border rounded-md overflow-hidden bg-card">
          {signatures.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No electronic signatures yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Signatory</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Date & Time</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">IP Address</th>
                  <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {signatures.map((sig) => (
                  <tr key={sig.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{sig.user_name}</p>
                      <p className="text-xs text-muted-foreground">{sig.user_email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{sig.action.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(sig.timestamp)}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{sig.ip_address}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{sig.comments || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
