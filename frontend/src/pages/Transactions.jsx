
import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import api from "../api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR"
  }).format(value);

const today = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const emptyForm = () => ({
  type: "expense",
  amount: "",
  category: "",
  subcategory: "",
  description: "",
  date: today()
});

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get("/transactions");
      setItems(res.data);
      setError("");
    } catch {
      setError("Could not load transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/transactions", form);
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not save transaction.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Permanently delete this transaction?")) return;
    try {
      await api.delete(`/transactions/${id}`);
      await load();
    } catch {
      setError("Could not delete transaction.");
    }
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR MONEY, ORGANIZED</span>
          <h1>Transactions</h1>
          <p>Every rupee, accounted for.</p>
        </div>
        <button
          className="button-primary"
          onClick={() => { setError(""); setShowForm(true); }}
        >
          <Plus size={17} /> Add transaction
        </button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">TRANSACTION HISTORY</span>
            <h2>All activity</h2>
          </div>
          <span className="count-pill">{items.length} records</span>
        </div>
        {loading ? (
          <p className="empty-text">Loading...</p>
        ) : items.length === 0 ? (
          <p className="empty-text">No transactions yet. Add your first one.</p>
        ) : (
          <div className="transaction-list">
            {items.map((tx) => (
              <div className="transaction-row" key={tx.id}>
                <div className={`transaction-icon ${tx.type}`}>
                  {tx.type === "income"
                    ? <ArrowDownRight size={19} />
                    : <ArrowUpRight size={19} />}
                </div>
                <div className="transaction-info">
                  <strong>{tx.description || tx.category}</strong>
                  <small>
                    {tx.category}
                    {tx.subcategory ? ` · ${tx.subcategory}` : ""}
                    {" · "}{tx.date}
                  </small>
                </div>
                <strong className={`transaction-amount ${tx.type}`}>
                  {tx.type === "income" ? "+" : "−"}{money(tx.amount)}
                </strong>
                <button
                  className="icon-button delete-button"
                  onClick={() => remove(tx.id)}
                  aria-label={`Delete transaction ${tx.id}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-transaction-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">NEW ENTRY</span>
                <h2 id="add-transaction-title">Add transaction</h2>
              </div>
              <button className="text-link" onClick={() => setShowForm(false)}>
                Close
              </button>
            </div>
            <form onSubmit={save} className="transaction-form">
              <label>Type
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>
              <label>Amount (₹)
                <input
                  type="number" min="0.01" step="0.01" required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                />
              </label>
              <label>Category
                <input
                  required value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Food & Dining"
                />
              </label>
              <label>Subcategory
                <input
                  value={form.subcategory}
                  onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                  placeholder="Optional"
                />
              </label>
              <label>Date
                <input
                  type="date" required value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label>Description
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional note"
                />
              </label>
              <button className="button-primary form-submit" disabled={saving}>
                {saving ? "Saving..." : "Save transaction"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}