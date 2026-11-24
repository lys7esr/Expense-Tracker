
import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  CalendarDays,
  CheckCircle2,
  Search,
} from "lucide-react";

import api from "../api";
import "../workspace.css";
import "../People.css";


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


const emptyRecord = () => ({
  person: "",
  type: "lent",
  amount: "",
  purpose: "",
  date: today(),
  due_date: "",
});


const emptyRepayment = () => ({
  amount: "",
  date: today(),
  note: "",
});


const statusLabels = {
  outstanding: "Outstanding",
  overdue: "Overdue",
  settled: "Settled",
};


const filters = [
  { value: "all", label: "All records" },
  { value: "lent", label: "Lent" },
  { value: "borrowed", label: "Borrowed" },
  { value: "outstanding", label: "Unsettled" },
  { value: "overdue", label: "Overdue" },
  { value: "settled", label: "Settled" },
];


export default function People() {
  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [recordForm, setRecordForm] =
    useState(emptyRecord);

  const [repaymentForm, setRepaymentForm] =
    useState(emptyRepayment);

  const [historyId, setHistoryId] = useState(null);
  const [refresh, setRefresh] = useState(0);


  useEffect(() => {
    let active = true;

    api
      .get("/people")
      .then((response) => {
        if (!active) return;

        setData(response.data);
        setError("");
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err.response?.data?.error ||
            "Could not load money records."
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


  function startRecord(record = null) {
    setFormError("");
    setSelectedId(record?.id || null);

    setRecordForm(
      record
        ? {
            person: record.person,
            type: record.type,
            amount: record.amount,
            purpose: record.purpose,
            date: record.date,
            due_date: record.due_date || "",
          }
        : emptyRecord()
    );

    setModal(record ? "edit" : "create");
  }


  function startRepayment(record) {
    setFormError("");
    setSelectedId(record.id);
    setRepaymentForm(emptyRepayment());
    setModal("repayment");
  }


  function closeModal() {
    if (saving) return;

    setModal(null);
    setSelectedId(null);
    setFormError("");
  }


  async function saveRecord(event) {
    event.preventDefault();

    setSaving(true);
    setFormError("");

    try {
      if (modal === "edit") {
        await api.put(
          `/people/${selectedId}`,
          recordForm
        );
      } else {
        await api.post("/people", recordForm);
      }

      setModal(null);
      setSelectedId(null);
      reload();

    } catch (err) {
      setFormError(
        err.response?.data?.error ||
          "Could not save record."
      );

    } finally {
      setSaving(false);
    }
  }


  async function saveRepayment(event) {
    event.preventDefault();

    setSaving(true);
    setFormError("");

    try {
      await api.post(
        `/people/${selectedId}/repayments`,
        repaymentForm
      );

      setModal(null);
      setSelectedId(null);
      reload();

    } catch (err) {
      setFormError(
        err.response?.data?.error ||
          "Could not record repayment."
      );

    } finally {
      setSaving(false);
    }
  }


  async function removeRecord(record) {
    if (
      !window.confirm(
        `Delete the record for ${record.person} and its repayment history?`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/people/${record.id}`);
      reload();

    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not delete record."
      );
    }
  }


  async function removeRepayment(record, repayment) {
    if (
      !window.confirm(
        "Remove this repayment and restore the outstanding balance?"
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/people/${record.id}/repayments/${repayment.id}`
      );

      reload();

    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not remove repayment."
      );
    }
  }


  const records = data?.records || [];

  const selectedRecord = records.find(
    (record) => record.id === selectedId
  );

  const visibleRecords = records.filter((record) => {
    const matchesFilter =
      filter === "all" ||
      record.type === filter ||
      record.status === filter ||
      (
        filter === "outstanding" &&
        record.status !== "settled"
      );

    const query = search.trim().toLowerCase();

    const matchesSearch =
      `${record.person} ${record.purpose}`
        .toLowerCase()
        .includes(query);

    return matchesFilter && matchesSearch;
  });


  return (
    <div className="page-stack sw-workspace">
      <div className="page-heading sw-heading">
        <div>
          <span className="eyebrow">
            KEEP THINGS CLEAR
          </span>

          <h1>
            People & Money
            <span className="sw-red">✦</span>
          </h1>

          <p>Good relationships. Clear finances.</p>
        </div>

        <button
          className="button-primary"
          onClick={() => startRecord()}
        >
          <Plus size={17} />
          New record
        </button>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty-text">
          Loading money records…
        </p>
      ) : !data ? (
        <div className="panel sw-empty">
          <p>Money records are unavailable.</p>

          <button
            className="button-primary"
            onClick={reload}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <section className="people-metrics">
            <article className="people-metric featured">
              <div className="people-metric-top">
                <span>YOU ARE OWED</span>
                <ArrowDownLeft size={22} />
              </div>

              <strong>
                {money(data.receivable)}
              </strong>

              <p>Outstanding receivables</p>
            </article>

            <article className="panel people-metric">
              <div className="people-metric-top">
                <span>YOU OWE</span>

                <ArrowUpRight
                  size={22}
                  className="people-outgoing"
                />
              </div>

              <strong>
                {money(data.payable)}
              </strong>

              <p>Outstanding repayments</p>
            </article>

            <article className="panel people-metric">
              <div className="people-metric-top">
                <span>NET POSITION</span>
                <Users size={22} />
              </div>

              <strong>
                {data.net_position > 0 ? "+" : ""}
                {money(data.net_position)}
              </strong>

              <p>Receivables minus payables</p>
            </article>
          </section>

          <div className="people-summary">
            <span>
              <CheckCircle2 size={16} />
              {data.settled_count} settled
            </span>

            <span
              className={
                data.overdue_count
                  ? "people-overdue"
                  : ""
              }
            >
              <CalendarDays size={16} />
              {data.overdue_count} overdue
            </span>
          </div>

          <section className="page-stack">
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  EVERY RUPEE ACCOUNTED FOR
                </span>

                <h2>Money records</h2>
              </div>
            </div>

            <div className="people-controls">
              <div className="people-filters">
                {filters.map((item) => (
                  <button
                    key={item.value}
                    className={
                      filter === item.value
                        ? "active"
                        : ""
                    }
                    aria-pressed={
                      filter === item.value
                    }
                    onClick={() =>
                      setFilter(item.value)
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <label className="people-search">
                <Search size={17} />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search people…"
                  aria-label="Search money records"
                />
              </label>
            </div>

            {!visibleRecords.length ? (
              <div className="panel sw-empty">
                <Users size={34} />

                <h3>
                  {records.length
                    ? "No matching records."
                    : "Keep your finances clear."}
                </h3>

                <p>
                  {records.length
                    ? "Try another filter or search."
                    : "Track money lent and borrowed in one place."}
                </p>

                {!records.length && (
                  <button
                    className="button-primary"
                    onClick={() => startRecord()}
                  >
                    <Plus size={16} />
                    Add your first record
                  </button>
                )}
              </div>
            ) : (
              <div className="people-records">
                {visibleRecords.map((record) => (
                  <article
                    className="panel people-record"
                    key={record.id}
                  >
                    <div className="people-record-header">
                      <div className="people-avatar">
                        {record.person
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="people-record-info">
                        <h3>{record.person}</h3>

                        <p>
                          {record.purpose ||
                            "No purpose specified"}
                        </p>

                        <span
                          className={`people-type ${record.type}`}
                        >
                          {record.type === "lent" ? (
                            <ArrowDownLeft size={13} />
                          ) : (
                            <ArrowUpRight size={13} />
                          )}

                          {record.type === "lent"
                            ? "Money lent"
                            : "Money borrowed"}
                        </span>
                      </div>

                      <div className="people-record-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${record.person} record`}
                          onClick={() =>
                            startRecord(record)
                          }
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="icon-button delete-button"
                          aria-label={`Delete ${record.person} record`}
                          onClick={() =>
                            removeRecord(record)
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="people-balance">
                      <div>
                        <small>OUTSTANDING</small>

                        <strong>
                          {money(record.outstanding)}
                        </strong>
                      </div>

                      <span
                        className={`people-status ${record.status}`}
                      >
                        {statusLabels[record.status]}
                      </span>
                    </div>

                    <div
                      className="people-progress"
                      role="progressbar"
                      aria-label="Repayment progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={record.percentage}
                    >
                      <div
                        style={{
                          width: `${record.percentage}%`,
                        }}
                      />
                    </div>

                    <div className="people-progress-labels">
                      <span>
                        {money(record.repaid)} repaid
                      </span>

                      <span>
                        {money(record.amount)} total
                      </span>
                    </div>

                    <div className="people-dates">
                      <span>
                        Recorded: {record.date}
                      </span>

                      <span>
                        <CalendarDays size={14} />

                        {record.due_date
                          ? `Due: ${record.due_date}`
                          : "No due date"}
                      </span>
                    </div>

                    <div className="people-bottom-actions">
                      {record.status !== "settled" ? (
                        <button
                          className="button-primary"
                          onClick={() =>
                            startRepayment(record)
                          }
                        >
                          <Plus size={16} />

                          {record.type === "lent"
                            ? "Record received"
                            : "Record payment"}
                        </button>
                      ) : (
                        <span className="people-settled">
                          <CheckCircle2 size={17} />
                          Fully settled
                        </span>
                      )}

                      <button
                        className="text-link"
                        onClick={() =>
                          setHistoryId(
                            historyId === record.id
                              ? null
                              : record.id
                          )
                        }
                      >
                        <History size={16} />

                        {historyId === record.id
                          ? "Hide history"
                          : "History"}
                      </button>
                    </div>

                    {historyId === record.id && (
                      <div className="people-history">
                        <h4>Repayment history</h4>

                        {!record.repayments.length ? (
                          <p className="empty-text">
                            No repayments recorded.
                          </p>
                        ) : (
                          record.repayments.map(
                            (repayment) => (
                              <div
                                className="people-history-row"
                                key={repayment.id}
                              >
                                <div>
                                  <strong>
                                    {repayment.note ||
                                      (
                                        record.type === "lent"
                                          ? "Payment received"
                                          : "Payment made"
                                      )}
                                  </strong>

                                  <small>
                                    {repayment.date}
                                  </small>
                                </div>

                                <b>
                                  {money(repayment.amount)}
                                </b>

                                <button
                                  className="icon-button delete-button"
                                  aria-label="Remove repayment"
                                  onClick={() =>
                                    removeRepayment(
                                      record,
                                      repayment
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
          </section>
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
            className="modal-card people-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="people-modal-title"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">
                  KEEP A CLEAR RECORD
                </span>

                <h2 id="people-modal-title">
                  {modal === "repayment"
                    ? "Record repayment"
                    : modal === "edit"
                    ? "Edit money record"
                    : "New money record"}
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

            {modal === "repayment" ? (
              <form
                className="transaction-form"
                onSubmit={saveRepayment}
              >
                <div className="people-form-balance">
                  <span>
                    {selectedRecord?.person}
                  </span>

                  <strong>
                    {money(
                      selectedRecord?.outstanding
                    )} outstanding
                  </strong>
                </div>

                <label>
                  Repayment amount (₹)

                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={selectedRecord?.outstanding}
                    value={repaymentForm.amount}
                    onChange={(event) =>
                      setRepaymentForm({
                        ...repaymentForm,
                        amount: event.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </label>

                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    setRepaymentForm({
                      ...repaymentForm,
                      amount:
                        selectedRecord?.outstanding,
                    })
                  }
                >
                  Settle full outstanding balance
                </button>

                <label>
                  Date

                  <input
                    required
                    type="date"
                    min={selectedRecord?.date}
                    max={today()}
                    value={repaymentForm.date}
                    onChange={(event) =>
                      setRepaymentForm({
                        ...repaymentForm,
                        date: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Note (optional)

                  <input
                    maxLength={255}
                    value={repaymentForm.note}
                    onChange={(event) =>
                      setRepaymentForm({
                        ...repaymentForm,
                        note: event.target.value,
                      })
                    }
                    placeholder="e.g. Partial repayment"
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
                    : "Confirm repayment"}
                </button>
              </form>
            ) : (
              <form
                className="transaction-form"
                onSubmit={saveRecord}
              >
                <label>
                  Record type

                  <select
                    value={recordForm.type}
                    disabled={
                      modal === "edit" &&
                      selectedRecord?.repayments.length > 0
                    }
                    onChange={(event) =>
                      setRecordForm({
                        ...recordForm,
                        type: event.target.value,
                      })
                    }
                  >
                    <option value="lent">
                      I lent money
                    </option>

                    <option value="borrowed">
                      I borrowed money
                    </option>
                  </select>
                </label>

                <label>
                  Person's name

                  <input
                    required
                    maxLength={100}
                    value={recordForm.person}
                    onChange={(event) =>
                      setRecordForm({
                        ...recordForm,
                        person: event.target.value,
                      })
                    }
                    placeholder="Enter name"
                  />
                </label>

                <label>
                  Amount (₹)

                  <input
                    required
                    type="number"
                    min={Math.max(
                      0.01,
                      selectedRecord?.repaid || 0
                    )}
                    step="0.01"
                    value={recordForm.amount}
                    onChange={(event) =>
                      setRecordForm({
                        ...recordForm,
                        amount: event.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Purpose (optional)

                  <input
                    maxLength={255}
                    value={recordForm.purpose}
                    onChange={(event) =>
                      setRecordForm({
                        ...recordForm,
                        purpose: event.target.value,
                      })
                    }
                    placeholder="e.g. Dinner split"
                  />
                </label>

                <label>
                  Date

                  <input
                    required
                    type="date"
                    max={today()}
                    value={recordForm.date}
                    onChange={(event) =>
                      setRecordForm({
                        ...recordForm,
                        date: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Due date (optional)

                  <input
                    type="date"
                    min={recordForm.date}
                    value={recordForm.due_date}
                    onChange={(event) =>
                      setRecordForm({
                        ...recordForm,
                        due_date: event.target.value,
                      })
                    }
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
                    : "Create record"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
