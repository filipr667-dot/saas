import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FileText, Users, ClipboardList, Shield, Wrench, BarChart3,
  CheckCircle, Lock, Globe, ArrowRight, Menu, X, Award,
  ChevronRight, Zap, Eye, Database, AlertTriangle,
} from "lucide-react";

// ── Scroll animation ───────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function FadeIn({ children, delay = 0, y = 28, className = "" }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      style={{
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
        opacity: inView ? 1 : 0,
        transform: inView ? "none" : `translateY(${y}px)`,
      }}
      className={className}
    >
      {children}
    </div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "Standards", href: "#standards" },
    { label: "Security", href: "#security" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#030d1f]/90 backdrop-blur-md shadow-lg shadow-black/20" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <img src="/logo-light.png" alt="Lapis IMS" className="h-12 w-auto" />

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(({ label, href }) => (
            <a key={label} href={href} className="text-sm text-white/65 hover:text-white transition-colors">
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm text-white/75 hover:text-white transition-colors px-4 py-2">
            Login
          </Link>
          <a
            href="mailto:support@lapisims.com?subject=Demo Request — Lapis IMS"
            className="text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25"
          >
            Book a Demo
          </a>
        </div>

        <button className="md:hidden text-white p-2" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-[#030d1f] border-t border-white/10 px-6 py-4 space-y-3">
          {navLinks.map(({ label, href }) => (
            <a key={label} href={href} className="block text-sm text-white/65 hover:text-white py-1" onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            <Link to="/login" className="text-sm text-white/75 text-center py-2">Login</Link>
            <a
              href="mailto:support@lapisims.com?subject=Demo Request — Lapis IMS"
              className="text-sm font-medium bg-blue-600 text-white text-center py-2.5 rounded-lg"
            >
              Book a Demo
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

// ── Hero mockup ────────────────────────────────────────────────────────────
function DashboardMockup() {
  const docs = [
    { name: "Quality Policy", code: "POL-001", status: "Active", dot: "bg-green-400" },
    { name: "Risk Assessment Procedure", code: "PROC-012", status: "Review Due", dot: "bg-yellow-400" },
    { name: "EHS Manual", code: "MAN-001", status: "Active", dot: "bg-green-400" },
    { name: "Emergency Response WI", code: "WI-004", status: "Active", dot: "bg-green-400" },
    { name: "Supplier Approval Form", code: "FORM-008", status: "Draft", dot: "bg-blue-400" },
  ];

  const statusClass = {
    Active: "bg-green-500/15 text-green-400",
    "Review Due": "bg-yellow-500/15 text-yellow-400",
    Draft: "bg-blue-500/15 text-blue-400",
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-90" />

      {/* Main card */}
      <div className="relative bg-[#0a1a35]/80 backdrop-blur-sm border border-white/10 rounded-2xl p-5 shadow-2xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-white/70">Document Control</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-white/8 flex items-center justify-center">
              <div className="w-2 h-0.5 bg-white/40 rounded" />
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 mb-3">
          <div className="w-3 h-3 rounded-full border border-white/30" />
          <div className="h-1.5 bg-white/15 rounded flex-1" />
        </div>

        {/* Rows */}
        {docs.map((doc, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${doc.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white/80 truncate">{doc.name}</div>
              <div className="text-xs text-white/35 font-mono">{doc.code}</div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${statusClass[doc.status]}`}>
              {doc.status}
            </span>
          </div>
        ))}
      </div>

      {/* Floating badges */}
      <div
        className="absolute -top-5 -right-5 bg-blue-600 text-white text-xs font-medium px-3 py-2 rounded-xl shadow-lg flex items-center gap-2"
        style={{ animation: "lapsFloat 3s ease-in-out infinite" }}
      >
        <CheckCircle className="w-3.5 h-3.5" />
        ISO 9001 Ready
      </div>

      <div
        className="absolute -bottom-5 -left-5 bg-[#0a1a35] border border-white/10 text-white text-xs font-medium px-3 py-2 rounded-xl shadow-lg flex items-center gap-2"
        style={{ animation: "lapsFloat 3s ease-in-out 0.7s infinite" }}
      >
        <Shield className="w-3.5 h-3.5 text-blue-400" />
        94% Training Compliance
      </div>
    </div>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center bg-[#030d1f] overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-1/4 -left-40 w-[500px] h-[500px] bg-blue-700/20 rounded-full blur-3xl" style={{ animation: "lapsPulse 5s ease-in-out infinite" }} />
      <div className="absolute bottom-1/4 -right-40 w-[500px] h-[500px] bg-indigo-700/15 rounded-full blur-3xl" style={{ animation: "lapsPulse 5s ease-in-out 1.5s infinite" }} />
      <div className="absolute top-2/3 left-1/2 w-64 h-64 bg-blue-900/30 rounded-full blur-2xl" />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-32 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <Zap className="w-3 h-3" />
              Enterprise IMS Platform
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6 tracking-tight">
              Integrated Management{" "}
              <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                Systems Made Simple
              </span>
            </h1>

            <p className="text-lg text-white/55 leading-relaxed mb-10 max-w-lg">
              Control documents, training, compliance, audits, risks, and assets
              from a single platform built for quality and safety teams.
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href="mailto:support@lapisims.com?subject=Demo Request — Lapis IMS"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/30"
              >
                Book a Demo
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 bg-white/6 hover:bg-white/10 border border-white/10 text-white font-medium px-7 py-3.5 rounded-xl transition-all duration-200"
              >
                See Features
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Mockup */}
          <div className="hidden lg:block">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: FileText,
    color: "blue",
    title: "Document Control",
    desc: "Manage the full lifecycle of controlled documents — version control, approval workflows, and distributed access in one place.",
    points: ["Version control & revision history", "Multi-stage approval workflows", "Controlled distribution", "Full-text search & retrieval"],
  },
  {
    icon: Users,
    color: "indigo",
    title: "Training & Competency",
    desc: "Track employee training, manage competency matrices, and receive automated reminders before certifications expire.",
    points: ["Training matrix by role & department", "Certification & expiry tracking", "Automated reminder emails", "Sign-off & acknowledgement records"],
  },
  {
    icon: ClipboardList,
    color: "violet",
    title: "Audits & Inspections",
    desc: "Plan internal audits, manage findings, assign corrective actions, and track closure through to completion.",
    points: ["Audit planning & scheduling", "Non-conformance management", "Corrective action tracking", "Performance dashboards"],
  },
  {
    icon: AlertTriangle,
    color: "purple",
    title: "Risk Management",
    desc: "Maintain risk registers, score and prioritise risks, and monitor mitigation plans across your organisation.",
    points: ["Risk registers", "Risk scoring & prioritisation", "Mitigation plan tracking", "Compliance oversight"],
  },
  {
    icon: Wrench,
    color: "sky",
    title: "Asset & Equipment Management",
    desc: "Manage your asset register, schedule preventive maintenance, and track calibration due dates automatically.",
    points: ["Asset registers & tagging", "Preventive maintenance scheduling", "Calibration tracking", "Equipment lifecycle management"],
  },
  {
    icon: BarChart3,
    color: "cyan",
    title: "Audit Trail & Reporting",
    desc: "Every action is logged automatically. Demonstrate due diligence with immutable records ready for external auditors.",
    points: ["Immutable audit logs", "Full user activity tracking", "Exportable compliance reports", "Role-based access control"],
  },
];

const COLORS = {
  blue:   { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20",   hover: "group-hover:border-blue-500/50" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", hover: "group-hover:border-indigo-500/50" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20", hover: "group-hover:border-violet-500/50" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", hover: "group-hover:border-purple-500/50" },
  sky:    { bg: "bg-sky-500/10",    text: "text-sky-400",    border: "border-sky-500/20",    hover: "group-hover:border-sky-500/50" },
  cyan:   { bg: "bg-cyan-500/10",   text: "text-cyan-400",   border: "border-cyan-500/20",   hover: "group-hover:border-cyan-500/50" },
};

function FeatureCard({ feature, index }) {
  const c = COLORS[feature.color];
  const Icon = feature.icon;
  return (
    <FadeIn delay={index * 70} className="h-full">
      <div className="group h-full bg-white dark:bg-white/4 border border-slate-200 dark:border-white/8 rounded-2xl p-6 hover:border-blue-400/40 dark:hover:border-blue-500/30 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-blue-500/8 transition-all duration-300 cursor-default">
        <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-5`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
        <p className="text-sm text-slate-500 dark:text-white/45 leading-relaxed mb-4">{feature.desc}</p>
        <ul className="space-y-2">
          {feature.points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-xs text-slate-600 dark:text-white/55">
              <CheckCircle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </FadeIn>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-slate-50 dark:bg-[#060f1e]">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Platform</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            Everything your team needs
          </h2>
          <p className="mt-4 text-slate-500 dark:text-white/45 max-w-xl mx-auto text-base leading-relaxed">
            One platform to manage your entire integrated management system — no spreadsheets, no filing cabinets, no silos.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} feature={f} index={i} />)}
        </div>
      </div>
    </section>
  );
}

// ── Standards ──────────────────────────────────────────────────────────────
const STANDARDS = [
  { code: "ISO 9001", name: "Quality Management", desc: "Document control, audits, and corrective actions built around QMS requirements." },
  { code: "ISO 14001", name: "Environmental Management", desc: "Environmental risk registers, compliance monitoring, and EHS documentation." },
  { code: "ISO 45001", name: "Occupational H&S", desc: "Safety training, incident tracking, and health & safety competency records." },
  { code: "ISO 27001", name: "Information Security", desc: "Asset registers, access control documentation, and information security workflows." },
  { code: "IMS", name: "Integrated Management", desc: "Combine multiple standards into one unified system — reduce duplication, increase efficiency." },
];

function StandardsSection() {
  return (
    <section id="standards" className="py-24 bg-white dark:bg-[#030d1f]">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Standards</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            Built for compliance
          </h2>
          <p className="mt-4 text-slate-500 dark:text-white/45 max-w-xl mx-auto">
            Lapis IMS is designed around internationally recognised management system standards — not retrofitted to them.
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STANDARDS.map((std, i) => (
            <FadeIn key={std.code} delay={i * 80}>
              <div className="flex gap-4 p-5 rounded-2xl border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/4 hover:border-blue-400/50 dark:hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 cursor-default">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{std.code}</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1.5">{std.name}</div>
                  <div className="text-xs text-slate-500 dark:text-white/45 leading-relaxed">{std.desc}</div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Trust ──────────────────────────────────────────────────────────────────
const TRUST = [
  { icon: Lock,          title: "Enterprise-grade security",   desc: "JWT authentication, bcrypt password hashing, and encrypted data in transit via TLS." },
  { icon: Eye,           title: "Complete audit trails",       desc: "Every action is logged automatically. Full traceability for auditors and regulators." },
  { icon: Users,         title: "Role-based access control",   desc: "Granular permissions ensure users only access what they need — admin, reviewer, readonly, and more." },
  { icon: Database,      title: "Secure cloud infrastructure", desc: "Hosted on enterprise cloud infrastructure with MongoDB Atlas data storage." },
  { icon: Shield,        title: "Compliance-first workflows",  desc: "Workflows designed around ISO requirements from the ground up — not bolted on as an afterthought." },
  { icon: Globe,         title: "Multi-organisation ready",    desc: "Full multi-tenancy with complete data isolation between organisations." },
];

function TrustSection() {
  return (
    <section id="security" className="py-24 bg-slate-50 dark:bg-[#060f1e]">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Security</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            Built for enterprise trust
          </h2>
          <p className="mt-4 text-slate-500 dark:text-white/45 max-w-xl mx-auto">
            Security and compliance aren't afterthoughts — they're the foundation of how Lapis IMS is designed and built.
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TRUST.map((item, i) => {
            const Icon = item.icon;
            return (
              <FadeIn key={item.title} delay={i * 60}>
                <div className="flex gap-4 p-5 rounded-2xl bg-white dark:bg-white/4 border border-slate-200 dark:border-white/8 hover:border-blue-400/40 dark:hover:border-blue-500/25 transition-all duration-300 hover:-translate-y-1 cursor-default">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{item.title}</div>
                    <div className="text-xs text-slate-500 dark:text-white/45 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── CTA ────────────────────────────────────────────────────────────────────
function CTASection() {
  return (
    <section className="py-28 bg-[#030d1f] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-blue-600/12 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            Ready to modernise your management system?
          </h2>
          <p className="text-white/55 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Book a personalised demo and see how Lapis IMS can transform the way your team manages compliance.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:support@lapisims.com?subject=Demo Request — Lapis IMS"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/30"
            >
              Book a Demo
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-white/6 hover:bg-white/10 border border-white/10 text-white font-medium px-8 py-3.5 rounded-xl transition-colors duration-200"
            >
              Login to your account
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "Standards", href: "#standards" },
        { label: "Security", href: "#security" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Contact", href: "mailto:support@lapisims.com" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
    {
      title: "Account",
      links: [
        { label: "Login", href: "/login" },
        { label: "Book a Demo", href: "mailto:support@lapisims.com?subject=Demo Request — Lapis IMS" },
      ],
    },
  ];

  return (
    <footer className="bg-[#020a17] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <img src="/logo-light.png" alt="Lapis IMS" className="h-7 w-auto mb-4" />
            <p className="text-xs text-white/35 leading-relaxed max-w-xs">
              Enterprise integrated management system platform for quality, safety, and compliance teams.
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">{col.title}</div>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link to={link.href} className="text-xs text-white/35 hover:text-white/65 transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-xs text-white/35 hover:text-white/65 transition-colors">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-7 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">© {new Date().getFullYear()} Lapis IMS. All rights reserved.</p>
          <div className="flex items-center gap-1.5 text-xs text-white/25">
            <Shield className="w-3 h-3" />
            <span>Enterprise-grade security</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="min-h-screen">
      <style>{`
        @keyframes lapsFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes lapsPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <StandardsSection />
      <TrustSection />
      <CTASection />
      <Footer />
    </div>
  );
}
