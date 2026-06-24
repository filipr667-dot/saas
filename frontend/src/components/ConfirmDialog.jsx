import React from "react";
import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-md p-6 w-full max-w-sm z-10 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground leading-tight">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-md font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
