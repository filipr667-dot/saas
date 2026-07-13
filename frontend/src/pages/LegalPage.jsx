import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowLeft } from "lucide-react";

const PRIVACY = {
  title: "Privacy Policy",
  updated: "July 2026",
  sections: [
    {
      heading: "1. Who We Are",
      body: "Lapis IMS is a cloud-based Integrated Management System (IMS) provided as a software-as-a-service (SaaS) product. In the context of the General Data Protection Regulation (GDPR) and equivalent data protection legislation, Lapis IMS acts as a data processor on behalf of your organisation, which is the data controller.",
    },
    {
      heading: "2. Data We Process",
      body: "We process the following categories of personal data solely to deliver the service to your organisation:",
      list: [
        "User account data: name, email address, job title, department, phone number, and hashed password.",
        "Activity data: audit logs recording which user performed which action and when, including IP addresses at the time of login.",
        "Document control data: document metadata, revision history, and electronic signature records (signatory name, email, timestamp, and IP address).",
        "Training records: completion status, sign-off dates, and assigned documents per user.",
        "Asset and calibration records: equipment details, maintenance history, and assigned personnel.",
      ],
    },
    {
      heading: "3. Legal Basis for Processing",
      body: "We process personal data under the following lawful bases:",
      list: [
        "Contract performance: processing is necessary to provide the service your organisation has contracted for.",
        "Legitimate interests: audit logging and security monitoring to protect the integrity of the system and comply with quality management standards (ISO 9001, 21 CFR Part 11).",
        "Legal obligation: retaining electronic signature records as required by applicable regulatory frameworks.",
      ],
    },
    {
      heading: "4. Sub-Processors",
      body: "We use the following third-party infrastructure providers to operate the service. All sub-processors are contractually bound to process data only as instructed and to maintain appropriate security measures:",
      list: [
        "Render (render.com) — application hosting and compute. Servers located in the United States.",
        "MongoDB Atlas (mongodb.com) — database hosting. Region selected at account setup.",
        "Cloudflare R2 (cloudflare.com) — document and file storage.",
        "Resend (resend.com) — transactional email delivery (notifications, password resets).",
      ],
    },
    {
      heading: "5. Data Retention",
      body: "Data is retained for as long as your organisation's account is active. Upon account termination, all organisation data will be deleted within 30 days unless a longer retention period is required by law. Audit logs relating to electronic signatures may be retained for up to 7 years to support regulatory compliance. You may request earlier deletion by contacting support@lapisims.com.",
    },
    {
      heading: "6. Data Subject Rights",
      body: "Individuals whose data is processed have the following rights under GDPR (and equivalent laws). Requests should be directed to your organisation's system administrator, who is responsible as the data controller:",
      list: [
        "Right of access: obtain a copy of your personal data held in the system.",
        "Right to rectification: correct inaccurate personal data.",
        "Right to erasure: request deletion of your data where no legal retention obligation applies.",
        "Right to data portability: receive your data in a structured, machine-readable format.",
        "Right to object: object to processing based on legitimate interests.",
      ],
    },
    {
      heading: "7. Security",
      body: "We implement appropriate technical and organisational measures to protect personal data, including: TLS encryption in transit, bcrypt password hashing, role-based access control, session timeout, brute-force protection with account lockout, rate limiting on authentication endpoints, and audit logging of all significant actions. File storage uses server-side encryption at rest.",
    },
    {
      heading: "8. Session Storage",
      body: "Authentication tokens are stored in browser sessionStorage (not cookies) and are scoped to a single browser tab. No persistent tracking cookies are used. The system does not use third-party analytics, advertising pixels, or cross-site tracking.",
    },
    {
      heading: "9. International Transfers",
      body: "Some sub-processors operate infrastructure in the United States. Where personal data is transferred outside the European Economic Area, we rely on Standard Contractual Clauses (SCCs) or equivalent transfer mechanisms approved by the relevant supervisory authority.",
    },
    {
      heading: "10. Contact",
      body: "For privacy enquiries, data subject requests, or to report a data protection concern, contact: support@lapisims.com. If you are an EU/UK data subject and believe your rights have not been respected, you have the right to lodge a complaint with your national supervisory authority.",
    },
  ],
};

