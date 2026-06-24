import React, { useEffect, useState, useCallback } from "react";
import api, { formatError, tokenStore } from "@/utils/api";
import { Search, Download, Eye, RefreshCw, BookOpen } from "lucide-react";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (!window.location.hostname.includes("localhost")
    ? "https://api.lapisims.com"
    : "http://localhost:8001");

function formatDate(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return s; }
}

export default function Library() {
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState("all");
  const [docTypes, setDocTypes] = useState([]);
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null);

  const LIMIT = 20;

  useEffect(() => {
    api.get("/settings/doc-types").then((r) => setDocTypes(r.data)).catch(() => {});
  }, []);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { status: "active", page, limit: LIMIT };
      if (docType !== "all") params.doc_type = docType;
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get("/documents", { params });
      setDocs(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(formatError(e));
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [search, docType, page]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, docType]);

  const viewFile = async (doc) => {
    setViewing(doc.id);
    try {
      const token = tokenStore.getAccess();
      const res = await fetch(`${BACKEND_URL}/api/documents/${doc.id}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError("Could not load document file"); return; }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch { setError("Could not load document file"); }
    finally { setViewing(null); }
  };

  const downloadFile = async (doc) => {
    try {
      const token = tokenStore.getAccess();
      const res = await fetch(`${BACKEND_URL}/api/documents/${doc.id}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError("Could not download file"); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = doc.file_name || doc.doc_number;
      a.click();
    } catch { setError("Could not download file"); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Document Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Browse and download all effective controlled documents</p>
        </div>
        <button onClick={fetchDocs}
          className="p-2 rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground"
          title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or document number…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select value={docType} onChange={(e) => setDocType(e.target.value)}
          className="px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">All Types</option>
          {docTypes.filter(dt => dt.is_active).map((dt) => (
            <option key={dt.id} value={dt.name}>{dt.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        {loading ? (
          <div className="animate-pulse p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <BookOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No documents found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search || docType !== "all" ? "Try adjusting your search or filter" : "No effective documents in the library yet"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Doc No.</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Rev</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell whitespace-nowrap">Next Review</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-foreground font-medium whitespace-nowrap">{doc.doc_number}</td>
                    <td className="px-4 py-3 text-foreground max-w-xs truncate">{doc.title}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{doc.doc_type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">Rev {doc.rev_number}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground hidden lg:table-cell">{formatDate(doc.next_review_date)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {doc.file_path && (
                          <>
                            <button onClick={() => viewFile(doc)} disabled={viewing === doc.id}
                              title="View document"
                              className="p-1.5 rounded-md border border-input hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => downloadFile(doc)}
                              title="Download document"
                              className="p-1.5 rounded-md border border-input hover:bg-muted transition-colors text-muted-foreground">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {!doc.file_path && (
                          <span className="text-xs text-muted-foreground">No file</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">{total} document{total !== 1 ? "s" : ""}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-input rounded-md hover:bg-muted disabled:opacity-40 transition-colors">
                Previous
              </button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-xs border border-input rounded-md hover:bg-muted disabled:opacity-40 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {!loading && total > 0 && totalPages <= 1 && (
        <p className="text-xs text-muted-foreground mt-3">{total} document{total !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
