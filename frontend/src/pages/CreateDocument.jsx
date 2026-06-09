import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { formatError } from "@/utils/api";
import { ChevronLeft, Upload, X } from "lucide-react";

export default function CreateDocument() {
  const { id } = useParams(); // if editing
  const navigate = useNavigate();
  const [docTypes, setDocTypes] = useState([]);
  const [form, setForm] = useState({ doc_type_id: "", title: "", description: "", rev_number: "" });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEdit = !!id;

  useEffect(() => {
    api.get("/settings/doc-types").then((r) => {
      const active = r.data.filter((dt) => dt.is_active);
      setDocTypes(active);
      if (!isEdit && active.length) setForm((f) => ({ ...f, doc_type_id: active[0].id }));
    }).catch(() => {});

    if (isEdit) {
      api.get(`/documents/${id}`).then((r) => {
        setForm({
          doc_type_id: r.data.doc_type_id || "",
          title: r.data.title || "",
          description: r.data.description || "",
        });
      }).catch(() => {});
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Title is required");
    if (!isEdit && !form.doc_type_id) return setError("Document type is required");
    setError("");
    setLoading(true);
    try {
      let docId = id;
      if (!isEdit) {
        const payload = { ...form };
        if (payload.rev_number === "" || payload.rev_number === null) delete payload.rev_number;
        else payload.rev_number = parseInt(payload.rev_number, 10);
        const { data } = await api.post("/documents", payload);
        docId = data.id;
      } else {
        await api.put(`/documents/${id}`, { title: form.title, description: form.description });
      }

      // Upload file if selected
      if (file && docId) {
        const fd = new FormData();
        fd.append("file", file);
        await api.post(`/documents/${docId}/upload`, fd);
      }

      navigate(`/documents/${docId}`);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-6">
        {isEdit ? "Edit Document" : "Create New Document"}
      </h1>

      {error && (
        <div data-testid="form-error" className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="border border-border rounded-md bg-card p-5 space-y-4">
          <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Document Information</h2>

          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Document Type *</label>
              <select
                data-testid="doc-type-select"
                value={form.doc_type_id}
                onChange={(e) => setForm({ ...form, doc_type_id: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select type...</option>
                {docTypes.map((dt) => (
                  <option key={dt.id} value={dt.id}>{dt.name} ({dt.prefix}-XXX)</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Document number will be auto-generated</p>
            </div>
          )}

          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Starting Revision <span className="text-muted-foreground/60 font-normal">(leave blank to default to 0)</span>
              </label>
              <input
                type="number"
                min="0"
                value={form.rev_number}
                onChange={(e) => setForm({ ...form, rev_number: e.target.value })}
                placeholder="0"
                className="w-32 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">Override if importing an existing document at a specific revision</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Title *</label>
            <input
              data-testid="title-input"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="Enter document title..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea
              data-testid="description-input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              placeholder="Enter document description..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* File Upload */}
        <div className="border border-border rounded-md bg-card p-5">
          <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-3">Attach File (Optional)</h2>
          <p className="text-xs text-muted-foreground mb-3">You can also upload the file after creating the document. Accepted: PDF, DOCX, XLSX</p>

          {file ? (
            <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button type="button" onClick={() => setFile(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-md border-2 border-dashed border-border hover:border-muted-foreground transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm text-foreground font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX up to 50MB</p>
              </div>
              <input
                type="file"
                data-testid="file-input"
                accept=".pdf,.docx,.xlsx"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </label>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            data-testid="save-document-btn"
            disabled={loading}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Saving..." : isEdit ? "Update Document" : "Create Document"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 border border-input rounded-md text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
