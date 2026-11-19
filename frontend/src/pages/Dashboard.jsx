
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, ArrowDownRight, Activity,
  Plus, ArrowRight, CalendarDays
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie,
  Cell, Tooltip
} from "recharts";
import api from "../api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

const initialMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const colors = ["#0F372B", "#A4B6A5", "#D7C6A8", "#E8392B", "#778E82"];

export default function Dashboard() {
  const [month, setMonth] = useState(initialMonth);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [summaryRes, transactionsRes] = await Promise.all([
          api.get(`/summary/${month}`),
          api.get("/transactions"),
        ]);
        if (!active) return;
        setSummary(summaryRes.data);
        setTransactions(
          transactionsRes.data.filter((t) => t.date.startsWith(month))
        );
        setError("");
      } catch {
        if (active) setError("Unable to load dashboard data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [month]);

  const categories = Object.entries(summary?.categories || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const topCategory = categories[0];

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR FINANCIAL OVERVIEW</span>
          <h1>Good to have you here.</h1>
          <p>A clearer picture of your money, all in one place.</p>
        </div>
        <div className="heading-actions">
          <label className="month-control">
            <CalendarDays size={17} />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Select month"
            />
          </label>
          <Link to="/transactions" className="button-primary">
            <Plus size={17} /> Add transaction
          </Link>
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="metrics-grid">
        <div className="metric-card metric-featured">
          <div className="metric-label">Net cash flow <Activity size={18} /></div>
          <div className="metric-value">
            {loading ? "—" : money(summary?.net_cash_flow)}
          </div>
          <div className="metric-footer">Income minus expenses this month</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">
            Total income <ArrowDownRight size={19} />
          </div>
          <div className="metric-value">
            {loading ? "—" : money(summary?.income)}
          </div>
          <div className="metric-footer">Money received this month</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">
            Total expenses <ArrowUpRight size={19} />
          </div>
          <div className="metric-value">
            {loading ? "—" : money(summary?.expenses)}
          </div>
          <div className="metric-footer">Money spent this month</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">SPENDING BREAKDOWN</span>
              <h2>Where your money goes</h2>
            </div>
          </div>
          {categories.length ? (
            <div className="chart-layout">
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={245}>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={75}
                      outerRadius={104}
                      paddingAngle={3}
                    >
                      {categories.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={colors[index % colors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => money(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="category-legend">
                {categories.slice(0, 5).map((item, index) => (
                  <div className="legend-row" key={item.name}>
                    <span
                      className="legend-dot"
                      style={{ background: colors[index % colors.length] }}
                    />
                    <span>{item.name}</span>
                    <strong>{money(item.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty-text">No expenses recorded for this month.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">QUICK INSIGHT</span>
              <h2>Top spending category</h2>
            </div>
          </div>
          <div className="insight-content">
            <span className="insight-label">HIGHEST EXPENSE CATEGORY</span>
            <h3>{topCategory?.name || "No data yet"}</h3>
            <div className="insight-amount">
              {topCategory ? money(topCategory.value) : "—"}
            </div>
            <p>
              {topCategory
                ? "Your largest category of spending for the selected month."
                : "Add an expense to see your spending insights."}
            </p>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">ACTIVITY</span>
            <h2>Recent transactions</h2>
          </div>
          <Link to="/transactions" className="text-link">
            View all <ArrowRight size={16} />
          </Link>
        </div>
        {transactions.length ? (
          <div className="transaction-list">
            {transactions.slice(0, 5).map((tx) => (
              <div className="transaction-row" key={tx.id}>
                <div className={`transaction-icon ${tx.type}`}>
                  {tx.type === "income"
                    ? <ArrowDownRight size={19} />
                    : <ArrowUpRight size={19} />}
                </div>
                <div className="transaction-info">
                  <strong>{tx.description || tx.category}</strong>
                  <small>{tx.category} · {tx.date}</small>
                </div>
                <strong className={`transaction-amount ${tx.type}`}>
                  {tx.type === "income" ? "+" : "−"}{money(tx.amount)}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">
            {loading ? "Loading transactions..." : "No transactions this month."}
          </p>
        )}
      </section>
    </div>
  );
}