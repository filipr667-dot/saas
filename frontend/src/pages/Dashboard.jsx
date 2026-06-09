import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/utils/api";
import { StatusBadge } from "@/components/StatusBadge";
import {
  FileText, CheckCircle, Clock, AlertTriangle, XCircle, Archive,
  Activity, Plus, ChevronRight, Users, TrendingUp, CalendarClock,
} from "lucide-react";

function formatDate(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return s; }
}
function formatTime(s) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
           d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

function StatCard({ label, value, icon: Icon, color = "", testId, to, sub }) {
  const inner = (
    <div data-testid={testId} className="bg-card border border-border rounded-md p-4 hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
        <Icon className={`w-4 h-4 ${color || "text-muted-foreground"} opacity-70`} />
      </div>
      <p className={`text-2xl font-semibold ${color || "text-foreground"}`}>{value ?? "—"}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1 leading-tight">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

const ACTION_COLORS = {
  DOCUMENT_APPROVED: "text-emerald-600 dark:text-emerald-400",
  REVIEW_APPROVED_ALL: "text-emerald-600 dark:text-emerald-400",
  DOCUMENT_CREATED: "text-blue-600 dark:text-blue-400",
  SUBMITTED_FOR_REVIEW: "text-blue-600 dark:text-blue-400",
  REVIEW_REJECTED: "text-red-600 dark:text-red-400",
  APPROVAL_REJECTED: "text-red-600 dark:text-red-400",
  USER_CREATED: "text-violet-600 dark:text-violet-400",
  USER_UPDATED: "text-violet-500 dark:text-violet-400",
};

const FILTER_CHIPS = [
  { label: "All Documents", param: "" },
  { label: "My Drafts", param: "draft" },
  { label: "Awaiting Review", param: "under_review" },
  { label: "Awaiting Approval", param: "pending_approval" },
  { label: "Effective", param: "active" },
  { label: "Review Due", param: "review_due" },
  { label: "Overdue", param: "review_overdue" },
  { label: "Obsolete", param: "obsolete" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [recentDocs, setRecentDocs] = useState([]);

  const loadStats = React.useCallback(() => {
    setStatsLoading(true);
    setStatsError("");
    api.get("/documents/dashboard/stats")
      .then((r) => setStats(r.data))
      .catch((e) => setStatsError(e?.response?.data?.detail || e?.message || "Failed to load"))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
    if (user?.role !== "readonly") {
      api.get("/documents?limit=8").then((r) => setRecentDocs(r.data.items || [])).catch(() => {});
    }
  }, [user, loadStats]);

  const role = user?.role;

  return (
    <div className="flex gap-6">
      {/* Main column */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Welcome back, <span className="text-foreground font-medium">{user?.name}</span></p>
          </div>
          {(role === "author" || role === "admin") && (
            <Link to="/documents/create" data-testid="create-doc-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> New Document
            </Link>
          )}
        </div>

        {/* Error banner */}
        {statsError && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            <span className="flex-1">Could not load dashboard stats: {statsError}</span>
            <button onClick={loadStats} className="underline hover:no-underline text-sm flex-shrink-0">Retry</button>
          </div>
        )}

        {/* Skeleton */}
        {statsLoading && !stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-md" />)}
          </div>
        )}

        {/* Admin stats */}
        {role === "admin" && stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Pending Reviews" value={stats.under_review} icon={Clock} color="text-blue-600 dark:text-blue-400" testId="stat-review" to="/documents?status=under_review" sub="Awaiting reviewer action" />
              <StatCard label="Pending Approvals" value={stats.pending_approval} icon={AlertTriangle} color="text-amber-600 dark:text-amber-400" testId="stat-approval" to="/documents?status=pending_approval" sub="Awaiting approver decision" />
              <StatCard label="Upcoming Reviews" value={stats.upcoming_reviews || 0} icon={CalendarClock} color="text-orange-600 dark:text-orange-400" testId="stat-upcoming" sub="Due within 30 days" />
              <StatCard label="Effective Documents" value={stats.active} icon={CheckCircle} color="text-emerald-600 dark:text-emerald-400" testId="stat-active" to="/documents?status=active" sub="Currently effective" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Documents" value={stats.total} icon={FileText} testId="stat-total" to="/documents" sub="All controlled docs" />
              <StatCard label="Drafts" value={stats.draft} icon={FileText} color="text-slate-500" testId="stat-draft" to="/documents?status=draft" sub="In preparation" />
              <StatCard label="Rejected" value={stats.rejected} icon={XCircle} color="text-red-500" testId="stat-rejected" to="/documents?status=rejected" sub="Need revision" />
              <StatCard label="Obsolete" value={stats.obsolete} icon={Archive} color="text-slate-400" testId="stat-obsolete" to="/documents?status=obsolete" sub="Superseded" />
            </div>
          </>
        )}

        {/* Author stats */}
        {role === "author" && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="My Drafts" value={stats.my_draft} icon={FileText} testId="stat-my-draft" to="/documents?status=draft" sub="Drafts and rejected" />
            <StatCard label="Under Review" value={stats.pending_review} icon={Clock} color="text-blue-600" testId="stat-pending-review" sub="Submitted for review" />
            <StatCard label="Effective Docs" value={stats.my_active} icon={CheckCircle} color="text-emerald-600" testId="stat-my-active" sub="My active documents" />
            <StatCard label="Review Due" value={stats.my_review_due} icon={AlertTriangle} color="text-orange-600" testId="stat-my-due" sub="Need revision soon" />
          </div>
        )}

        {/* Reviewer stats */}
        {role === "reviewer" && stats && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Pending Reviews" value={stats.pending_reviews} icon={Clock} color="text-blue-600" testId="stat-pending-rev" to="/documents?status=under_review" sub="Awaiting your review" />
            <StatCard label="Completed Reviews" value={stats.completed_reviews} icon={CheckCircle} color="text-emerald-600" testId="stat-completed-rev" sub="Total reviews completed" />
          </div>
        )}

        {/* Approver stats */}
        {role === "approver" && stats && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Pending Approvals" value={stats.pending_approvals} icon={AlertTriangle} color="text-amber-600" testId="stat-pending-appr" to="/documents?status=pending_approval" sub="Awaiting your decision" />
            <StatCard label="Total Approved" value={stats.total_approved} icon={CheckCircle} color="text-emerald-600" testId="stat-total-appr" sub="Documents approved" />
          </div>
        )}

        {/* Controlled Documents table */}
        {recentDocs.length > 0 && (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Controlled Documents</h2>
              <Link to="/documents" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-border overflow-x-auto">
              {FILTER_CHIPS.map((chip) => (
                <Link key={chip.param}
                  to={chip.param ? `/documents?status=${chip.param}` : "/documents"}
                  className="flex-shrink-0 px-2.5 py-1 text-xs rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap">
                  {chip.label}
                </Link>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Doc No.</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rev</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Next Review</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentDocs.map((doc) => (
                    <tr key={doc.id} data-testid={`recent-doc-${doc.id}`}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="hover:bg-muted/40 cursor-pointer transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-foreground font-medium whitespace-nowrap">{doc.doc_number}</td>
                      <td className="px-4 py-3 text-foreground max-w-xs truncate">{doc.title}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">Rev {doc.rev_number}</td>
                      <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{doc.author_name}</td>
                      <td className={`px-4 py-3 text-xs font-mono whitespace-nowrap ${
                        doc.status === "review_overdue" ? "text-red-600 dark:text-red-400 font-semibold" :
                        doc.status === "review_due" ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
                        {formatDate(doc.next_review_date)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link to={`/documents/${doc.id}`} onClick={(e) => e.stopPropagation()}
                          className="text-xs text-primary hover:underline font-medium">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2.5 border-t border-border">
              <p className="text-xs text-muted-foreground">Showing {recentDocs.length} most recent documents</p>
            </div>
          </div>
        )}

        {/* Upcoming Reviews */}
        {role === "admin" && stats?.upcoming_review_docs?.length > 0 && (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-foreground">Upcoming Reviews</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium">
                  Due within 30 days
                </span>
              </div>
              <Link to="/documents?status=review_due" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Doc No.</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Type</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Owner</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Next Review</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.upcoming_review_docs.map((doc) => {
                    const due = new Date(doc.next_review_date);
                    const now = new Date();
                    const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysLeft < 0;
                    const isUrgent = daysLeft <= 7;
                    return (
                      <tr key={doc.id} onClick={() => navigate(`/documents/${doc.id}`)}
                        className="hover:bg-muted/40 cursor-pointer transition-colors">
                        <td className="px-5 py-3 font-mono text-xs text-foreground font-medium whitespace-nowrap">{doc.doc_number}</td>
                        <td className="px-4 py-3 text-foreground max-w-xs truncate">{doc.title}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{doc.doc_type}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{doc.author_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono font-semibold ${isOverdue ? "text-red-600 dark:text-red-400" : isUrgent ? "text-orange-600 dark:text-orange-400" : "text-amber-600 dark:text-amber-400"}`}>
                              {formatDate(doc.next_review_date)}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isOverdue ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" : isUrgent ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                              {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link to={`/documents/${doc.id}`} onClick={(e) => e.stopPropagation()}
                            className="text-xs text-primary hover:underline font-medium">Revise</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Audit Events */}
        {role === "admin" && stats?.recent_audit?.length > 0 && (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Recent Audit Events</h2>
              <Link to="/audit" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                View Audit Trail <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Date / Time</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Entity</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(stats.recent_audit || []).slice(0, 6).map((log, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{formatTime(log.timestamp)}</td>
                      <td className="px-4 py-2.5 text-xs text-foreground">{log.user_name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-mono font-semibold ${ACTION_COLORS[log.action] || "text-foreground"}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.entity_label || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{log.ip_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — admin only */}
      {role === "admin" && (
        <div className="hidden xl:flex flex-col gap-4 w-60 flex-shrink-0">
          {/* Inspection Readiness */}
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Inspection Readiness</h3>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Audit Trail Active", sub: "All system events recorded", ok: true },
                { label: "E-Signatures Enabled", sub: "Password-confirmed signing", ok: true },
                { label: "Controlled Lifecycle", sub: "Workflow enforced on all docs", ok: true },
                { label: "Upcoming Reviews", sub: stats ? `${stats.upcoming_reviews || 0} document(s) due in 30 days` : "Loading…", ok: !(stats?.upcoming_reviews) },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 px-4 py-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.ok ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
                    <span className={`text-xs font-bold leading-none ${item.ok ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>{item.ok ? "✓" : "!"}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-tight">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Quick Actions</h3>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Create Document", sub: "Start a new document", to: "/documents/create", icon: FileText },
                { label: "User Management", sub: "Manage users and roles", to: "/users", icon: Users },
                { label: "Audit Trail", sub: "Inspect activity log", to: "/audit", icon: Activity },
                { label: "Settings", sub: "Configure document types", to: "/settings", icon: TrendingUp },
              ].map((a) => {
                const Icon = a.icon;
                return (
                  <Link key={a.to} to={a.to} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-tight">{a.label}</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">{a.sub}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Lifecycle Legend */}
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Document Lifecycle</h3>
            </div>
            <div className="px-4 py-3 space-y-2">
              {[
                { status: "draft", sub: "Being authored" },
                { status: "under_review", sub: "Reviewer assessment" },
                { status: "pending_approval", sub: "Approver decision" },
                { status: "active", sub: "Active and effective" },
                { status: "review_due", sub: "Review date approaching" },
                { status: "obsolete", sub: "Superseded or withdrawn" },
              ].map((s) => (
                <div key={s.status} className="flex items-center justify-between gap-2">
                  <StatusBadge status={s.status} />
                  <span className="text-xs text-muted-foreground text-right leading-tight">{s.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
