
import { useEffect, useState } from "react";
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  X,
} from "lucide-react";

import api from "../api";
import "../workspace.css";
import "../Budgets.css";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value ?? 0);

const currentMonth = () => {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
};

const presets = [
  "Food & Dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Health",
  "Education",
  "Entertainment",
  "Other",
];

const statuses = {
  healthy: "Within budget",
  warning: "Approaching limit",
  reached: "Limit reached",
  exceeded: "Over budget",
  not_set: "No budget set",
};

function BudgetProgress({ item }) {
  return (
    <div className="budget-progress-area">
      <div
        className="budget-progress-track"
        role="progressbar"
        aria-label="Budget used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(
          100,
          item.percentage
        )}
      >
        <div
          className={`budget-progress-fill ${item.status}`}
          style={{
            width: `${Math.min(
              100,
              item.percentage
            )}%`,
          }}
        />
      </div>

      <div className="budget-progress-labels">
        <span className={`budget-status ${item.status}`}>
          {statuses[item.status]}
        </span>

        <span>
          {item.percentage.toFixed(1)}% used
        </span>
      </div>
    </div>
  );
}

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;

    api
      .get(`/budget-overview/${month}`)
      .then((response) => {
        if (!active) return;

        setData(response.data);
        setError("");
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err.response?.data?.error ||
            "Could not load budgets."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [month, refresh]);

  function reload() {
    setLoading(true);
    setRefresh((value) => value + 1);
  }

  function openOverall() {
    setFormError("");
    setAmount(data?.overall.budget || "");
    setModal("overall");
  }

  function openCategory(item = null) {
    setFormError("");
    setCategory(item?.category || "");
    setAmount(item?.budget || "");

    setModal(
      item ? "edit-category" : "category"
    );
  }

  function closeModal() {
    if (saving) return;

    setModal(null);
    setFormError("");
  }

  async function save(event) {
    event.preventDefault();

    setSaving(true);
    setFormError("");

    try {
      if (modal === "overall") {
        await api.put(`/budgets/${month}`, {
          amount,
        });
      } else {
        await api.put(
          `/category-budgets/${month}`,
          {
            category: category.trim(),
            amount,
          }
        );
      }

      setModal(null);
      reload();
    } catch (err) {
      setFormError(
        err.response?.data?.error ||
          "Could not save budget."
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(item = null) {
    const name = item
      ? item.category
      : "overall monthly";

    if (!window.confirm(`Remove ${name} budget?`)) {
      return;
    }

    setError("");

    try {
      const url = item
        ? `/category-budgets/${month}/${item.category_id}`
        : `/budgets/${month}`;

      await api.delete(url);

      reload();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not remove budget."
      );
    }
  }

  const overall = data?.overall;

  const activeBudgets =
    data?.categories.filter(
      (item) => item.budget > 0
    ) || [];

  const unbudgeted =
    data?.categories.filter(
      (item) =>
        item.budget === 0 && item.spent > 0
    ) || [];

  const categoryOptions = [
    ...new Set([
      ...presets,
      ...(data?.categories.map(
        (item) => item.category
      ) || []),
    ]),
  ].sort();

  return (
    <div className="page-stack sw-workspace">
      <div className="page-heading sw-heading">
        <div>
          <span className="eyebrow">
            SPEND WITH INTENTION
          </span>

          <h1>
            Budgets
            <span className="sw-red">✦</span>
          </h1>

          <p>Give every rupee a purpose.</p>
        </div>

        <div className="heading-actions">
          <label className="month-control">
            <CalendarDays size={16} />

            <input
              type="month"
              value={month}
              aria-label="Budget month"
              onChange={(event) => {
                if (!event.target.value) return;

                setLoading(true);
                setMonth(event.target.value);
              }}
            />
          </label>

          <button
            className="button-primary"
            onClick={() => openCategory()}
            disabled={loading}
          >
            <Plus size={17} />
            Category budget
          </button>
        </div>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty-text">
          Loading your budgets…
        </p>
      ) : data && data.month === month ? (
        <>
          <section className="budget-hero">
            <div className="budget-hero-header">
              <div>
                <span>THE BIG PICTURE</span>
                <h2>Monthly spending limit</h2>
              </div>

              <Wallet size={26} />
            </div>

            <div className="budget-hero-amount">
              {money(overall.spent)}

              <span>
                {overall.budget
                  ? ` / ${money(overall.budget)}`
                  : " spent this month"}
              </span>
            </div>

            {overall.budget > 0 ? (
              <>
                <BudgetProgress item={overall} />

                <p className="budget-remaining">
                  {overall.remaining < 0
                    ? `${money(
                        Math.abs(overall.remaining)
                      )} over budget`
                    : `${money(
                        overall.remaining
                      )} remaining`}
                </p>
              </>
            ) : (
              <p className="budget-remaining">
                Set a monthly limit to start
                tracking your spending.
              </p>
            )}

            <div className="budget-hero-actions">
              <button
                className="budget-light-button"
                onClick={openOverall}
              >
                {overall.budget ? (
                  <Pencil size={15} />
                ) : (
                  <Plus size={15} />
                )}

                {overall.budget
                  ? "Edit monthly limit"
                  : "Set monthly limit"}
              </button>

              {overall.budget > 0 && (
                <button
                  className="budget-remove-button"
                  onClick={() => remove()}
                  aria-label="Remove monthly budget"
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </section>

          <div className="budget-summary-grid">
            <div className="panel budget-summary">
              <span className="eyebrow">
                CATEGORY ALLOCATION
              </span>

              <strong>
                {money(data.allocated)}
              </strong>

              <small>
                Across {activeBudgets.length} budgets
              </small>
            </div>

            <div className="panel budget-summary">
              <span className="eyebrow">
                UNALLOCATED BUDGET
              </span>

              <strong>
                {data.unallocated === null
                  ? "—"
                  : money(data.unallocated)}
              </strong>

              <small>
                {data.unallocated === null
                  ? "Set an overall limit first"
                  : data.unallocated < 0
                  ? "Category limits exceed overall limit"
                  : "Available for other categories"}
              </small>
            </div>
          </div>

          {data.unallocated !== null &&
            data.unallocated < 0 && (
              <p className="budget-allocation-warning">
                Your category budgets exceed your
                overall monthly limit by{" "}
                {money(Math.abs(data.unallocated))}.
              </p>
            )}

          <section className="page-stack">
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  THE LITTLE DETAILS
                </span>

                <h2>Category budgets</h2>
              </div>

              <button
                className="text-link"
                onClick={() => openCategory()}
              >
                <Plus size={16} />
                Add budget
              </button>
            </div>

            {activeBudgets.length ? (
              <div className="budget-category-grid">
                {activeBudgets.map((item) => (
                  <article
                    className="panel budget-category-card"
                    key={item.category_id}
                  >
                    <div className="budget-card-header">
                      <h3>{item.category}</h3>

                      <div className="budget-card-actions">
                        <button
                          className="icon-button"
                          onClick={() =>
                            openCategory(item)
                          }
                          aria-label={`Edit ${item.category} budget`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="icon-button delete-button"
                          onClick={() => remove(item)}
                          aria-label={`Remove ${item.category} budget`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="budget-card-amount">
                      {money(item.spent)}

                      <span>
                        / {money(item.budget)}
                      </span>
                    </div>

                    <BudgetProgress item={item} />

                    <p className="budget-card-remaining">
                      {item.remaining < 0
                        ? `${money(
                            Math.abs(item.remaining)
                          )} over budget`
                        : `${money(
                            item.remaining
                          )} remaining`}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="panel sw-empty">
                <Wallet size={30} />

                <p>No category budgets yet.</p>

                <button
                  className="button-primary"
                  onClick={() => openCategory()}
                >
                  <Plus size={16} />
                  Create your first budget
                </button>
              </div>
            )}
          </section>

          {unbudgeted.length > 0 && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">
                    KEEP AN EYE ON THESE
                  </span>

                  <h2>Unbudgeted spending</h2>
                </div>
              </div>

              {unbudgeted.map((item) => (
                <div
                  className="transaction-row"
                  key={item.category_id}
                >
                  <div className="transaction-info">
                    <strong>{item.category}</strong>
                    <small>No spending limit set</small>
                  </div>

                  <strong className="transaction-amount">
                    {money(item.spent)}
                  </strong>

                  <button
                    className="text-link"
                    onClick={() => openCategory(item)}
                  >
                    Set limit
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      ) : (
        <div className="panel sw-empty">
          <p>Budget information is unavailable.</p>

          <button
            className="button-primary"
            onClick={reload}
          >
            Try again
          </button>
        </div>
      )}

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="budget-modal-title"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  PLAN WITH PURPOSE
                </span>

                <h2 id="budget-modal-title">
                  {modal === "overall"
                    ? "Monthly spending limit"
                    : "Category budget"}
                </h2>
              </div>

              <button
                className="icon-button"
                onClick={closeModal}
                aria-label="Close"
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="transaction-form"
              onSubmit={save}
            >
              <label>
                Month
                <input
                  value={month}
                  readOnly
                />
              </label>

              {modal !== "overall" && (
                <label>
                  Category

                  <input
                    required
                    maxLength={100}
                    list="budget-categories"
                    value={category}
                    readOnly={
                      modal === "edit-category"
                    }
                    onChange={(event) =>
                      setCategory(event.target.value)
                    }
                    placeholder="Choose or enter a category"
                  />

                  <datalist id="budget-categories">
                    {categoryOptions.map((name) => (
                      <option
                        key={name}
                        value={name}
                      />
                    ))}
                  </datalist>
                </label>
              )}

              <label>
                Spending limit (₹)

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  placeholder="0.00"
                />
              </label>

              {formError && (
                <p
                  className="error-message"
                  role="alert"
                >
                  {formError}
                </p>
              )}

              <button
                className="button-primary form-submit"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save budget"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