const TERMS = {
  title: "Terms of Service",
  updated: "July 2026",
  sections: [
    {
      heading: "1. Acceptance",
      body: "By accessing or using Lapis IMS you agree to be bound by these Terms of Service. If you are using the service on behalf of an organisation, you represent that you have authority to bind that organisation to these terms. If you do not agree, do not use the service.",
    },
    {
      heading: "2. Description of Service",
      body: "Lapis IMS provides a cloud-based Integrated Management System covering document control, training management, asset and calibration management, and audit trail functionality. The service is designed to support quality management frameworks including ISO 9001 and regulatory requirements including 21 CFR Part 11.",
    },
    {
      heading: "3. Accounts and Access",
      body: "Your organisation is responsible for:",
      list: [
        "Creating and managing user accounts and assigning appropriate roles.",
        "Maintaining the confidentiality of user credentials.",
        "All actions taken within the system by users of your account.",
        "Promptly deactivating accounts for users who leave your organisation.",
      ],
    },
    {
      heading: "4. Electronic Signatures",
      body: "The system provides electronic signature functionality intended to support ISO 9001 and 21 CFR Part 11 workflows. Each electronic signature is attributed to the authenticated user account at the time of signing, recorded with a timestamp and IP address, and stored in an immutable audit log. Your organisation is responsible for ensuring that the use of electronic signatures complies with any applicable regulatory requirements in your jurisdiction. Lapis IMS does not provide legal advice on regulatory compliance.",
    },
    {
      heading: "5. Acceptable Use",
      body: "You agree to use the service only for legitimate quality and management-system activities. You must not:",
      list: [
        "Use the service to process data that violates applicable laws.",
        "Attempt to circumvent security controls or access controls.",
        "Reverse-engineer, decompile, or attempt to extract the source code of the service.",
        "Use the service to store or transmit malicious code.",
        "Resell or sublicence access to the service without prior written agreement.",
      ],
    },
    {
      heading: "6. Data Ownership",
      body: "All data your organisation enters into the system remains owned by your organisation. We do not claim any intellectual property rights over your data. You grant us a limited licence to store and process your data solely to provide the service.",
    },
    {
      heading: "7. Availability and Maintenance",
      body: "We aim for high availability but do not guarantee uninterrupted access. Scheduled maintenance, updates, and events outside our control (including third-party infrastructure issues) may cause temporary unavailability. We will endeavour to provide advance notice of planned maintenance where practical.",
    },
    {
      heading: "8. Limitation of Liability",
      body: "To the maximum extent permitted by applicable law, Lapis IMS shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or loss of profits, data, or business, arising from your use of or inability to use the service. Our total aggregate liability shall not exceed the fees paid by your organisation in the 12 months preceding the claim.",
    },
    {
      heading: "9. Data Processing",
      body: "Our handling of personal data processed through the service is governed by our Privacy Policy, which forms part of these terms. Where required by GDPR or equivalent legislation, a Data Processing Agreement (DPA) is available on request at support@lapisims.com.",
    },
    {
      heading: "10. Termination",
      body: "Either party may terminate the service agreement with reasonable notice. Upon termination, you may request an export of your data. We will delete your organisation's data within 30 days of account closure, subject to any legal retention obligations.",
    },
    {
      heading: "11. Changes to Terms",
      body: "We may update these terms from time to time. We will notify account administrators by email of material changes at least 14 days before they take effect. Continued use of the service after the effective date constitutes acceptance of the updated terms.",
    },
    {
      heading: "12. Governing Law",
      body: "These terms are governed by the laws of the jurisdiction in which Lapis IMS is registered. Any disputes shall be subject to the exclusive jurisdiction of the courts of that jurisdiction, unless mandatory consumer protection laws in your jurisdiction require otherwise.",
    },
    {
      heading: "13. Contact",
      body: "For questions about these terms, email support@lapisims.com.",
    },
  ],
};

const CONTENT = { privacy: PRIVACY, terms: TERMS };

export default function LegalPage({ type }) {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/logo-light.png" : "/logo.png";
  const c = CONTENT[type] || CONTENT.privacy;

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <img src={logoSrc} alt="Lapis IMS" className="h-10 w-auto object-contain" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1">{c.title}</h1>
        <p className="text-xs text-muted-foreground mb-10">Last updated {c.updated}</p>

        <div className="space-y-8">
          {c.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-sm font-semibold text-foreground mb-2">{s.heading}</h2>
              {s.body && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-2">{s.body}</p>
              )}
              {s.list && (
                <ul className="list-disc list-outside ml-5 space-y-1.5">
                  {s.list.map((item, j) => (
                    <li key={j} className="text-sm text-muted-foreground leading-relaxed">{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
