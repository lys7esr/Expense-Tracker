
import { useEffect, useState } from "react";
import api from "./api";
import "./App.css";

function App() {
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    category: "",
    date: new Date().toLocaleDateString("en-CA"),
    description: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      const response = await api.get("/transactions");
      setTransactions(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Could not load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await api.post("/transactions", form);

      setForm({
        type: "expense",
        amount: "",
        category: "",
        date: new Date().toLocaleDateString("en-CA"),
        description: "",
      });

      await fetchTransactions();
    } catch (err) {
      setError(err.response?.data?.error || "Could not save transaction");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this transaction?")) return;

    try {
      await api.delete(`/transactions/${id}`);
      await fetchTransactions();
    } catch (err) {
      setError(err.response?.data?.error || "Could not delete transaction");
    }
  };

  const totalIncome = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <main className="container">
      <h1>SpendWise</h1>
      <p>Personal Finance Tracker</p>

      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}

      <section className="card">
        <h2>Add Transaction</h2>

        <form onSubmit={handleSubmit} className="form">
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value })
            }
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>

          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) =>
              setForm({ ...form, amount: e.target.value })
            }
            required
          />

          <input
            placeholder="Category"
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
            required
          />

          <input
            type="date"
            value={form.date}
            onChange={(e) =>
              setForm({ ...form, date: e.target.value })
            }
            required
          />

          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />

          <button type="submit">Save Transaction</button>
        </form>
      </section>

      <section className="card">
        <h2>Overview (All Time)</h2>
        <p>Income: ₹{totalIncome.toFixed(2)}</p>
        <p>Expenses: ₹{totalExpenses.toFixed(2)}</p>
        <p>Net Cash Flow: ₹{(totalIncome - totalExpenses).toFixed(2)}</p>
      </section>

      <section className="card">
        <h2>Transactions</h2>

        {loading ? (
          <p>Loading...</p>
        ) : transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <ul>
            {transactions.map((tx) => (
              <li key={tx.id}>
                {tx.date} — {tx.category} — {tx.type} —
                ₹{tx.amount.toFixed(2)}
                {" "}
                <button
                  type="button"
                  onClick={() => handleDelete(tx.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;
