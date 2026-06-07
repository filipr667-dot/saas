import React, { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api, { formatError } from "@/utils/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus, ChevronLeft, ChevronRight, Download, Eye, RefreshCw, X } from "lucide-react";

function formatDate(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return s; }
}

const VIEW_TABS = [
  { label: "All Documents", value: "" },
  { label: "My Drafts", value: "draft" },
  { label: "Awaiting Review", value: "under_review" },
  { label: "Awaiting Approval", value: "pending_approval" },
  { label: "Effective", value: "active" },
  { label: "Review Due", value: "review_due" },
  { label: "Overdue", value: "review_overdue" },
  { label: "Obsolete", value: "obsolete" },
];

export default function Documents() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [docTypes, setDocTypes] = useState([]);

  const statusParam = searchParams.get("status") || "";
  const typeParam = searchParams.get("doc_type") || "all";
  const searchParam = searchParams.get("search") || "";
  const pageParam = parseInt(searchParams.get("page") || "1");

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page: pageParam, limit: 20 };
      if (statusParam) params.status = statusParam;
      if (typeParam !== "all") params.doc_type = typeParam;
      if (searchParam) params.search = searchParam;
      const { data } = await api.get("/documents", { params });
      setDocs(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(formatError(e));
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [statusParam, typeParam, searchParam, pageParam]);

  useEffect(() => {
    api.get("/settings/doc-types").then((r) => setDocTypes(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const setParam = (key, val) => {
    const p = Object.fromEntries(searchParams.entries());
    if (val) p[key] = val; else delete p[key];
    if (key !== "page") delete p.page;
    setSearchParams(p);
  };

  const clearFilters = () => setSearchParams({});

  const hasFilters = statusParam || typeParam !== "all" || searchParam;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Controlled document register — {total} document{total !== 1 ? "s" : ""}</p>
        </div>
        {(user?.role === "author" || user?.role === "admin") && (
          <Link to="/documents/create" data-testid="create-new-doc-btn"
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> New Document
          </Link>
        )}
      </div>

      {/* Saved view tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setParam("status", tab.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap
              ${statusParam === tab.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            data-testid="search-input"
            type="text"
            placeholder="Search by number, title, author…"
            defaultValue={searchParam}
            onKeyDown={(e) => e.key === "Enter" && setParam("search", e.target.value)}
            onBlur={(e) => setParam("search", e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          data-testid="type-filter"
          value={typeParam}
          onChange={(e) => setParam("doc_type", e.target.value === "all" ? "" : e.target.value)}
          className="px-3 py-1.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[140px]"
        >
          <option value="all">All Types</option>
          {docTypes.map((dt) => <option key={dt.id} value={dt.name}>{dt.name}</option>)}
        </select>

        <button data-testid="refresh-docs" onClick={fetchDocs}
          aria-label="Refresh documents" title="Refresh documents"
          className="p-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground">
          <RefreshCw className="w-4 h-4" />
        </button>

        {hasFilters && (
          <button data-testid="clear-filters" onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:bg-muted transition-colors">
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <span className="flex-1">Failed to load documents: {error}</span>
          <button onClick={fetchDocs} className="underline hover:no-underline text-sm flex-shrink-0">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="documents-table">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Doc Number</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rev</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Effective Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Next Review</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : docs.length === 0 && !error ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <p className="text-sm font-medium text-foreground mb-1">No documents found</p>
                    <p className="text-xs text-muted-foreground">
                      {hasFilters ? "Try adjusting your filters or clearing them." : "No controlled documents exist yet."}
                    </p>
                    {hasFilters && (
                      <button onClick={clearFilters} className="mt-3 text-xs text-primary hover:underline">Clear all filters</button>
                    )}
                  </td>
                </tr>
              ) : (
                docs.map((doc) => (
                  <tr key={doc.id} data-testid={`doc-row-${doc.id}`}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/documents/${doc.id}`)}>
                    <td className="px-5 py-3 font-mono text-xs text-foreground font-semibold whitespace-nowrap">{doc.doc_number}</td>
                    <td className="px-4 py-3 text-foreground font-medium max-w-xs truncate">{doc.title}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{doc.doc_type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">Rev {doc.rev_number}</td>
                    <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{doc.author_name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(doc.effective_date)}</td>
                    <td className={`px-4 py-3 text-xs font-mono whitespace-nowrap ${
                      doc.status === "review_overdue" ? "text-red-600 dark:text-red-400 font-semibold" :
                      doc.status === "review_due" ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
                      {formatDate(doc.next_review_date)}
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <Link to={`/documents/${doc.id}`} data-testid={`view-doc-${doc.id}`}
                          aria-label={`View ${doc.doc_number}`} title="View document"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        {doc.file_path && (
                          <button data-testid={`download-doc-${doc.id}`}
                            aria-label={`Download ${doc.doc_number}`} title="Download file"
                            onClick={async () => {
                              const resp = await api.get(`/documents/${doc.id}/file`, { responseType: "blob" });
                              const url = URL.createObjectURL(resp.data);
                              const a = document.createElement("a");
                              a.href = url; a.download = doc.file_name || "document"; a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span className="text-xs">Page {pageParam} of {totalPages} — {total} records</span>
          <div className="flex gap-1">
            <button data-testid="prev-page" disabled={pageParam <= 1}
              onClick={() => setParam("page", String(pageParam - 1))}
              className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button data-testid="next-page" disabled={pageParam >= totalPages}
              onClick={() => setParam("page", String(pageParam + 1))}
              className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
