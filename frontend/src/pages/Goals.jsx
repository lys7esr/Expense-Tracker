
import { useEffect, useState } from "react";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  X,
  CalendarDays,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  CheckCircle2,
} from "lucide-react";

import api from "../api";
import "../workspace.css";
import "../Goals.css";

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

const emptyGoal = () => ({
  name: "",
  target: "",
  deadline: "",
  description: "",
});

const emptyContribution = () => ({
  type: "deposit",
  amount: "",
  date: today(),
  note: "",
});

const statusLabels = {
  active: "In progress",
  completed: "Goal achieved",
  overdue: "Deadline passed",
};

export default function Goals() {
  const [goals, setGoals] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [modal, setModal] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [goalForm, setGoalForm] = useState(emptyGoal);

  const [contributionForm, setContributionForm] =
    useState(emptyContribution);

  const [historyId, setHistoryId] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;

    api
      .get("/goals")
      .then((response) => {
        if (!active) return;

        setGoals(response.data);
        setError("");
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err.response?.data?.error ||
            "Could not load savings goals."
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

  function startGoal(goal = null) {
    setFormError("");
    setSelectedId(goal?.id || null);

    setGoalForm(
      goal
        ? {
            name: goal.name,
            target: goal.target,
            deadline: goal.deadline || "",
            description: goal.description || "",
          }
        : emptyGoal()
    );

    setModal(goal ? "edit" : "create");
  }

  function startContribution(goal) {
    setFormError("");
    setSelectedId(goal.id);
    setContributionForm(emptyContribution());
    setModal("contribution");
  }

  function closeModal() {
    if (saving) return;

    setModal(null);
    setSelectedId(null);
    setFormError("");
  }

  async function saveGoal(event) {
    event.preventDefault();

    setSaving(true);
    setFormError("");

    try {
      if (modal === "edit") {
        await api.put(
          `/goals/${selectedId}`,
          goalForm
        );
      } else {
        await api.post("/goals", goalForm);
      }

      setModal(null);
      setSelectedId(null);
      reload();
    } catch (err) {
      setFormError(
        err.response?.data?.error ||
          "Could not save goal."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveContribution(event) {
    event.preventDefault();

    setSaving(true);
    setFormError("");

    try {
      await api.post(
        `/goals/${selectedId}/contributions`,
        contributionForm
      );

      setModal(null);
      setSelectedId(null);
      reload();
    } catch (err) {
      setFormError(
        err.response?.data?.error ||
          "Could not record contribution."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeGoal(goal) {
    const confirmed = window.confirm(
      `Delete "${goal.name}" and its contribution history?`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/goals/${goal.id}`);
      reload();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not delete goal."
      );
    }
  }

  async function removeContribution(goal, contribution) {
    const confirmed = window.confirm(
      "Remove this savings contribution?"
    );

    if (!confirmed) return;

    try {
      await api.delete(
        `/goals/${goal.id}/contributions/${contribution.id}`
      );

      reload();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not remove contribution."
      );
    }
  }

  const totalSaved = goals.reduce(
    (sum, goal) => sum + goal.saved,
    0
  );

  const totalTarget = goals.reduce(
    (sum, goal) => sum + goal.target,
    0
  );

  const completed = goals.filter(
    (goal) => goal.status === "completed"
  ).length;

  const selectedGoal = goals.find(
    (goal) => goal.id === selectedId
  );

  return (
    <div className="page-stack sw-workspace">
      <div className="page-heading sw-heading">
        <div>
          <span className="eyebrow">
            MAKE YOUR FUTURE HAPPEN
          </span>

          <h1>
            Savings goals
            <span className="sw-red">✦</span>
          </h1>

          <p>
            Make room for the things that matter.
          </p>
        </div>

        <button
          className="button-primary"
          onClick={() => startGoal()}
        >
          <Plus size={17} />
          New goal
        </button>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty-text">
          Loading savings goals…
        </p>
      ) : (
        <>
          <section className="goals-hero">
            <div className="goals-hero-top">
              <span>TOTAL SAVINGS TRACKED</span>
              <Target size={25} />
            </div>

            <strong>{money(totalSaved)}</strong>

            <p>
              Small steps today. Bigger possibilities tomorrow.
            </p>

            <div className="goals-hero-stats">
              <div>
                <small>COMBINED TARGET</small>
                <b>{money(totalTarget)}</b>
              </div>

              <div>
                <small>TOTAL GOALS</small>
                <b>{goals.length}</b>
              </div>

              <div>
                <small>COMPLETED</small>
                <b>{completed}</b>
              </div>
            </div>
          </section>

          <div className="panel-header">
            <div>
              <span className="eyebrow">
                YOUR FUTURE, YOUR TERMS
              </span>

              <h2>Your goals</h2>
            </div>
          </div>

          {!goals.length ? (
            <div className="panel sw-empty">
              <Target size={35} />

              <h3>Start with something meaningful.</h3>

              <p>
                Create your first savings goal and
                watch your progress grow.
              </p>

              <button
                className="button-primary"
                onClick={() => startGoal()}
              >
                <Plus size={17} />
                Create a goal
              </button>
            </div>
          ) : (
            <div className="goals-grid">
              {goals.map((goal) => (
                <article
                  className="panel goal-card"
                  key={goal.id}
                >
                  <div className="goal-card-header">
                    <div className="goal-icon">
                      {goal.status === "completed" ? (
                        <CheckCircle2 size={22} />
                      ) : (
                        <Target size={22} />
                      )}
                    </div>

                    <div className="goal-card-actions">
                      <button
                        className="icon-button"
                        aria-label={`Edit ${goal.name}`}
                        onClick={() => startGoal(goal)}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="icon-button delete-button"
                        aria-label={`Delete ${goal.name}`}
                        onClick={() => removeGoal(goal)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h3>{goal.name}</h3>

                  {goal.description && (
                    <p className="goal-description">
                      {goal.description}
                    </p>
                  )}

                  <span
                    className={`goal-status ${goal.status}`}
                  >
                    {statusLabels[goal.status]}
                  </span>

                  <div className="goal-amount">
                    {money(goal.saved)}

                    <span>
                      / {money(goal.target)}
                    </span>
                  </div>

                  <div
                    className="goal-progress"
                    role="progressbar"
                    aria-label={`${goal.name} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(
                      100,
                      goal.percentage
                    )}
                  >
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          goal.percentage
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="goal-progress-labels">
                    <span>
                      {goal.percentage.toFixed(1)}% saved
                    </span>

                    <span>
                      {money(goal.remaining)} remaining
                    </span>
                  </div>

                  <div className="goal-details">
                    <div>
                      <CalendarDays size={15} />

                      <span>
                        {goal.deadline
                          ? `Target date: ${goal.deadline}`
                          : "No deadline set"}
                      </span>
                    </div>

                    {goal.status === "active" &&
                      goal.days_left !== null && (
                        <p>
                          {goal.days_left} days remaining
                        </p>
                      )}

                    {goal.status === "active" &&
                      goal.monthly_required !== null && (
                        <p>
                          Suggested monthly savings:{" "}
                          <strong>
                            {money(goal.monthly_required)}
                          </strong>
                        </p>
                      )}

                    {goal.status === "overdue" && (
                      <p>
                        Consider updating your target date.
                      </p>
                    )}

                    {goal.status === "completed" && (
                      <p>
                        You reached your savings target!
                      </p>
                    )}
                  </div>

                  <div className="goal-bottom-actions">
                    <button
                      className="button-primary"
                      onClick={() =>
                        startContribution(goal)
                      }
                    >
                      <Plus size={16} />
                      Manage savings
                    </button>

                    <button
                      className="text-link"
                      onClick={() =>
                        setHistoryId(
                          historyId === goal.id
                            ? null
                            : goal.id
                        )
                      }
                    >
                      <History size={16} />

                      {historyId === goal.id
                        ? "Hide history"
                        : "History"}
                    </button>
                  </div>

                  {historyId === goal.id && (
                    <div className="goal-history">
                      <h4>Contribution history</h4>

                      {!goal.contributions.length ? (
                        <p className="empty-text">
                          No contributions yet.
                        </p>
                      ) : (
                        goal.contributions.map(
                          (contribution) => (
                            <div
                              className="goal-history-row"
                              key={contribution.id}
                            >
                              <div className="goal-history-icon">
                                {contribution.type ===
                                "deposit" ? (
                                  <ArrowDownLeft size={16} />
                                ) : (
                                  <ArrowUpRight size={16} />
                                )}
                              </div>

                              <div className="goal-history-info">
                                <strong>
                                  {contribution.note ||
                                    (contribution.type ===
                                    "deposit"
                                      ? "Savings added"
                                      : "Savings withdrawn")}
                                </strong>

                                <small>
                                  {contribution.date}
                                </small>
                              </div>

                              <strong>
                                {contribution.type ===
                                "deposit"
                                  ? "+"
                                  : "−"}

                                {money(contribution.amount)}
                              </strong>

                              <button
                                className="icon-button delete-button"
                                aria-label="Remove contribution"
                                onClick={() =>
                                  removeContribution(
                                    goal,
                                    contribution
                                  )
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )
                        )
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
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
            aria-labelledby="goal-modal-title"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  INVEST IN YOUR FUTURE
                </span>

                <h2 id="goal-modal-title">
                  {modal === "contribution"
                    ? "Manage savings"
                    : modal === "edit"
                    ? "Edit savings goal"
                    : "Create savings goal"}
                </h2>
              </div>

              <button
                className="icon-button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {modal === "contribution" ? (
              <form
                className="transaction-form"
                onSubmit={saveContribution}
              >
                <div className="goal-form-balance">
                  <span>{selectedGoal?.name}</span>

                  <strong>
                    {money(selectedGoal?.saved)} saved
                  </strong>
                </div>

                <label>
                  Action

                  <select
                    value={contributionForm.type}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        type: event.target.value,
                      })
                    }
                  >
                    <option value="deposit">
                      Add savings
                    </option>

                    <option value="withdrawal">
                      Withdraw savings
                    </option>
                  </select>
                </label>

                <label>
                  Amount (₹)

                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={
                      contributionForm.type === "withdrawal"
                        ? selectedGoal?.saved
                        : undefined
                    }
                    value={contributionForm.amount}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        amount: event.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Date

                  <input
                    required
                    type="date"
                    max={today()}
                    value={contributionForm.date}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        date: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Note (optional)

                  <input
                    maxLength={255}
                    value={contributionForm.note}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        note: event.target.value,
                      })
                    }
                    placeholder="e.g. Monthly savings"
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
                    : "Record contribution"}
                </button>
              </form>
            ) : (
              <form
                className="transaction-form"
                onSubmit={saveGoal}
              >
                <label>
                  Goal name

                  <input
                    required
                    maxLength={100}
                    value={goalForm.name}
                    onChange={(event) =>
                      setGoalForm({
                        ...goalForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="e.g. New laptop"
                  />
                </label>

                <label>
                  Target amount (₹)

                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={goalForm.target}
                    onChange={(event) =>
                      setGoalForm({
                        ...goalForm,
                        target: event.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Target date (optional)

                  <input
                    type="date"
                    value={goalForm.deadline}
                    onChange={(event) =>
                      setGoalForm({
                        ...goalForm,
                        deadline: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Description (optional)

                  <input
                    maxLength={255}
                    value={goalForm.description}
                    onChange={(event) =>
                      setGoalForm({
                        ...goalForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="Why does this goal matter?"
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
                    : "Create goal"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
