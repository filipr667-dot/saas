import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowLeft } from "lucide-react";

const CONTENT = {
  privacy: {
    title: "Privacy Policy",
    body: [
      "Lapis IMS stores the data your organisation enters — documents, training records, asset and calibration data, user accounts, and the audit trail of actions taken in the system — solely to provide the service to your organisation.",
      "Access is restricted by role-based permissions and protected by encrypted connections (HTTPS). Passwords are stored only as salted hashes and are never visible to us or your administrators.",
      "We do not sell your data or share it with third parties except the infrastructure providers required to run the service. Audit logs are retained to support quality-management and regulatory requirements.",
      "For data access, correction, or deletion requests, contact your system administrator or email support@lapisims.com.",
    ],
  },
  terms: {
    title: "Terms of Service",
    body: [
      "By using Lapis IMS you agree to use the system only for legitimate quality- and management-system activities within your organisation.",
      "Your organisation is responsible for the accuracy of the records it enters and for managing user access appropriately. Electronic signatures applied within the system are attributable to the signing user and are intended to support ISO 9001 and 21 CFR Part 11 workflows.",
      "The service is provided on an ongoing basis; we aim for high availability but do not guarantee uninterrupted access. Scheduled maintenance and updates may occur.",
      "For questions about these terms, email support@lapisims.com.",
    ],
  },
};

export default function LegalPage({ type }) {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/logo-light.png" : "/logo.png";
  const c = CONTENT[type] || CONTENT.privacy;
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-2xl mx-auto animate-[fadeUp_0.4s_ease-out]">
        <div className="flex items-center gap-3 mb-8">
          <img src={logoSrc} alt="Lapis IMS" className="h-10 w-auto object-contain" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1">{c.title}</h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated June 2026</p>
        <div className="space-y-4">
          {c.body.map((p, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
          ))}
        </div>
        <div className="mt-10">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
