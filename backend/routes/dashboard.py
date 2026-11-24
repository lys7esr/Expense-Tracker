from datetime import date

from flask import Blueprint, jsonify
from sqlalchemy import func

from database import db
from models import Transaction
from config import DEV_USER_ID


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/summary/<month>", methods=["GET"])
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
