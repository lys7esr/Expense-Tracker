
from datetime import date
from decimal import Decimal, InvalidOperation
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from database import db
from models import User, Category, Transaction, Budget

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///spendwise.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

CORS(app, resources={r"/api/*": {
    "origins": ["http://localhost:5173", "http://127.0.0.1:5173"]
}})
db.init_app(app)

DEV_USER_ID = 1


def to_paise(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount <= 0:
            raise ValueError("Amount must be positive")
        if amount.as_tuple().exponent < -2:
            raise ValueError("Maximum two decimal places")
        return int(amount * 100)
    except (InvalidOperation, TypeError):
        raise ValueError("Invalid amount")


def serialize_transaction(tx):
    return {
        "id": tx.id,
        "type": tx.type,
        "amount": tx.amount_paise / 100,
        "category": tx.category.name,
        "subcategory": tx.subcategory,
        "description": tx.description,
        "date": tx.date.isoformat()
    }


def get_category(name, tx_type):
    category = db.session.execute(
        db.select(Category).filter_by(
            user_id=DEV_USER_ID,
            name=name,
            type=tx_type
        )
    ).scalar_one_or_none()

    if category is None:
        category = Category(
            user_id=DEV_USER_ID,
            name=name,
            type=tx_type
        )
        db.session.add(category)
        db.session.flush()

    return category


def parse_transaction(data):
    tx_type = data.get("type", "expense")
    if tx_type not in ("income", "expense"):
        raise ValueError("Type must be income or expense")

    category_name = str(data.get("category", "")).strip()
    if not category_name:
        raise ValueError("Category is required")

    try:
        tx_date = date.fromisoformat(str(data["date"]))
    except (KeyError, TypeError, ValueError):
        raise ValueError("Date must be YYYY-MM-DD")

    amount_paise = to_paise(data.get("amount"))

    return {
        "type": tx_type,
        "category": get_category(category_name, tx_type),
        "date": tx_date,
        "amount_paise": amount_paise,
        "subcategory": str(data.get("subcategory") or "").strip(),
        "description": str(data.get("description") or "").strip()
    }


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Resource not found"}), 404


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "app": "SpendWise"})


@app.route("/api/transactions", methods=["GET"])
def list_transactions():
    transactions = db.session.execute(
        db.select(Transaction)
        .filter_by(user_id=DEV_USER_ID)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
    ).scalars().all()

    return jsonify([serialize_transaction(t) for t in transactions])


@app.route("/api/transactions", methods=["POST"])
def create_transaction():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON object required"}), 400

    try:
        fields = parse_transaction(data)
        transaction = Transaction(user_id=DEV_USER_ID, **fields)
        db.session.add(transaction)
        db.session.commit()
        return jsonify(serialize_transaction(transaction)), 201

    except (ValueError, IntegrityError) as error:
        db.session.rollback()
        return jsonify({"error": str(error)}), 400


@app.route("/api/transactions/<int:tx_id>", methods=["PUT"])
def update_transaction(tx_id):
    transaction = db.session.get(Transaction, tx_id)

    if transaction is None or transaction.user_id != DEV_USER_ID:
        return jsonify({"error": "Transaction not found"}), 404

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON object required"}), 400

    try:
        current = serialize_transaction(transaction)
        current.update(data)
        fields = parse_transaction(current)

        for key, value in fields.items():
            setattr(transaction, key, value)

        db.session.commit()
        return jsonify(serialize_transaction(transaction))

    except (ValueError, IntegrityError) as error:
        db.session.rollback()
        return jsonify({"error": str(error)}), 400


@app.route("/api/transactions/<int:tx_id>", methods=["DELETE"])
def delete_transaction(tx_id):
    transaction = db.session.get(Transaction, tx_id)

    if transaction is None or transaction.user_id != DEV_USER_ID:
        return jsonify({"error": "Transaction not found"}), 404

    db.session.delete(transaction)
    db.session.commit()
    return jsonify({"message": "Transaction deleted"})


@app.route("/api/summary/<month>", methods=["GET"])
def monthly_summary(month):
    try:
        date.fromisoformat(month + "-01")
        if len(month) != 7:
            raise ValueError()
    except ValueError:
        return jsonify({"error": "Month must be YYYY-MM"}), 400

    transactions = db.session.execute(
        db.select(Transaction).filter(
            Transaction.user_id == DEV_USER_ID,
            func.strftime("%Y-%m", Transaction.date) == month
        )
    ).scalars().all()

    income = sum(
        t.amount_paise for t in transactions if t.type == "income"
    )
    expenses = sum(
        t.amount_paise for t in transactions if t.type == "expense"
    )

    categories = {}
    for t in transactions:
        if t.type == "expense":
            name = t.category.name
            categories[name] = categories.get(name, 0) + t.amount_paise

    return jsonify({
        "month": month,
        "income": income / 100,
        "expenses": expenses / 100,
        "net_cash_flow": (income - expenses) / 100,
        "categories": {
            name: amount / 100
            for name, amount in categories.items()
        }
    })


@app.route("/api/budgets/<month>", methods=["GET"])
def get_budget(month):
    budget = db.session.execute(
        db.select(Budget).filter_by(
            user_id=DEV_USER_ID, month=month
        )
    ).scalar_one_or_none()

    return jsonify({
        "month": month,
        "budget": budget.amount_paise / 100 if budget else 0
    })


@app.route("/api/budgets/<month>", methods=["PUT"])
def set_budget(month):
    try:
        date.fromisoformat(month + "-01")
        if len(month) != 7:
            raise ValueError("Month must be YYYY-MM")

        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ValueError("JSON object required")

        amount = to_paise(data.get("amount"))

        budget = db.session.execute(
            db.select(Budget).filter_by(
                user_id=DEV_USER_ID, month=month
            )
        ).scalar_one_or_none()

        if budget is None:
            budget = Budget(user_id=DEV_USER_ID, month=month)
            db.session.add(budget)

        budget.amount_paise = amount
        db.session.commit()

        return jsonify({"month": month, "budget": amount / 100})

    except (ValueError, IntegrityError) as error:
        db.session.rollback()
        return jsonify({"error": str(error)}), 400


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

        if db.session.get(User, DEV_USER_ID) is None:
            db.session.add(User(
                id=DEV_USER_ID,
                username="local_dev",
                password_hash="DEV_ONLY_NO_LOGIN"
            ))
            db.session.commit()

    app.run(debug=True)
