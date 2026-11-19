
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  SlidersHorizontal,
} from "lucide-react";

import api from "../api";
import "../workspace.css";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(value || 0);

const today = () => {
  const date = new Date();

  return new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
};

const blank = () => ({
  type: "expense",
  amount: "",
  category: "",
  subcategory: "",
  description: "",
  date: today(),
});

const presets = {
  expense: [
    "Food & Dining",
    "Groceries",
    "Transport",
    "Shopping",
    "Bills & Utilities",
    "Health",
    "Education",
    "Entertainment",
    "Other",
  ],
  income: [
    "Salary",
    "Freelance",
    "Allowance",
    "Gift",
    "Other",
  ],
};

const displayDate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function Transactions() {
  const [params, setParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState("newest");

  async function load() {
    try {
      const response = await api.get("/transactions");

      setItems(response.data);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not load transactions."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    api
      .get("/transactions")
      .then((response) => {
        if (active) setItems(response.data);
      })
      .catch(() => {
        if (active) {
          setError("Could not load transactions.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (params.get("add") === "1") {
      setEditing(null);
      setForm(blank());
      setOpen(true);

      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete("add");
          return next;
        },
        { replace: true }
      );
    }
  }, [params, setParams]);

  function startAdd() {
    setError("");
    setEditing(null);
    setForm(blank());
    setOpen(true);
  }

  function startEdit(transaction) {
    setError("");
    setEditing(transaction.id);

    setForm({
      type: transaction.type,
      amount: String(transaction.amount),
      category: transaction.category,
      subcategory: transaction.subcategory || "",
      description: transaction.description || "",
      date: transaction.date,
    });

    setOpen(true);
  }

  function close() {
    if (!saving) {
      setOpen(false);
      setEditing(null);
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (editing !== null) {
        await api.put(`/transactions/${editing}`, form);
      } else {
        await api.post("/transactions", form);
      }

      setOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not save transaction."
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(transaction) {
    const confirmed = window.confirm(
      `Delete ${
        transaction.description || transaction.category
      } (${money(transaction.amount)}) permanently?`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/transactions/${transaction.id}`);
      await load();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not delete transaction."
      );
    }
  }

  const categories = useMemo(
    () =>
      [...new Set(items.map((item) => item.category))].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    return items
      .filter((transaction) => {
        const query = search.trim().toLowerCase();

        const matchesSearch =
          !query ||
          [
            transaction.description,
            transaction.category,
            transaction.subcategory,
            String(transaction.amount),
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(query)
          );

        const matchesType =
          type === "all" || transaction.type === type;

        const matchesCategory =
          category === "all" ||
          transaction.category === category;

        const matchesMonth =
          !month || transaction.date.startsWith(month);

        return (
          matchesSearch &&
          matchesType &&
          matchesCategory &&
          matchesMonth
        );
      })
      .sort((a, b) => {
        if (sort === "oldest") {
          return (
            a.date.localeCompare(b.date) ||
            a.id - b.id
          );
        }

        if (sort === "highest") {
          return b.amount - a.amount;
        }

        if (sort === "lowest") {
          return a.amount - b.amount;
        }

        return (
          b.date.localeCompare(a.date) ||
          b.id - a.id
        );
      });
  }, [items, search, type, category, month, sort]);

  const grouped = useMemo(() => {
    const map = new Map();

    for (const transaction of filtered) {
      if (!map.has(transaction.date)) {
        map.set(transaction.date, []);
      }

      map.get(transaction.date).push(transaction);
    }

    return [...map.entries()];
  }, [filtered]);

  const totalExpense = filtered
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalIncome = filtered
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <div className="page-stack sw-workspace">
      <div className="page-heading sw-heading">
        <div>
          <span className="eyebrow">THE MONEY LEDGER</span>
          <h1>
            Transactions<span className="sw-red">✦</span>
          </h1>
          <p>Every rupee has a story. Here's yours.</p>
        </div>

        <button className="button-primary" onClick={startAdd}>
          <Plus size={17} />
          Add transaction
        </button>
      </div>

      <div className="sw-ledger-stats">
        <div>
          <small>RECORDS SHOWN</small>
          <strong>{filtered.length}</strong>
        </div>

        <div>
          <small>INCOME SHOWN</small>
          <strong>{money(totalIncome)}</strong>
        </div>

        <div>
          <small>EXPENSES SHOWN</small>
          <strong>{money(totalExpense)}</strong>
        </div>
      </div>

      <section className="panel sw-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">FIND WHAT MATTERS</span>
            <h2>Transaction history</h2>
          </div>
          <SlidersHorizontal size={19} />
        </div>

        <div className="sw-filters">
          <label className="sw-search">
            <Search size={17} />
            <input
              aria-label="Search transactions"
              placeholder="Search description, category, amount…"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>

          <select
            aria-label="Filter type"
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
          >
            <option value="all">All types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>

          <select
            aria-label="Filter category"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value)
            }
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <input
            aria-label="Filter month"
            type="month"
            value={month}
            onChange={(event) =>
              setMonth(event.target.value)
            }
          />

          <select
            aria-label="Sort transactions"
            value={sort}
            onChange={(event) =>
              setSort(event.target.value)
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest amount</option>
            <option value="lowest">Lowest amount</option>
          </select>
        </div>

        {error && !open && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="empty-text">
            Loading transactions…
          </p>
        ) : !filtered.length ? (
          <div className="sw-empty">
            <p>
              {items.length
                ? "No transactions match these filters."
                : "Your ledger is ready. Add your first transaction."}
            </p>

            {items.length ? (
              <button
                className="text-link"
                onClick={() => {
                  setSearch("");
                  setType("all");
                  setCategory("all");
                  setMonth("");
                  setSort("newest");
                }}
              >
                Clear filters
              </button>
            ) : (
              <button
                className="button-primary"
                onClick={startAdd}
              >
                Add first transaction
              </button>
            )}
          </div>
        ) : (
          grouped.map(([date, records]) => (
            <div className="sw-date-group" key={date}>
              <h3>
                {displayDate(date)}
                <span>
                  {records.length}{" "}
                  {records.length === 1
                    ? "entry"
                    : "entries"}
                </span>
              </h3>

              <div className="transaction-list">
                {records.map((transaction) => (
                  <div
                    className="transaction-row sw-ledger-row"
                    key={transaction.id}
                  >
                    <div
                      className={`transaction-icon ${transaction.type}`}
                    >
                      {transaction.type === "income" ? (
                        <ArrowDownLeft size={19} />
                      ) : (
                        <ArrowUpRight size={19} />
                      )}
                    </div>

                    <div className="transaction-info">
                      <strong>
                        {transaction.description ||
                          transaction.category}
                      </strong>

                      <small>
                        {transaction.category}
                        {transaction.subcategory
                          ? ` · ${transaction.subcategory}`
                          : ""}
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

                    <button
                      className="icon-button"
                      aria-label={`Edit transaction ${transaction.id}`}
                      title="Edit"
                      onClick={() =>
                        startEdit(transaction)
                      }
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      className="icon-button delete-button"
                      aria-label={`Delete transaction ${transaction.id}`}
                      title="Delete"
                      onClick={() =>
                        remove(transaction)
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {open && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
        >
          <div
            className="modal-card sw-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sw-modal-title"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  {editing !== null
                    ? "UPDATE ENTRY"
                    : "NEW ENTRY"}
                </span>

                <h2 id="sw-modal-title">
                  {editing !== null
                    ? "Edit transaction"
                    : "Add transaction"}
                </h2>
              </div>

              <button
                className="icon-button"
                onClick={close}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="transaction-form"
              onSubmit={save}
            >
              <label>
                Type
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      type: event.target.value,
                      category: "",
                    })
                  }
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>

              <label>
                Amount (₹)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      amount: event.target.value,
                    })
                  }
                  placeholder="0.00"
                />
              </label>

              <label>
                Category
                <input
                  required
                  list="sw-category-options"
                  value={form.category}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category: event.target.value,
                    })
                  }
                  placeholder="Choose or enter your own"
                />

                <datalist id="sw-category-options">
                  {presets[form.type].map((item) => (
                    <option
                      key={item}
                      value={item}
                    />
                  ))}
                </datalist>
              </label>

              <label>
                Subcategory
                <span className="sw-optional">
                  (optional)
                </span>
                <input
                  value={form.subcategory}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      subcategory: event.target.value,
                    })
                  }
                  placeholder="e.g. Coffee"
                />
              </label>

              <label>
                Date
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      date: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Description
                <span className="sw-optional">
                  (optional)
                </span>
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  placeholder="What was this for?"
                />
              </label>

              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}

              <button
                className="button-primary form-submit"
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : editing !== null
                  ? "Save changes"
                  : "Add transaction"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
