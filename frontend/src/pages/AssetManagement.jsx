import React, { useEffect, useState, useRef } from "react";
import api, { formatError, tokenStore } from "@/utils/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Plus, Trash2, RefreshCw, X, AlertTriangle,
  ChevronDown, ChevronUp, Edit2, Upload, Download, Printer, Eye,
  Wrench, Settings2, Image as ImageIcon, FileText, CheckCircle,
} from "lucide-react";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (!window.location.hostname.includes("localhost")
    ? "https://api.lapisims.com"
    : "http://localhost:8001");

// ─── helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr, days) {
  if (!dateStr || !days) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    d.setDate(d.getDate() + parseInt(days, 10));
    return d.toISOString().split("T")[0];
  } catch { return ""; }
}

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function CalibBadge({ dueDate, required }) {
  if (!required) return <span className="text-xs text-muted-foreground">Not Required</span>;
  if (!dueDate) return <span className="text-xs text-muted-foreground">No Date</span>;
  const d = daysUntil(dueDate);
  if (d < 0) return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
      Overdue {Math.abs(d)}d
    </span>
  );
  if (d <= 30) return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
      Due in {d}d
    </span>
  );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
      OK — {fmtDate(dueDate)}
    </span>
  );
}

// ─── photo thumbnail (auth-gated) ────────────────────────────────────────────

