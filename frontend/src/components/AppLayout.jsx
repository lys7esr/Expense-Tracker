
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ArrowLeftRight, Wallet,
  Target, Users, Repeat2, ChartNoAxesCombined,
  Settings, Moon, Sun, Menu, X, Bell,
  Landmark, ChevronRight
} from "lucide-react";

const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Transactions", path: "/transactions", icon: ArrowLeftRight },
  { label: "Budgets", path: "/budgets", icon: Wallet },
  { label: "Savings Goals", path: "/goals", icon: Target },
  { label: "People & Money", path: "/people", icon: Users },
  { label: "Recurring", path: "/recurring", icon: Repeat2 },
  { label: "Reports", path: "/reports", icon: ChartNoAxesCombined },
];

export default function AppLayout({ theme, toggleTheme }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const active = navigation.find(
    (item) => item.path === location.pathname
  );

  const navLink = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) =>
        `nav-link ${isActive ? "active" : ""}`
      }
    >
      <item.icon size={19} strokeWidth={1.8} />
      <span>{item.label}</span>
      <ChevronRight size={15} className="nav-chevron" />
    </NavLink>
  );

  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Landmark size={23} /></div>
          <div>
            <strong>SpendWise<span className="brand-dot">.</span></strong>
            <small>PERSONAL FINANCE</small>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="sidebar-nav">
          {navigation.map(navLink)}
        </nav>

        <div className="sidebar-bottom">
          <NavLink
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className="nav-link"
          >
            <Settings size={19} />
            <span>Settings</span>
          </NavLink>
          <div className="profile">
            <div className="avatar">SW</div>
            <div>
              <strong>Local Workspace</strong>
              <small>Development mode</small>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">Workspace</span>
            <ChevronRight size={14} className="muted-icon" />
            <strong>{active?.label || "Settings"}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              title="Toggle theme"
            >
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <span className="notification-icon" title="Notifications coming soon">
              <Bell size={19} />
            </span>
            <div className="topbar-avatar">SW</div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}