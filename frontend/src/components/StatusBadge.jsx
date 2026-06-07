import React from "react";

const STATUS_CONFIG = {
  draft:            { label: "Draft",            dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" },
  under_review:     { label: "Under Review",     dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
  pending_approval: { label: "Pending Approval", dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" },
  active:           { label: "Effective",        dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
  review_due:       { label: "Review Due",       dot: "bg-orange-500",  badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800" },
  review_overdue:   { label: "Overdue",          dot: "bg-red-500",     badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
  rejected:         { label: "Rejected",         dot: "bg-red-500",     badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
  obsolete:         { label: "Obsolete",         dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700" },
};

export function StatusBadge({ status, className = "" }) {
  const cfg = STATUS_CONFIG[status] || { label: status, dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${cfg.badge} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default StatusBadge;