function AssetPhotoThumb({ assetId, hasPhoto, photoVersion }) {
  const [src, setSrc] = useState(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    setSrc(null);
    setLoadError(false);
    if (!hasPhoto || !assetId) return;
    let url;
    let cancelled = false;
    (async () => {
      try {
        const token = tokenStore.getAccess();
        const res = await fetch(`${BACKEND_URL}/api/assets/${assetId}/photo`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) { setLoadError(true); return; }
        const blob = await res.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      } catch { if (!cancelled) setLoadError(true); }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [assetId, hasPhoto, photoVersion]);

  if (!hasPhoto) return null;
  if (loadError) return (
    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0 border border-border" title="Photo unavailable">
      <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
    </div>
  );
  if (!src) return <div className="w-8 h-8 rounded bg-muted animate-pulse flex-shrink-0" />;
  return <img src={src} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-border" />;
}

// ─── empty forms ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  asset_id: "", name: "", serial_number: "", supplier: "",
  calibration_required: false,
  calibration_frequency_months: "", last_calibration_date: "",
  notification_email: "", notification_phone: "",
};

const EMPTY_PM = { activity_name: "", frequency_days: "", last_check_date: "" };

// ─── main component ───────────────────────────────────────────────────────────

export default function AssetManagement() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [pmMap, setPmMap] = useState({});
  const [pmLoading, setPmLoading] = useState({});

  // asset form
  const [assetModal, setAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // PM form (inline per asset)
  const [addingPm, setAddingPm] = useState(null);
  const [editingPm, setEditingPm] = useState(null);
  const [pmForm, setPmForm] = useState(EMPTY_PM);
  const [pmSaving, setPmSaving] = useState(false);

  // PM completion modal
  const [pmCompleteModal, setPmCompleteModal] = useState(null); // { assetId, pm }
  const [pmCompleteForm, setPmCompleteForm] = useState({ completed_by: "", completion_date: new Date().toISOString().split("T")[0], password: "" });
  const [pmCompleting, setPmCompleting] = useState(false);

  // Calibration completion modal
  const [calibCompleteModal, setCalibCompleteModal] = useState(null); // asset
  const [calibCompleteForm, setCalibCompleteForm] = useState({ completed_by: "", completion_date: new Date().toISOString().split("T")[0], password: "" });
  const [calibCompleting, setCalibCompleting] = useState(false);

  // cert upload per asset
  const [certUploading, setCertUploading] = useState({});

  // photo upload per asset
  const [photoUploading, setPhotoUploading] = useState({});
  const [confirmPending, setConfirmPending] = useState(null);

  // filter for clickable stat cards
  const [dashFilter, setDashFilter] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { fetchStats(); fetchAssets(); }, []);

  const fetchStats = async () => {
    setStatsLoading(true);
    try { const { data } = await api.get("/assets/stats/dashboard"); setStats(data); }
    catch (e) { setError(formatError(e)); }
    finally { setStatsLoading(false); }
  };

  const fetchAssets = async () => {
    setAssetsLoading(true);
    try { const { data } = await api.get("/assets"); setAssets(data); }
    catch (e) { setError(formatError(e)); }
    finally { setAssetsLoading(false); }
  };

  const fetchPm = async (assetId, force = false) => {
    if (pmMap[assetId] && !force) return;
    setPmLoading(p => ({ ...p, [assetId]: true }));
    try {
      const { data } = await api.get(`/assets/${assetId}/pm`);
      setPmMap(p => ({ ...p, [assetId]: data }));
    } catch (_) {}
    finally { setPmLoading(p => ({ ...p, [assetId]: false })); }
  };

  const refreshAsset = async (assetId) => {
    try {
      const { data } = await api.get(`/assets/${assetId}`);
      setAssets(prev => prev.map(a => a.id === assetId ? data : a));
    } catch (_) {}
  };

  const toggleExpand = (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    fetchPm(id);
  };

  // ── asset form ──────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingAsset(null);
    setForm(EMPTY_FORM);
    setPhotoFile(null);
    setFormError("");
    setAssetModal(true);
  };

  const openEdit = (asset) => {
    setEditingAsset(asset);
    setForm({
      asset_id: asset.asset_id || "",
      name: asset.name || "",
      serial_number: asset.serial_number || "",
      supplier: asset.supplier || "",
      calibration_required: asset.calibration_required || false,
      calibration_frequency_months: asset.calibration_frequency_months ?? "",
      last_calibration_date: asset.last_calibration_date || "",
      notification_email: asset.notification_email || "",
      notification_phone: asset.notification_phone || "",
    });
    setPhotoFile(null);
    setFormError("");
    setAssetModal(true);
  };

  const calcDueDate = () => {
    if (!form.calibration_required || !form.last_calibration_date || !form.calibration_frequency_months) return "";
    const d = new Date(form.last_calibration_date);
    d.setMonth(d.getMonth() + parseInt(form.calibration_frequency_months, 10));
    return d.toISOString().split("T")[0];
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.asset_id.trim()) { setFormError("Asset ID is required"); return; }
    if (!form.name.trim()) { setFormError("Name/Model is required"); return; }
    setFormSaving(true);
    try {
      const payload = {
        ...form,
        calibration_frequency_months: form.calibration_frequency_months ? parseInt(form.calibration_frequency_months, 10) : null,
        notification_email: form.notification_email || null,
        notification_phone: form.notification_phone || null,
      };
      let saved;
      if (editingAsset) {
        const { data } = await api.put(`/assets/${editingAsset.id}`, payload);
        saved = data;
      } else {
        const { data } = await api.post("/assets", payload);
        saved = data;
      }
      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        await api.post(`/assets/${saved.id}/photo`, fd);
      }
      setSuccess(editingAsset ? "Asset updated" : "Asset created");
      setAssetModal(false);
      fetchAssets();
      fetchStats();
    } catch (err) { setFormError(formatError(err)); }
    finally { setFormSaving(false); }
  };

  const handleDeleteAsset = (asset) => {
    setConfirmPending({
      title: "Delete Asset",
      message: `Delete asset "${asset.asset_id} — ${asset.name}"? This also deletes all PM activities.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmPending(null);
        try {
          await api.delete(`/assets/${asset.id}`);
          setSuccess("Asset deleted");
          if (expandedId === asset.id) setExpandedId(null);
          fetchAssets();
          fetchStats();
        } catch (err) { setError(formatError(err)); }
      },
    });
  };

  const handlePhotoUpload = async (assetId, file) => {
    setPhotoUploading(p => ({ ...p, [assetId]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/assets/${assetId}/photo`, fd);
      setSuccess("Photo updated");
      await refreshAsset(assetId);
    } catch (err) { setError(formatError(err)); }
    finally { setPhotoUploading(p => ({ ...p, [assetId]: false })); }
  };

  const handleCertUpload = async (assetId, file) => {
    setCertUploading(p => ({ ...p, [assetId]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/assets/${assetId}/certificate`, fd);
      setSuccess("Certificate uploaded");
      await refreshAsset(assetId);
    } catch (err) { setError(formatError(err)); }
    finally { setCertUploading(p => ({ ...p, [assetId]: false })); }
  };

  // ── download helpers ────────────────────────────────────────────────────────

  const downloadFile = async (url, filename) => {
    try {
      const token = tokenStore.getAccess();
      const res = await fetch(`${BACKEND_URL}/api${url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const t = await res.text(); setError(t || "Download failed"); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setError(String(e)); }
  };

  const viewFile = async (url) => {
    try {
      const token = tokenStore.getAccess();
      const res = await fetch(`${BACKEND_URL}/api${url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setError("Could not load file"); return; }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) { setError(String(e)); }
  };

  // ── PM activities ───────────────────────────────────────────────────────────

  const handleAddPm = async (assetId) => {
    setPmSaving(true);
    try {
      const payload = { ...pmForm, frequency_days: parseInt(pmForm.frequency_days, 10) };
      const { data } = await api.post(`/assets/${assetId}/pm`, payload);
      setPmMap(p => ({ ...p, [assetId]: [...(p[assetId] || []), data] }));
      setAddingPm(null);
      setPmForm(EMPTY_PM);
      setSuccess("PM activity added");
      fetchStats();
    } catch (err) { setError(formatError(err)); }
    finally { setPmSaving(false); }
  };

  const handleUpdatePm = async () => {
    if (!editingPm) return;
    setPmSaving(true);
    try {
      const payload = { ...editingPm.form, frequency_days: parseInt(editingPm.form.frequency_days, 10) };
      const { data } = await api.put(`/assets/${editingPm.asset_id}/pm/${editingPm.pm_id}`, payload);
      setPmMap(p => ({
        ...p,
        [editingPm.asset_id]: p[editingPm.asset_id].map(a => a.id === data.id ? data : a),
      }));
      setEditingPm(null);
      setSuccess("PM activity updated");
      fetchStats();
    } catch (err) { setError(formatError(err)); }
    finally { setPmSaving(false); }
  };

  const handleDeletePm = (assetId, pmId) => {
    setConfirmPending({
      title: "Remove PM Activity",
      message: "Remove this PM activity? This cannot be undone.",
      confirmLabel: "Remove",
      onConfirm: async () => {
        setConfirmPending(null);
        try {
          await api.delete(`/assets/${assetId}/pm/${pmId}`);
          setPmMap(p => ({ ...p, [assetId]: p[assetId].filter(a => a.id !== pmId) }));
          setSuccess("PM activity removed");
          fetchStats();
        } catch (err) { setError(formatError(err)); }
      },
    });
  };

  // ── PM completion ────────────────────────────────────────────────────────────

  const openPmComplete = (assetId, pm) => {
    setPmCompleteModal({ assetId, pm });
    setPmCompleteForm({ completed_by: "", completion_date: new Date().toISOString().split("T")[0], password: "" });
  };

  const handlePmComplete = async () => {
    if (!pmCompleteModal) return;
    setPmCompleting(true);
    try {
      const { data } = await api.post(
        `/assets/${pmCompleteModal.assetId}/pm/${pmCompleteModal.pm.id}/complete`,
        pmCompleteForm,
      );
      setPmMap(p => ({
        ...p,
        [pmCompleteModal.assetId]: (p[pmCompleteModal.assetId] || []).map(pm =>
          pm.id === data.id ? data : pm
        ),
      }));
      setPmCompleteModal(null);
      setSuccess("PM completed — sticker is now available");
      fetchStats();
    } catch (err) { setError(formatError(err)); }
    finally { setPmCompleting(false); }
  };

  // ── Calibration completion ────────────────────────────────────────────────────

  const openCalibComplete = (asset) => {
    setCalibCompleteModal(asset);
    setCalibCompleteForm({ completed_by: "", completion_date: new Date().toISOString().split("T")[0], password: "" });
  };

  const handleCalibComplete = async () => {
    if (!calibCompleteModal) return;
    setCalibCompleting(true);
    try {
      const { data } = await api.post(`/assets/${calibCompleteModal.id}/calibration/complete`, calibCompleteForm);
      setAssets(prev => prev.map(a => a.id === data.id ? data : a));
      setCalibCompleteModal(null);
      setSuccess("Calibration signed off — sticker is now available");
      fetchStats();
    } catch (err) { setError(formatError(err)); }
    finally { setCalibCompleting(false); }
  };

  // ── filtered asset list ─────────────────────────────────────────────────────

  const pmDueAssetIds = new Set([
    ...(stats?.pm_due_activities || []).map(p => p.asset_id),
    ...(stats?.pm_overdue_activities || []).map(p => p.asset_id),
  ]);

  const displayAssets = dashFilter === "calibration"
    ? assets.filter(a => {
        if (!a.calibration_required || !a.calibration_due_date) return false;
        const d = daysUntil(a.calibration_due_date);
        return d !== null && d <= 30;
      })
    : dashFilter === "pm"
    ? assets.filter(a => pmDueAssetIds.has(a.id))
    : assets;

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Asset Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track assets, calibration schedules and preventive maintenance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchStats(); fetchAssets(); }}
            className="p-2 rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground"
            title="Refresh" aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span><button onClick={() => setError("")}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm flex items-center justify-between">
          <span>{success}</span><button onClick={() => setSuccess("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="border border-border rounded-md p-4 bg-card">
          <p className="text-xs text-muted-foreground mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-foreground">{statsLoading ? "—" : stats?.total_assets ?? 0}</p>
        </div>

        <button
          onClick={() => setDashFilter(f => f === "calibration" ? null : "calibration")}
          className={`border rounded-md p-4 text-left transition-colors ${dashFilter === "calibration" ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20" : "border-border bg-card hover:border-amber-300"}`}>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Due for Calibration
          </p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {statsLoading ? "—" : (stats?.calibration_due ?? 0) + (stats?.calibration_overdue ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Within 30 days — click to filter</p>
        </button>

        <button
          onClick={() => setDashFilter(f => f === "pm" ? null : "pm")}
          className={`border rounded-md p-4 text-left transition-colors ${dashFilter === "pm" ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-border bg-card hover:border-blue-300"}`}>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Wrench className="w-3 h-3 text-blue-500" /> Due for Maintenance
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {statsLoading ? "—" : (stats?.pm_due ?? 0) + (stats?.pm_overdue ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Within 30 days — click to filter</p>
        </button>
      </div>

      {/* Calibration detail panel */}
      {dashFilter === "calibration" && stats && (
        <div className="mb-5 border border-amber-200 dark:border-amber-800 rounded-md overflow-hidden bg-amber-50/30 dark:bg-amber-900/10">
          <div className="px-4 py-2.5 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Calibration Due / Overdue</p>
            <button onClick={() => setDashFilter(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-900">
            {[...(stats.calibration_overdue_assets || []), ...(stats.calibration_due_assets || [])].map(a => {
              const d = daysUntil(a.calibration_due_date);
              return (
                <div key={a.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                  <span className="font-mono font-semibold text-foreground w-24 flex-shrink-0">{a.asset_id}</span>
                  <span className="text-foreground flex-1 truncate">{a.name}</span>
                  <span className={`text-xs font-medium ${d < 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtDate(a.calibration_due_date)}</span>
                </div>
              );
            })}
            {(stats.calibration_due_assets?.length + stats.calibration_overdue_assets?.length) === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground">No assets due for calibration within 30 days.</p>
            )}
          </div>
        </div>
      )}

      {/* PM detail panel */}
      {dashFilter === "pm" && stats && (
        <div className="mb-5 border border-blue-200 dark:border-blue-800 rounded-md overflow-hidden bg-blue-50/30 dark:bg-blue-900/10">
          <div className="px-4 py-2.5 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">Maintenance Due / Overdue</p>
            <button onClick={() => setDashFilter(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="divide-y divide-blue-100 dark:divide-blue-900">
            {[...(stats.pm_overdue_activities || []), ...(stats.pm_due_activities || [])].map(pm => {
              const d = daysUntil(pm.next_check_date);
              return (
                <div key={pm.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                  <span className="font-mono font-semibold text-foreground w-24 flex-shrink-0">{pm.asset_ref_id}</span>
                  <span className="text-foreground">{pm.asset_name}</span>
                  <span className="text-muted-foreground flex-1 truncate">— {pm.activity_name}</span>
                  <span className={`text-xs font-medium ${d < 0 ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
                    {d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtDate(pm.next_check_date)}</span>
                </div>
              );
            })}
            {(stats.pm_due_activities?.length + stats.pm_overdue_activities?.length) === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground">No maintenance due within 30 days.</p>
            )}
          </div>
        </div>
      )}

      {/* Asset Table */}
      <div className="border border-border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground w-8" />
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Asset ID</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Name / Model</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden sm:table-cell">Serial No.</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground hidden md:table-cell">Supplier</th>
              <th className="text-left px-4 py-2.5 text-xs font-mono tracking-widest uppercase text-muted-foreground">Calibration</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assetsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3.5 bg-muted rounded" /></td>
                  ))}
                </tr>
              ))
            ) : displayAssets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  {dashFilter ? "No assets match this filter." : "No assets yet. Click Add Asset to get started."}
                </td>
              </tr>
            ) : displayAssets.map((asset) => (
              <React.Fragment key={asset.id}>
                <tr
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(asset.id)}>
                  <td className="px-4 py-3">
                    <AssetPhotoThumb assetId={asset.id} hasPhoto={!!asset.photo_path} photoVersion={asset.updated_at} />
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-foreground text-xs">{asset.asset_id}</td>
                  <td className="px-4 py-3 text-foreground font-medium">{asset.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{asset.serial_number || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{asset.supplier || "—"}</td>
                  <td className="px-4 py-3">
                    <CalibBadge dueDate={asset.calibration_due_date} required={asset.calibration_required} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {expandedId === asset.id ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                  </td>
                </tr>

                {expandedId === asset.id && (
                  <tr>
                    <td colSpan={7} className="bg-muted/10 border-b border-border">
                      <AssetDetail
                        asset={asset}
                        pmList={pmMap[asset.id] || []}
                        pmLoading={pmLoading[asset.id]}
                        onEdit={() => openEdit(asset)}
                        onDelete={() => handleDeleteAsset(asset)}
                        onPhotoUpload={(file) => handlePhotoUpload(asset.id, file)}
                        photoUploading={photoUploading[asset.id]}
                        onViewPhoto={() => viewFile(`/assets/${asset.id}/photo`)}
                        onCertUpload={(file) => handleCertUpload(asset.id, file)}
                        certUploading={certUploading[asset.id]}
                        onViewCert={() => viewFile(`/assets/${asset.id}/certificate`)}
                        onDownloadCert={() => downloadFile(`/assets/${asset.id}/certificate`, `calibration-certificate-${asset.asset_id}.pdf`)}
                        onDownloadSticker={() => downloadFile(`/assets/${asset.id}/sticker`, `calib-sticker-${asset.asset_id}.pdf`)}
                        onCompleteCalib={() => openCalibComplete(asset)}
                        addingPm={addingPm === asset.id}
                        onStartAddPm={() => { setAddingPm(asset.id); setPmForm(EMPTY_PM); }}
                        onCancelAddPm={() => setAddingPm(null)}
                        pmForm={pmForm}
                        setPmForm={setPmForm}
                        onSavePm={() => handleAddPm(asset.id)}
                        pmSaving={pmSaving}
                        editingPm={editingPm?.asset_id === asset.id ? editingPm : null}
                        onStartEditPm={(pm) => setEditingPm({
                          asset_id: asset.id, pm_id: pm.id,
                          form: { activity_name: pm.activity_name, frequency_days: pm.frequency_days, last_check_date: pm.last_check_date || "" },
                        })}
                        onCancelEditPm={() => setEditingPm(null)}
                        onSaveEditPm={handleUpdatePm}
                        setEditingPmForm={(f) => setEditingPm(p => ({ ...p, form: f }))}
                        onDeletePm={(pmId) => handleDeletePm(asset.id, pmId)}
                        onCompletePm={(pm) => openPmComplete(asset.id, pm)}
                        onDownloadPmSticker={(pm) => downloadFile(`/assets/${asset.id}/pm/${pm.id}/sticker`, `pm-sticker-${asset.asset_id}-${pm.activity_name.slice(0, 20)}.pdf`)}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Asset Modal */}
      {assetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAssetModal(false)} />
          <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-lg z-10 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">{editingAsset ? "Edit Asset" : "Add New Asset"}</h3>
              <button onClick={() => setAssetModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            {formError && (
              <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">{formError}</div>
            )}

            <form onSubmit={handleSaveAsset} className="space-y-4">
              <div className="border border-border rounded-md p-4 space-y-3 bg-muted/20">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Asset Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Asset ID *" value={form.asset_id} onChange={v => setForm(f => ({ ...f, asset_id: v }))} placeholder="e.g. AST-001" />
                  <Field label="Name / Model *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Caliper 150mm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Serial Number" value={form.serial_number} onChange={v => setForm(f => ({ ...f, serial_number: v }))} placeholder="e.g. SN-123456" />
                  <Field label="Supplier" value={form.supplier} onChange={v => setForm(f => ({ ...f, supplier: v }))} placeholder="e.g. Mitutoyo" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Asset Photo (optional)</label>
                  {photoFile ? (
                    <div className="flex items-center gap-2 text-sm">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground truncate flex-1">{photoFile.name}</span>
                      <button type="button" onClick={() => setPhotoFile(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-md cursor-pointer hover:bg-muted/30 text-sm text-muted-foreground transition-colors">
                      <Upload className="w-4 h-4" /> Click to attach photo
                      <input type="file" accept="image/*" className="hidden" onChange={e => setPhotoFile(e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>

              <div className="border border-border rounded-md p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Calibration</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-muted-foreground">Required</span>
                    <div
                      onClick={() => setForm(f => ({ ...f, calibration_required: !f.calibration_required }))}
                      className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative ${form.calibration_required ? "bg-primary" : "bg-muted"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.calibration_required ? "left-[18px]" : "left-0.5"}`} />
                    </div>
                  </label>
                </div>
                {form.calibration_required && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Frequency (months)" type="number" min="1" value={form.calibration_frequency_months} onChange={v => setForm(f => ({ ...f, calibration_frequency_months: v }))} placeholder="e.g. 12" />
                      <Field label="Last Calibration Date" type="date" value={form.last_calibration_date} onChange={v => setForm(f => ({ ...f, last_calibration_date: v }))} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Calibration Due Date</p>
                      <div className="px-3 py-2 bg-background border border-border rounded-md text-sm font-mono text-primary">
                        {calcDueDate() || "— enter last date and frequency"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-md p-4 space-y-3 bg-muted/20">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Send Notification</p>
                <p className="text-xs text-muted-foreground">If filled, a notification will be sent on asset creation and calibration updates.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Notification Email" type="email" value={form.notification_email} onChange={v => setForm(f => ({ ...f, notification_email: v }))} placeholder="e.g. quality@company.com" />
                  <Field label="Phone (for future SMS)" type="tel" value={form.notification_phone} onChange={v => setForm(f => ({ ...f, notification_phone: v }))} placeholder="+1 555 000 0000" />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setAssetModal(false)}
                  className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted">Cancel</button>
                <button type="submit" disabled={formSaving}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50">
                  {formSaving ? "Saving…" : editingAsset ? "Update Asset" : "Create Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PM Completion Modal */}
      {pmCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPmCompleteModal(null)} />
          <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-sm z-10 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Complete PM Activity</h3>
              <button onClick={() => setPmCompleteModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Signing off: <span className="font-medium text-foreground">{pmCompleteModal.pm.activity_name}</span>
            </p>
            <div className="space-y-3">
              <Field label="Completed By *" value={pmCompleteForm.completed_by}
                onChange={v => setPmCompleteForm(f => ({ ...f, completed_by: v }))}
                placeholder="Your full name" />
              <Field label="Completion Date *" type="date" value={pmCompleteForm.completion_date}
                onChange={v => setPmCompleteForm(f => ({ ...f, completion_date: v }))} />
              <Field label="Password (electronic sign-off) *" type="password" value={pmCompleteForm.password}
                onChange={v => setPmCompleteForm(f => ({ ...f, password: v }))}
                placeholder="Enter your account password" />
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setPmCompleteModal(null)}
                className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted">Cancel</button>
              <button onClick={handlePmComplete} disabled={pmCompleting || !pmCompleteForm.completed_by || !pmCompleteForm.password}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                {pmCompleting ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing…</> : <><CheckCircle className="w-3.5 h-3.5" /> Sign Off</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calibration Completion Modal */}
      {calibCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCalibCompleteModal(null)} />
          <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-sm z-10 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Complete Calibration</h3>
              <button onClick={() => setCalibCompleteModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Signing off calibration for: <span className="font-medium text-foreground">{calibCompleteModal.asset_id} — {calibCompleteModal.name}</span>
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2 mb-4">
              A calibration certificate must be uploaded before signing off.
            </p>
            <div className="space-y-3">
              <Field label="Completed By *" value={calibCompleteForm.completed_by}
                onChange={v => setCalibCompleteForm(f => ({ ...f, completed_by: v }))}
                placeholder="Your full name" />
              <Field label="Completion Date *" type="date" value={calibCompleteForm.completion_date}
                onChange={v => setCalibCompleteForm(f => ({ ...f, completion_date: v }))} />
              <Field label="Password (electronic sign-off) *" type="password" value={calibCompleteForm.password}
                onChange={v => setCalibCompleteForm(f => ({ ...f, password: v }))}
                placeholder="Enter your account password" />
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setCalibCompleteModal(null)}
                className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted">Cancel</button>
              <button onClick={handleCalibComplete} disabled={calibCompleting || !calibCompleteForm.completed_by || !calibCompleteForm.password}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                {calibCompleting ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing…</> : <><CheckCircle className="w-3.5 h-3.5" /> Sign Off</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmPending}
        title={confirmPending?.title}
        message={confirmPending?.message}
        confirmLabel={confirmPending?.confirmLabel || "Delete"}
        onConfirm={confirmPending?.onConfirm}
        onCancel={() => setConfirmPending(null)}
      />
    </div>
  );
}

// ─── small form field helper ──────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", placeholder, min }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        min={min}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

// ─── Asset Detail (expanded row) ──────────────────────────────────────────────

function AssetDetail({
  asset, pmList, pmLoading,
  onEdit, onDelete,
  onPhotoUpload, photoUploading, onViewPhoto,
  onCertUpload, certUploading, onViewCert, onDownloadCert,
  onDownloadSticker, onCompleteCalib,
  addingPm, onStartAddPm, onCancelAddPm,
  pmForm, setPmForm, onSavePm, pmSaving,
  editingPm, onStartEditPm, onCancelEditPm, onSaveEditPm, setEditingPmForm,
  onDeletePm, onCompletePm, onDownloadPmSticker,
}) {
  return (
    <div className="px-6 py-5 space-y-5">
      {/* Top row: info + actions */}
      <div className="flex flex-wrap items-start gap-6 justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm">
          <InfoRow label="Asset ID" value={asset.asset_id} mono />
          <InfoRow label="Name / Model" value={asset.name} />
          <InfoRow label="Serial Number" value={asset.serial_number || "—"} mono />
          <InfoRow label="Supplier" value={asset.supplier || "—"} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-muted transition-colors">
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </div>

      {/* Photo row */}
      <div className="flex items-center gap-2">
        {asset.photo_path ? (
          <>
            <button onClick={onViewPhoto}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-muted transition-colors">
              <Eye className="w-3 h-3" /> View Photo
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-muted transition-colors cursor-pointer">
              {photoUploading ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload className="w-3 h-3" />}
              Replace Photo
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && onPhotoUpload(e.target.files[0])} />
            </label>
          </>
        ) : (
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-dashed border-border bg-background hover:bg-muted transition-colors cursor-pointer text-muted-foreground">
            {photoUploading ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <ImageIcon className="w-3 h-3" />}
            Upload Photo
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && onPhotoUpload(e.target.files[0])} />
          </label>
        )}
      </div>

      {/* Calibration section */}
      {asset.calibration_required && (
        <div className="border border-border rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Calibration</p>
            {asset.calibration_completed && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Completed by {asset.calibration_completed_by}
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <InfoRow label="Frequency" value={asset.calibration_frequency_months ? `${asset.calibration_frequency_months} months` : "—"} />
              <InfoRow label="Last Calibration" value={fmtDate(asset.last_calibration_date)} />
              <InfoRow label="Due Date" value={fmtDate(asset.calibration_due_date)} highlight={(() => {
                const d = daysUntil(asset.calibration_due_date);
                return d !== null && d <= 30 ? (d < 0 ? "red" : "amber") : null;
              })()} />
            </div>

            {/* Certificate */}
            <div className="pt-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Calibration Certificate</p>
              <div className="flex flex-wrap gap-1.5">
                <label className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-muted transition-colors cursor-pointer">
                  {certUploading ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload className="w-3 h-3" />}
                  {asset.calibration_certificate_path ? "Replace Certificate" : "Upload Certificate"}
                  <input type="file" accept=".pdf,image/*" className="hidden"
                    onChange={e => e.target.files[0] && onCertUpload(e.target.files[0])} />
                </label>
                {asset.calibration_certificate_path && (
                  <>
                    <button onClick={onViewCert}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-muted transition-colors">
                      <Eye className="w-3 h-3" /> View Certificate
                    </button>
                    <button onClick={onDownloadCert}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-muted transition-colors">
                      <Download className="w-3 h-3" /> Download Certificate
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Sign-off & sticker */}
            <div className="flex flex-wrap gap-1.5">
              {!asset.calibration_completed && asset.calibration_certificate_path && (
                <button onClick={onCompleteCalib}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                  <CheckCircle className="w-3 h-3" /> Complete Calibration
                </button>
              )}
              {!asset.calibration_completed && !asset.calibration_certificate_path && (
                <p className="text-xs text-muted-foreground italic">Upload a certificate first, then complete the sign-off to unlock the sticker.</p>
              )}
              {asset.calibration_completed && (
                <button onClick={onDownloadSticker}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 transition-colors">
                  <Printer className="w-3 h-3" /> Print Calibration Sticker
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PM Activities */}
      <div className="border border-border rounded-md overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preventive Maintenance</p>
          </div>
          {!addingPm && (
            <button onClick={onStartAddPm}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Plus className="w-3 h-3" /> Add Activity
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          {pmLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Loading…
            </div>
          ) : pmList.length === 0 && !addingPm ? (
            <p className="text-xs text-muted-foreground">No PM activities. Click Add Activity to create one.</p>
          ) : null}

          {pmList.map(pm => (
            editingPm?.pm_id === pm.id ? (
              <PmForm
                key={pm.id}
                form={editingPm.form}
                setForm={setEditingPmForm}
                onSave={onSaveEditPm}
                onCancel={onCancelEditPm}
                saving={pmSaving}
                isEdit
              />
            ) : (
              <PmRow
                key={pm.id}
                pm={pm}
                onEdit={() => onStartEditPm(pm)}
                onDelete={() => onDeletePm(pm.id)}
                onComplete={() => onCompletePm(pm)}
                onPrintSticker={() => onDownloadPmSticker(pm)}
              />
            )
          ))}

          {addingPm && (
            <PmForm
              form={pmForm}
              setForm={setPmForm}
              onSave={onSavePm}
              onCancel={onCancelAddPm}
              saving={pmSaving}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PM row ───────────────────────────────────────────────────────────────────

function PmRow({ pm, onEdit, onDelete, onComplete, onPrintSticker }) {
  const d = daysUntil(pm.next_check_date);
  const isOverdue = d !== null && d < 0;
  const isDue = d !== null && d <= 30 && d >= 0;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-background border border-border rounded-md text-sm flex-wrap">
      <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{pm.activity_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Every {pm.frequency_days} day{pm.frequency_days !== 1 ? "s" : ""}</p>
      </div>
      <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
        <span>Last: <span className="text-foreground">{fmtDate(pm.last_check_date)}</span></span>
        <span>Next:
          <span className={` ml-1 font-medium ${isOverdue ? "text-red-600 dark:text-red-400" : isDue ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
            {fmtDate(pm.next_check_date)}
          </span>
          {isOverdue && <span className="ml-1 text-red-500">({Math.abs(d)}d overdue)</span>}
          {isDue && !isOverdue && <span className="ml-1 text-amber-500">({d}d left)</span>}
        </span>
        {pm.last_completed_by && (
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> {pm.last_completed_by}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onComplete}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
          title="Complete PM">
          <CheckCircle className="w-3 h-3" /> Complete
        </button>
        {pm.last_completed_by && (
          <button onClick={onPrintSticker}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-blue-300 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="Print PM Sticker">
            <Printer className="w-3 h-3" /> Sticker
          </button>
        )}
        <button onClick={onEdit} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground" title="Edit">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── PM form (inline) ─────────────────────────────────────────────────────────

function PmForm({ form, setForm, onSave, onCancel, saving, isEdit }) {
  const calcNext = () => addDays(form.last_check_date, form.frequency_days);

  return (
    <div className="border border-primary/30 rounded-md bg-primary/5 p-4 space-y-3">
      <p className="text-xs font-semibold text-primary uppercase tracking-wider">{isEdit ? "Edit PM Activity" : "New PM Activity"}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Activity Name *</label>
          <input
            type="text"
            value={form.activity_name}
            onChange={e => setForm({ ...form, activity_name: e.target.value })}
            placeholder="e.g. Filter Replacement"
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Frequency (days) *</label>
          <input
            type="number"
            min="1"
            value={form.frequency_days}
            onChange={e => setForm({ ...form, frequency_days: e.target.value })}
            placeholder="e.g. 90"
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Last Check Date</label>
          <input
            type="date"
            value={form.last_check_date}
            onChange={e => setForm({ ...form, last_check_date: e.target.value })}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      {calcNext() && (
        <p className="text-xs text-muted-foreground">
          Next check: <span className="text-foreground font-medium font-mono">{calcNext()}</span>
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-md border border-input hover:bg-muted">Cancel</button>
        <button type="button" onClick={onSave} disabled={saving || !form.activity_name || !form.frequency_days}
          className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : isEdit ? "Update" : "Add Activity"}
        </button>
      </div>
    </div>
  );
}

// ─── info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono, highlight }) {
  const colorClass =
    highlight === "red" ? "text-red-600 dark:text-red-400 font-semibold" :
    highlight === "amber" ? "text-amber-600 dark:text-amber-400 font-semibold" :
    "text-foreground";
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm ${colorClass} ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}
