
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Plus,
  CalendarDays,
  Wallet,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import api from "../api";
import "../workspace.css";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value ?? 0);

const monthNow = () => {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
};

const priorMonth = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
};

const palette = [
  "#0F372B",
  "#729A83",
  "#D4BA93",
  "#E8392B",
  "#A6B7B0",
  "#8C7A67",
];

function comparison(current, previous) {
  const delta = current - previous;

  if (!previous) {
    return current
      ? "No previous-month baseline"
      : "No activity in either month";
  }

  return `${
    delta >= 0 ? "+" : "−"
  }${money(Math.abs(delta))} (${Math.abs(
    (delta / previous) * 100
  ).toFixed(1)}%) vs last month`;
}

function Card({ label, value, note, featured, icon: Icon }) {
  const IconComponent = Icon;
  return (
    <div
      className={`sw-metric ${
        featured ? "sw-metric-featured" : ""
      }`}
    >
      <div className="sw-metric-top">
        <span>{label}</span>
        <IconComponent size={19} />
      </div>

      <strong>{money(value)}</strong>
      <small>{note}</small>
    </div>
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState(monthNow);
  const [summary, setSummary] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [budget, setBudget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [currentRes, previousRes, transactionsRes, budgetRes] =
          await Promise.all([
            api.get(`/summary/${month}`),
            api.get(`/summary/${priorMonth(month)}`),
            api.get("/transactions"),
            api.get(`/budgets/${month}`),
          ]);

        if (!alive) return;

        setSummary(currentRes.data);
        setPrevious(previousRes.data);
        setTransactions(transactionsRes.data);
        setBudget(budgetRes.data.budget || 0);
      } catch (err) {
        if (alive) {
          setError(
            err.response?.data?.error ||
              "Could not load financial overview."
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [month]);

  const categories = useMemo(
    () =>
      Object.entries(summary?.categories || {})
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    [summary]
  );

  const monthly = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const days = new Date(year, monthNumber, 0).getDate();

    const totals = Array.from({ length: days }, (_, index) => ({
      day: index + 1,
      income: 0,
      expenses: 0,
    }));

    for (const transaction of transactions) {
      if (!transaction.date?.startsWith(month)) continue;

      const day = Number(transaction.date.slice(8, 10)) - 1;

      if (totals[day]) {
        totals[day][
          transaction.type === "income" ? "income" : "expenses"
        ] += Number(transaction.amount);
      }
    }

    let income = 0;
    let expenses = 0;

    return totals.map((item) => {
      income += item.income;
      expenses += item.expenses;

      return {
        day: item.day,
        income,
        expenses,
      };
    });
  }, [transactions, month]);

  const recent = transactions
    .filter((transaction) => transaction.date?.startsWith(month))
    .slice(0, 5);

  const spent = summary?.expenses || 0;
  const progress = budget > 0 ? (spent / budget) * 100 : 0;

  return (
    <div className="page-stack sw-workspace">
      <div className="page-heading sw-heading">
        <div>
          <span className="eyebrow">
            YOUR MONEY, IN PERSPECTIVE
          </span>
          <h1>
            The overview<span className="sw-red">✦</span>
          </h1>
          <p>A clearer picture of every rupee, every month.</p>
        </div>

        <div className="heading-actions">
          <label className="month-control">
            <CalendarDays size={16} />
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              aria-label="Select month"
            />
          </label>

          <Link
            className="button-primary"
            to="/transactions?add=1"
          >
            <Plus size={17} />
            Add transaction
          </Link>
        </div>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty-text">
          Loading your financial overview…
        </p>
      ) : (
        <>
          <div className="sw-metrics">
            <Card
              featured
              label="Net cash flow"
              value={summary?.net_cash_flow}
              note={comparison(
                summary?.net_cash_flow || 0,
                previous?.net_cash_flow || 0
              )}
              icon={TrendingUp}
            />

            <Card
              label="Total income"
              value={summary?.income}
              note={comparison(
                summary?.income || 0,
                previous?.income || 0
              )}
              icon={ArrowDownLeft}
            />

            <Card
              label="Total expenses"
              value={summary?.expenses}
              note={comparison(
                spent,
                previous?.expenses || 0
              )}
              icon={ArrowUpRight}
            />
          </div>

          <div className="sw-dashboard-two">
            <section className="panel sw-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">
                    MONTHLY MOVEMENT
                  </span>
                  <h2>Cash-flow rhythm</h2>
                </div>
                <span className="sw-tiny">
                  CUMULATIVE · ₹
                </span>
              </div>

              <div className="sw-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthly}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 0,
                      bottom: 0,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="incomeFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#729A83"
                          stopOpacity={0.24}
                        />
                        <stop
                          offset="100%"
                          stopColor="#729A83"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 5"
                      vertical={false}
                      stroke="var(--border)"
                    />

                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />

                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={45}
                      tickFormatter={(value) =>
                        value >= 1000
                          ? `${Math.round(value / 1000)}k`
                          : value
                      }
                    />

                    <Tooltip
                      formatter={(value, name) => [
                        money(value),
                        name,
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="#729A83"
                      fill="url(#incomeFill)"
                      strokeWidth={2}
                      name="Income"
                    />

                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="#E8392B"
                      fill="transparent"
                      strokeWidth={2}
                      name="Expenses"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="sw-chart-legend">
                <span>
                  <i className="sw-dot sw-dot-green" />
                  Income
                </span>
                <span>
                  <i className="sw-dot sw-dot-red" />
                  Expenses
                </span>
              </div>
            </section>

            <section className="panel sw-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">
                    SPENDING BREAKDOWN
                  </span>
                  <h2>Where it went</h2>
                </div>
              </div>

              {categories.length ? (
                <>
                  <div className="sw-donut">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <PieChart>
                        <Pie
                          data={categories}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={69}
                          outerRadius={95}
                          paddingAngle={3}
                        >
                          {categories.map((category, index) => (
                            <Cell
                              key={category.name}
                              fill={
                                palette[index % palette.length]
                              }
                            />
                          ))}
                        </Pie>

                        <Tooltip
                          formatter={(value) => money(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="sw-donut-center">
                      <small>TOTAL SPENT</small>
                      <strong>{money(spent)}</strong>
                    </div>
                  </div>

                  <div className="sw-categories">
                    {categories.slice(0, 5).map((category, index) => (
                      <div key={category.name}>
                        <i
                          className="sw-dot"
                          style={{
                            background:
                              palette[index % palette.length],
                          }}
                        />
                        <span>{category.name}</span>
                        <strong>{money(category.value)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="empty-text">
                  No expenses this month yet.
                </p>
              )}
            </section>
          </div>

          <div className="sw-dashboard-two sw-bottom-grid">
            <section className="panel sw-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">
                    RECENT ACTIVITY
                  </span>
                  <h2>Latest transactions</h2>
                </div>

                <Link
                  to="/transactions"
                  className="text-link"
                >
                  View all <ArrowRight size={16} />
                </Link>
              </div>

              {recent.length ? (
                <div className="transaction-list">
                  {recent.map((transaction) => (
                    <div
                      className="transaction-row"
                      key={transaction.id}
                    >
                      <div
                        className={`transaction-icon ${transaction.type}`}
                      >
                        {transaction.type === "income" ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                      </div>

                      <div className="transaction-info">
                        <strong>
                          {transaction.description ||
                            transaction.category}
                        </strong>
                        <small>
                          {transaction.category} ·{" "}
                          {transaction.date}
                        </small>
                      </div>

                      <strong
                        className={`transaction-amount ${transaction.type}`}
                      >
                        {transaction.type === "income"
                          ? "+"
                          : "−"}
                        {money(transaction.amount)}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-text">
                  Nothing recorded for this month.
                </p>
              )}
            </section>

            <section className="panel sw-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">
                    MONTHLY LIMIT
                  </span>
                  <h2>Budget pulse</h2>
                </div>
                <Wallet size={20} />
              </div>

              {budget > 0 ? (
                <>
                  <div className="sw-budget-amount">
                    {money(spent)}
                    <span> / {money(budget)}</span>
                  </div>

                  <div
                    className="sw-progress"
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      style={{
                        width: `${Math.min(progress, 100)}%`,
                        background:
                          progress >= 100
                            ? "#E8392B"
                            : progress >= 80
                            ? "#C68B42"
                            : "#729A83",
                      }}
                    />
                  </div>

                  <p className="sw-budget-note">
                    {progress > 100
                      ? `${money(
                          spent - budget
                        )} over your monthly budget`
                      : progress === 100
                      ? "You've reached your budget"
                      : `${money(
                          Math.max(0, budget - spent)
                        )} left to spend`}
                    {" · "}
                    {progress.toFixed(0)}% used
                  </p>
                </>
              ) : (
                <>
                  <p className="sw-budget-note">
                    No overall budget set for {month}.
                  </p>
                  <Link
                    to="/budgets"
                    className="text-link"
                  >
                    Manage budgets <ArrowRight size={16} />
                  </Link>
                </>
              )}

              <div className="sw-top-category">
                <span>TOP SPENDING CATEGORY</span>
                <strong>
                  {categories[0]?.name || "No data yet"}
                </strong>
                <small>
                  {categories[0]
                    ? money(categories[0].value)
                    : "Add an expense to get started"}
                </small>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
