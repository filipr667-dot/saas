import React, { useEffect, useState, useCallback } from "react";
import api, { formatError } from "@/utils/api";
import { Search, RefreshCw, ChevronLeft, ChevronRight, Download, Calendar } from "lucide-react";

function formatDate(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

const ACTION_COLORS = {
  LOGIN: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  LOGOUT: "text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
  DOCUMENT_CREATED: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  DOCUMENT_APPROVED: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  REVIEW_REJECTED: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  APPROVAL_REJECTED: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  LOGIN_FAILED: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  DOCUMENT_OBSOLETED: "text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
  SUBMITTED_FOR_REVIEW: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
};

const DATE_PRESETS = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "All Time", value: "" },
  { label: "Custom", value: "custom" },
];

function getPresetRange(preset, customFrom, customTo) {
  const now = new Date();
  if (preset === "today") {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (preset === "week") {
    const start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (preset === "month") {
    const start = new Date(now); start.setDate(1); start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (preset === "custom") {
    const result = {};
    if (customFrom) result.from = new Date(customFrom).toISOString();
    if (customTo) {
      const end = new Date(customTo); end.setHours(23, 59, 59, 999);
      result.to = end.toISOString();
    }
    return result;
  }
  return {};
}

const PAGE_SIZE = 20;

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actions, setActions] = useState([]);
  const [selectedAction, setSelectedAction] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const fetchLogs = useCallback(async () => {
    if (datePreset === "custom" && !customFrom && !customTo) return;
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (selectedAction) params.action = selectedAction;
      const range = getPresetRange(datePreset, customFrom, customTo);
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const { data } = await api.get("/audit", { params });
      setLogs(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(formatError(e));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedAction, datePreset, customFrom, customTo]);

  useEffect(() => {
    api.get("/audit/actions").then((r) => setActions(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleExport = () => {
    if (!logs.length) return;
    const header = "Timestamp,User,Email,Role,Action,Entity,IP Address\n";
    const rows = logs.map((l) =>
      [formatDate(l.timestamp), l.user_name, l.user_email, l.user_role || "", l.action, l.entity_label || "", l.ip_address || ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total > 0 ? `${total} total records` : "Immutable log of all system activity"}
          </p>
        </div>
        <button onClick={handleExport}
          aria-label="Export to CSV" title="Export current page to CSV"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md bg-background hover:bg-muted transition-colors text-muted-foreground">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Date preset chips */}
      <div className="flex items-center gap-1 flex-wrap mb-2">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => { setDatePreset(p.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5
              ${datePreset === p.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {p.value === "custom" && <Calendar className="w-3 h-3" />}
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range inputs */}
      {datePreset === "custom" && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
              className="px-2 py-1 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
              className="px-2 py-1 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {(customFrom || customTo) && (
            <button
              onClick={() => { setCustomFrom(""); setCustomTo(""); }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            data-testid="audit-search"
            type="text"
            placeholder="Search by user, action, document…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          data-testid="action-filter"
          value={selectedAction}
          onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[180px]"
        >
          <option value="">All Actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>

        <button
          data-testid="refresh-audit"
          onClick={fetchLogs}
          aria-label="Refresh audit trail"
          title="Refresh audit trail"
          className="p-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <span className="flex-1">Failed to load audit records: {error}</span>
          <button onClick={fetchLogs} className="underline hover:no-underline text-sm flex-shrink-0">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-md overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="audit-table">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Document / Entity</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 && !error ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    {search || selectedAction || datePreset ? "No records match the current filters." : "No audit records found."}
                  </td>
                </tr>
              ) : logs.length === 0 && error ? null : (
                logs.map((log) => {
                  const actionCls = ACTION_COLORS[log.action] || "text-foreground bg-muted border-border";
                  return (
                    <tr key={log.id} data-testid={`audit-row-${log.id}`} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.timestamp)}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-foreground">{log.user_name}</p>
                        <p className="text-xs text-muted-foreground">{log.user_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {log.user_role ? (
                          <span className="text-xs text-muted-foreground capitalize">{log.user_role}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-mono font-medium px-2 py-0.5 rounded border ${actionCls}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{log.entity_label || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{log.ip_address || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span className="text-xs">Page {page} of {totalPages} — {total} records</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              data-testid="audit-prev"
              className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
              data-testid="audit-next"
              className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
