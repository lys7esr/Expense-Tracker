
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import AppLayout from "./components/AppLayout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Goals from "./pages/Goals";

import "./App.css";

function ComingSoon({ title }) {
  return (
    <section className="panel empty-panel">
      <span className="eyebrow">COMING SOON</span>
      <h2>{title}</h2>
      <p>This workspace is planned for a later phase.</p>
    </section>
  );
}

export default function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("spendwise-theme") || "light"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("spendwise-theme", theme);
  }, [theme]);

  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<Landing />} />

      {/* Existing application */}
      <Route
        element={
          <AppLayout
            theme={theme}
            toggleTheme={() =>
              setTheme((current) =>
                current === "light" ? "dark" : "light"
              )
            }
          />
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/people" element={<ComingSoon title="People & Money" />} />
        <Route path="/recurring" element={<ComingSoon title="Recurring" />} />
        <Route path="/reports" element={<ComingSoon title="Reports" />} />
        <Route path="/settings" element={<ComingSoon title="Settings" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
