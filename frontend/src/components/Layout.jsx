import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard, FileText, Users, Settings, ClipboardList,
  Sun, Moon, LogOut, Menu, Shield, Search, Building2,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "author", "reviewer", "approver", "readonly"] },
  { path: "/documents", label: "Documents", icon: FileText, roles: ["admin", "author", "reviewer", "approver", "readonly"] },
  { path: "/audit", label: "Audit Trail", icon: ClipboardList, roles: ["admin"] },
  { path: "/users", label: "User Management", icon: Users, roles: ["admin"] },
  { path: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

const ROLE_LABELS = {
  admin: "Administrator",
  author: "Author",
  reviewer: "Reviewer",
  approver: "Approver",
  readonly: "Read Only",
};

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Branding */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-slate-800 flex-shrink-0">
        <div className="w-7 h-7 bg-teal-500 rounded-md flex items-center justify-center flex-shrink-0">
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-none tracking-tight">DocControl</p>
          <p className="text-xs text-slate-500 mt-0.5">QMS Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-3 mb-3">Navigation</p>
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-100
                ${active
                  ? "bg-teal-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Org + User + Logout */}
      <div className="border-t border-slate-800 px-3 py-3 space-y-1 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
          <span className="text-xs text-slate-500 truncate">{user?.department || "My Organization"}</span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{initials(user?.name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate leading-none">{user?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{ROLE_LABELS[user?.role]}</p>
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
    <div className="min-h-screen bg-background flex">
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
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center gap-3 px-5 h-14 border-b border-border bg-card flex-shrink-0">
          <button
            data-testid="mobile-menu-btn"
            aria-label="Open navigation menu"
            title="Open navigation menu"
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
              placeholder="Search documents, users, events…"
              aria-label="Global search — press Enter to search documents"
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-muted/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-colors"
            />
          </div>

          <div className="flex-1" />

          <button
            data-testid="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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
              <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[user?.role]}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
