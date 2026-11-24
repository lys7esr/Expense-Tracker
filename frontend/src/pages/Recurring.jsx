
import { useEffect, useState } from "react";
import {
  Repeat2,
  Plus,
  Pencil,
  Trash2,
  Pause,
  Play,
  X,
  History,
  CalendarDays,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
} from "lucide-react";

import api from "../api";
import "../workspace.css";
import "../Recurring.css";


const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value ?? 0);


const today = () => {
  const now = new Date();

  return new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
};


const emptySchedule = () => ({
  name: "",
  type: "expense",
  amount: "",
  category: "",
  frequency: "monthly",
  next_due_date: today(),
  description: "",
});


const statusLabels = {
  overdue: "Overdue",
  due: "Due today",
  upcoming: "Upcoming",
  scheduled: "Scheduled",
  paused: "Paused",
};


const frequencies = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];


const categories = {
  expense: [
    "Food & Dining",
    "Groceries",
    "Transport",
    "Shopping",
    "Bills & Utilities",
    "Housing",
    "Entertainment",
    "Education",
    "Health",
    "Other",
  ],

  income: [
    "Salary",
    "Freelance",
    "Allowance",
    "Other",
  ],
};


export default function Recurring() {
  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState("all");

  const [modal, setModal] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState(emptySchedule);

  const [payment, setPayment] = useState({
    amount: "",
    date: today(),
  });

  const [historyId, setHistoryId] = useState(null);


  useEffect(() => {
    let active = true;

    api
      .get("/recurring")
      .then((response) => {
        if (!active) return;

        setData(response.data);
        setError("");
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err.response?.data?.error ||
            "Could not load recurring schedules."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refresh]);


  function reload() {
    setLoading(true);
    setRefresh((value) => value + 1);
  }


  function startSchedule(schedule = null) {
    setFormError("");
    setSelectedId(schedule?.id || null);

    setForm(
      schedule
        ? {
            name: schedule.name,
            type: schedule.type,
            amount: schedule.amount,
            category: schedule.category,
            frequency: schedule.frequency,
            next_due_date: schedule.next_due_date,
            description: schedule.description,
          }
        : emptySchedule()
    );

    setModal(schedule ? "edit" : "create");
  }


  function startPayment(schedule) {
    setFormError("");
    setSelectedId(schedule.id);

    setPayment({
      amount: schedule.amount,
      date: today(),
    });

    setModal("confirm");
  }


  function closeModal() {
    if (saving) return;

    setModal(null);
    setSelectedId(null);
    setFormError("");
  }


  async function saveSchedule(event) {
    event.preventDefault();

    setSaving(true);
    setFormError("");

    try {
      if (modal === "edit") {
        await api.put(
          `/recurring/${selectedId}`,
          form
        );
      } else {
        await api.post("/recurring", form);
      }

      setModal(null);
      setSelectedId(null);
      reload();

    } catch (err) {
      setFormError(
        err.response?.data?.error ||
          "Could not save schedule."
      );

    } finally {
      setSaving(false);
    }
  }


  async function confirmPayment(event) {
    event.preventDefault();

    if (!selectedSchedule || saving) return;

    setSaving(true);
    setFormError("");

    try {
      await api.post(
        `/recurring/${selectedId}/process`,
        {
          action: "confirm",
          due_date: selectedSchedule.next_due_date,
          ...payment,
        }
      );

      setModal(null);
      setSelectedId(null);
      reload();

    } catch (err) {
      setFormError(
        err.response?.data?.error ||
          "Could not confirm payment."
      );

    } finally {
      setSaving(false);
    }
  }


  async function skipPayment(schedule) {
    if (saving) return;

    if (
      !window.confirm(
        `Skip the ${schedule.next_due_date} occurrence of ${schedule.name}?`
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await api.post(
        `/recurring/${schedule.id}/process`,
        {
          action: "skip",
          due_date: schedule.next_due_date,
        }
      );

      reload();

    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not skip payment."
      );

    } finally {
      setSaving(false);
    }
  }


  async function toggleSchedule(schedule) {
    if (saving) return;

    setSaving(true);

    try {
      await api.patch(
        `/recurring/${schedule.id}/active`,
        {
          active: !schedule.active,
        }
      );

      reload();

    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not update schedule."
      );

    } finally {
      setSaving(false);
    }
  }


  async function removeSchedule(schedule) {
    if (saving) return;

    if (
      !window.confirm(
        `Delete "${schedule.name}" and its schedule history? Existing transactions will remain.`
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await api.delete(
        `/recurring/${schedule.id}`
      );

      reload();

    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not delete schedule."
      );

    } finally {
      setSaving(false);
    }
  }


  const schedules = data?.schedules || [];

  const selectedSchedule = schedules.find(
    (item) => item.id === selectedId
  );

  const dueSchedules = schedules.filter(
    (item) =>
      item.active && item.days_until_due <= 0
  );

  const visibleSchedules = schedules.filter(
    (item) => {
      if (filter === "all") return true;

      if (filter === "active") return item.active;

      if (filter === "paused") return !item.active;

      return item.type === filter;
    }
  );


  return (
    <div className="page-stack sw-workspace">
      <div className="page-heading sw-heading">
        <div>
          <span className="eyebrow">
            STAY ONE STEP AHEAD
          </span>

          <h1>
            Recurring
            <span className="sw-red">✦</span>
          </h1>

          <p>Predictable payments. No surprises.</p>
        </div>

        <button
          className="button-primary"
          disabled={saving}
          onClick={() => startSchedule()}
        >
          <Plus size={17} />
          New schedule
        </button>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty-text">
          Loading recurring schedules…
        </p>
      ) : !data ? (
        <div className="panel sw-empty">
          <p>Recurring schedules are unavailable.</p>

          <button
            className="button-primary"
            onClick={reload}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <section className="recurring-hero">
            <div className="recurring-hero-top">
              <span>
                ESTIMATED MONTHLY COMMITMENTS
              </span>

              <Repeat2 size={25} />
            </div>

            <strong>
              {money(data.monthly_expenses)}
            </strong>

            <p>
              {data.active_count} active schedules
              {" · "}
              Average monthly estimate
            </p>

            <div className="recurring-hero-stats">
              <div>
                <small>RECURRING INCOME</small>

                <b>
                  {money(data.monthly_income)}
                </b>
              </div>

              <div>
                <small>EXPECTED NET</small>

                <b>
                  {money(data.monthly_net)}
                </b>
              </div>

              <div>
                <small>PAYMENTS DUE</small>

                <b>{data.due_count}</b>
              </div>
            </div>
          </section>

          {/* Payments requiring attention */}

          <section className="page-stack">
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  YOUR ATTENTION PLEASE
                </span>

                <h2>Needs your attention</h2>
              </div>

              <span className="recurring-due-count">
                {dueSchedules.length} due
              </span>
            </div>

            {!dueSchedules.length ? (
              <div className="panel recurring-clear">
                <CheckCircle2 size={24} />

                <div>
                  <strong>You're all caught up.</strong>

                  <p>
                    No recurring payments need
                    confirmation right now.
                  </p>
                </div>
              </div>
            ) : (
              <div className="recurring-due-list">
                {dueSchedules.map((schedule) => (
                  <article
                    className="panel recurring-due-card"
                    key={schedule.id}
                  >
                    <div className="recurring-due-main">
                      <div className="recurring-icon">
                        <Clock size={22} />
                      </div>

                      <div className="recurring-info">
                        <h3>{schedule.name}</h3>

                        <p>
                          {schedule.category}
                          {" · "}
                          {schedule.frequency}
                        </p>

                        <span className="recurring-overdue">
                          {schedule.days_until_due < 0
                            ? `${Math.abs(
                                schedule.days_until_due
                              )} days overdue`
                            : "Due today"}
                        </span>
                      </div>

                      <strong className="recurring-amount">
                        {schedule.type === "income"
                          ? "+"
                          : ""}

                        {money(schedule.amount)}
                      </strong>
                    </div>

                    <div className="recurring-due-actions">
                      <button
                        className="button-primary"
                        disabled={saving}
                        onClick={() =>
                          startPayment(schedule)
                        }
                      >
                        <CheckCircle2 size={16} />

                        {schedule.type === "income"
                          ? "Confirm received"
                          : "Confirm payment"}
                      </button>

                      <button
                        className="recurring-secondary"
                        disabled={saving}
                        onClick={() =>
                          skipPayment(schedule)
                        }
                      >
                        Skip
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* All recurring schedules */}

          <section className="page-stack">
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  YOUR FINANCIAL ROUTINE
                </span>

                <h2>Your schedules</h2>
              </div>
            </div>

            <div className="recurring-filters">
              {[
                "all",
                "expense",
                "income",
                "active",
                "paused",
              ].map((item) => (
                <button
                  key={item}
                  className={
                    filter === item ? "active" : ""
                  }
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                >
                  {item === "all"
                    ? "All schedules"
                    : item.charAt(0).toUpperCase() +
                      item.slice(1)}
                </button>
              ))}
            </div>

            {!visibleSchedules.length ? (
              <div className="panel sw-empty">
                <Repeat2 size={34} />

                <h3>
                  {schedules.length
                    ? "No matching schedules."
                    : "Make your money predictable."}
                </h3>

                <p>
                  {schedules.length
                    ? "Try selecting another filter."
                    : "Track your subscriptions, bills and regular income."}
                </p>

                {!schedules.length && (
                  <button
                    className="button-primary"
                    onClick={() => startSchedule()}
                  >
                    <Plus size={16} />
                    Create a schedule
                  </button>
                )}
              </div>
            ) : (
              <div className="recurring-grid">
                {visibleSchedules.map((schedule) => (
                  <article
                    className="panel recurring-card"
                    key={schedule.id}
                  >
                    <div className="recurring-card-top">
                      <div className="recurring-icon">
                        {schedule.type === "income" ? (
                          <ArrowDownLeft size={22} />
                        ) : (
                          <ArrowUpRight size={22} />
                        )}
                      </div>

                      <div className="recurring-card-actions">
                        <button
                          className="icon-button"
                          disabled={saving}
                          aria-label={
                            schedule.active
                              ? "Pause schedule"
                              : "Resume schedule"
                          }
                          onClick={() =>
                            toggleSchedule(schedule)
                          }
                        >
                          {schedule.active ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>

                        <button
                          className="icon-button"
                          disabled={saving}
                          aria-label="Edit schedule"
                          onClick={() =>
                            startSchedule(schedule)
                          }
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="icon-button delete-button"
                          disabled={saving}
                          aria-label="Delete schedule"
                          onClick={() =>
                            removeSchedule(schedule)
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <h3>{schedule.name}</h3>

                    <p className="recurring-category">
                      {schedule.category}
                      {" · "}
                      {schedule.type}
                    </p>

                    <div className="recurring-card-amount">
                      {money(schedule.amount)}

                      <span>
                        / {schedule.frequency}
                      </span>
                    </div>

                    <span
                      className={`recurring-status ${schedule.status}`}
                    >
                      {statusLabels[schedule.status]}
                    </span>

                    <div className="recurring-details">
                      <div>
                        <CalendarDays size={15} />

                        Next due: {schedule.next_due_date}
                      </div>

                      <div>
                        <Repeat2 size={15} />

                        Monthly estimate:{" "}

                        <strong>
                          {money(
                            schedule.monthly_equivalent
                          )}
                        </strong>
                      </div>

                      {schedule.description && (
                        <p>{schedule.description}</p>
                      )}
                    </div>

                    <button
                      className="text-link"
                      onClick={() =>
                        setHistoryId(
                          historyId === schedule.id
                            ? null
                            : schedule.id
                        )
                      }
                    >
                      <History size={16} />

                      {historyId === schedule.id
                        ? "Hide history"
                        : "Payment history"}
                    </button>

                    {historyId === schedule.id && (
                      <div className="recurring-history">
                        {!schedule.history.length ? (
                          <p className="empty-text">
                            No processed payments yet.
                          </p>
                        ) : (
                          schedule.history.map((item) => (
                            <div
                              className="recurring-history-row"
                              key={item.id}
                            >
                              <div>
                                <strong>
                                  {item.status === "confirmed"
                                    ? "Confirmed"
                                    : "Skipped"}
                                </strong>

                                <small>
                                  Due: {item.due_date}
                                </small>

                                <small>
                                  Processed:{" "}
                                  {item.processed_date}
                                </small>
                              </div>

                              <b>
                                {item.status === "confirmed"
                                  ? money(item.amount)
                                  : "—"}
                              </b>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Create, edit and confirmation modal */}

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
            className="modal-card recurring-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recurring-modal-title"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  PLAN AHEAD
                </span>

                <h2 id="recurring-modal-title">
                  {modal === "confirm"
                    ? "Confirm occurrence"
                    : modal === "edit"
                    ? "Edit schedule"
                    : "New recurring schedule"}
                </h2>
              </div>

              <button
                className="icon-button"
                disabled={saving}
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {modal === "confirm" ? (
              <form
                className="transaction-form"
                onSubmit={confirmPayment}
              >
                <div className="recurring-form-summary">
                  <strong>
                    {selectedSchedule?.name}
                  </strong>

                  <span>
                    Scheduled amount:{" "}
                    {money(selectedSchedule?.amount)}
                  </span>

                  <span>
                    Due:{" "}
                    {selectedSchedule?.next_due_date}
                  </span>
                </div>

                <label>
                  Actual amount (₹)

                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={payment.amount}
                    onChange={(event) =>
                      setPayment({
                        ...payment,
                        amount: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Actual payment date

                  <input
                    required
                    type="date"
                    max={today()}
                    value={payment.date}
                    onChange={(event) =>
                      setPayment({
                        ...payment,
                        date: event.target.value,
                      })
                    }
                  />
                </label>

                <p className="recurring-form-note">
                  Confirming will create a transaction
                  and advance the schedule to its next
                  occurrence. Only confirm payments
                  that have actually happened.
                </p>

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
                  {saving
                    ? "Processing…"
                    : "Confirm and record"}
                </button>
              </form>
            ) : (
              <form
                className="transaction-form"
                onSubmit={saveSchedule}
              >
                <label>
                  Schedule name

                  <input
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        name: event.target.value,
                      })
                    }
                    placeholder="e.g. Monthly rent"
                  />
                </label>

                <label>
                  Transaction type

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
                    <option value="expense">
                      Expense
                    </option>

                    <option value="income">
                      Income
                    </option>
                  </select>
                </label>

                <label>
                  Expected amount (₹)

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
                    maxLength={100}
                    list="recurring-categories"
                    value={form.category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        category: event.target.value,
                      })
                    }
                    placeholder="Select or enter category"
                  />

                  <datalist id="recurring-categories">
                    {categories[form.type].map(
                      (category) => (
                        <option
                          key={category}
                          value={category}
                        />
                      )
                    )}
                  </datalist>
                </label>

                <label>
                  Frequency

                  <select
                    value={form.frequency}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        frequency: event.target.value,
                      })
                    }
                  >
                    {frequencies.map((frequency) => (
                      <option
                        key={frequency}
                        value={frequency}
                      >
                        {frequency.charAt(0).toUpperCase() +
                          frequency.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Next due date

                  <input
                    required
                    type="date"
                    value={form.next_due_date}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        next_due_date: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Description (optional)

                  <input
                    maxLength={255}
                    value={form.description}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        description: event.target.value,
                      })
                    }
                    placeholder="Additional details"
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
                  {saving
                    ? "Saving…"
                    : modal === "edit"
                    ? "Save changes"
                    : "Create schedule"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
