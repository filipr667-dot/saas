import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard, FileText, Users, Settings, ClipboardList,
  Sun, Moon, LogOut, Menu, Search, Building2, GraduationCap,
  LayoutGrid, Wrench, ChevronDown, SlidersHorizontal, ShieldAlert, UserX, BookOpen,
} from "lucide-react";

const ROLE_LABELS = {
  admin: "Administrator",
  author: "Author",
  reviewer: "Reviewer",
  approver: "Approver",
  readonly: "Read Only",
  training_coordinator: "Training Coordinator",
  document_controller: "Document Controller",
  asset_coordinator: "Asset Coordinator",
  super_admin: "Super Admin",
};

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getRoleLabel(user) {
  if (!user) return "";
  const systemLabel = ROLE_LABELS[user.role] || user.role;
  const docRoles = (user.doc_roles || []).map(r => ROLE_LABELS[r] || r);
  return [systemLabel, ...docRoles].join(" · ");
}

export default function Layout({ children }) {
  const { user, logout, impersonating, stopImpersonation, hasRole, hasModule } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [openGroups, setOpenGroups] = useState(() => {
    const defaults = {};
    const docPaths = ["/dashboard", "/documents"];
    const trainingPaths = ["/my-training", "/training-matrix"];
    defaults["documents"] = docPaths.some(p => location.pathname.startsWith(p));
    defaults["training"] = trainingPaths.some(p => location.pathname.startsWith(p));
    return defaults;
  });

  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleSearch = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/documents?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  // Pure read-only: role is readonly and no doc_roles assigned
  const isPureReadOnly = user?.role === "readonly" && !(user?.doc_roles || []).length;
  const hasDocRole = hasRole("author", "reviewer", "approver", "document_controller");

  // Nav structure — visibility driven by hasRole() and hasModule()
  const NAV = [
    {
      type: "item",
      path: "/library",
      label: "Document Library",
      icon: BookOpen,
      visible: true,
    },
    {
      type: "group",
      key: "documents",
      label: "Document Control",
      icon: FileText,
      visible: !isPureReadOnly,
      matchPaths: ["/dashboard", "/documents"],
      children: [
        { path: "/dashboard", label: "Document Control", icon: LayoutDashboard, visible: true },
        { path: "/documents", label: "Document Workflow", icon: FileText, visible: hasRole("admin") || hasDocRole },
        { path: "/documents/settings", label: "Document Settings", icon: SlidersHorizontal, visible: hasRole("admin", "document_controller") },
      ],
    },
    {
      type: "group",
      key: "training",
      label: "Training",
      icon: GraduationCap,
      visible: true,
      matchPaths: ["/my-training", "/training-matrix"],
      children: [
        { path: "/my-training", label: "My Training", icon: GraduationCap, visible: true },
        { path: "/training-matrix", label: "Training Matrix", icon: LayoutGrid, visible: hasRole("admin", "training_coordinator") },
      ],
    },
    {
      type: "item",
      path: "/assets",
      label: "Asset Management",
      icon: Wrench,
      visible: hasModule("asset_management") || hasRole("asset_coordinator"),
    },
    {
      type: "item",
      path: "/audit",
      label: "Audit Trail",
      icon: ClipboardList,
      visible: hasModule("audit_trail"),
    },
    {
      type: "item",
      path: "/settings",
      label: "User Settings",
      icon: Settings,
      visible: hasRole("admin"),
    },
    {
      type: "item",
      path: "/superadmin",
      label: "Super Admin",
      icon: ShieldAlert,
      visible: user?.role === "super_admin",
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Branding */}
      <div className="flex items-center justify-center px-4 h-20 border-b border-slate-800 flex-shrink-0">
        <img
          src="/logo-light.png"
          alt="Lapis IMS"
          className="h-16 w-auto object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.nextSibling.style.display = "block";
          }}
        />
        <span style={{ display: "none" }} className="text-sm font-bold text-white tracking-wide">Lapis IMS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-3 mb-3">Navigation</p>

        {NAV.map((item) => {
          if (!item.visible) return null;

          if (item.type === "item") {
            const Icon = item.icon;
            const active = location.pathname === item.path ||
              (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-100
                  ${active ? "bg-teal-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          }

          if (item.type === "group") {
            const Icon = item.icon;
            const groupActive = item.matchPaths?.some((p) => location.pathname.startsWith(p));
            const isOpen = openGroups[item.key];
            const visibleChildren = (item.children || []).filter(c => c.visible);
            if (visibleChildren.length === 0) return null;

            return (
              <div key={item.key}>
                <button
                  onClick={() => toggleGroup(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-100
                    ${groupActive && !isOpen ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="ml-3 mt-0.5 pl-3 border-l border-slate-700 space-y-0.5">
                    {visibleChildren.map((child) => {
                      const CIcon = child.icon;
                      const childActive = location.pathname === child.path ||
                        (child.path === "/documents" && location.pathname.startsWith("/documents/") && !location.pathname.startsWith("/documents/settings")) ||
                        (child.path !== "/documents" && child.path !== "/dashboard" && location.pathname.startsWith(child.path));
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors duration-100
                            ${childActive ? "bg-teal-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
                        >
                          <CIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-slate-800 px-3 py-3 space-y-1 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
          <span className="text-xs text-slate-500 truncate">{user?.department || "My Organisation"}</span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{initials(user?.name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate leading-none">{user?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{getRoleLabel(user)}</p>
          </div>
        </div>
        <button
          data-testid="logout-btn"
          onClick={handleLogout}
          aria-label="Sign out"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Impersonation banner */}
      {impersonating && (
        <div className="w-full bg-amber-500 text-amber-950 text-xs font-medium flex items-center justify-between px-4 py-1.5 z-50">
          <span className="flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5" />
            Impersonating <strong>{impersonating.name}</strong> — actions will appear as this user
          </span>
          <button
            onClick={stopImpersonation}
            className="px-2.5 py-1 rounded bg-amber-700 text-white text-xs hover:bg-amber-800 transition-colors"
          >
            Stop Impersonating
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-56 bg-slate-900 flex-shrink-0">
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/70" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-56 bg-slate-900 z-50 flex flex-col">
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 flex items-center gap-3 px-5 h-14 border-b border-border bg-card flex-shrink-0">
            <button
              data-testid="mobile-menu-btn"
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden sm:flex flex-1 max-w-md items-center relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Search documents…"
                aria-label="Global search"
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-muted/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-colors"
              />
            </div>

            <div className="flex-1" />

            <button
              data-testid="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2.5 pl-3 border-l border-border">
              <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">{initials(user?.name)}</span>
              </div>
              <div className="hidden md:block leading-none">
                <p className="text-xs font-semibold text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[user?.role] || user?.role}</p>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 md:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
