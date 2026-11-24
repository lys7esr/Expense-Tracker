from datetime import date

from flask import Blueprint, request, jsonify
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from database import db
from models import (
    Budget,
    CategoryBudget,
    Category,
    Transaction,
)

from config import DEV_USER_ID
from utils.validators import (
    to_paise,
    validate_month,
)

from services.categories import get_category


budgets_bp = Blueprint("budgets", __name__)


@budgets_bp.route("/budgets/<month>", methods=["GET"])
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


@budgets_bp.route("/budgets/<month>", methods=["PUT"])
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


def budget_details(limit, spent):
    percentage = (spent / limit) * 100 if limit else 0

    if not limit:
        status = "not_set"
    elif spent > limit:
        status = "exceeded"
    elif spent == limit:
        status = "reached"
    elif percentage >= 80:
        status = "warning"
    else:
        status = "healthy"

    return {
        "budget": limit / 100,
        "spent": spent / 100,
        "remaining": (limit - spent) / 100 if limit else None,
        "percentage": round(percentage, 2),
        "status": status
    }


@budgets_bp.route("/budget-overview/<month>", methods=["GET"])
def budget_overview(month):
    try:
        validate_month(month)

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    expenses = db.session.execute(
        db.select(Transaction).filter(
            Transaction.user_id == DEV_USER_ID,
            Transaction.type == "expense",
            func.strftime("%Y-%m", Transaction.date) == month
        )
    ).scalars().all()

    total_spent = sum(
        transaction.amount_paise
        for transaction in expenses
    )

    spending = {}

    for transaction in expenses:
        category_id = transaction.category_id

        spending[category_id] = (
            spending.get(category_id, 0)
            + transaction.amount_paise
        )

    overall = db.session.execute(
        db.select(Budget).filter_by(
            user_id=DEV_USER_ID,
            month=month
        )
    ).scalar_one_or_none()

    category_budgets = db.session.execute(
        db.select(CategoryBudget).filter_by(
            user_id=DEV_USER_ID,
            month=month
        )
    ).scalars().all()

    limits = {
        budget.category_id: budget
        for budget in category_budgets
    }

    categories = db.session.execute(
        db.select(Category)
        .filter_by(
            user_id=DEV_USER_ID,
            type="expense"
        )
        .order_by(Category.name)
    ).scalars().all()

    category_results = []

    for category in categories:
        budget = limits.get(category.id)

        limit = budget.amount_paise if budget else 0
        spent = spending.get(category.id, 0)

        category_results.append({
            "category_id": category.id,
            "category": category.name,
            **budget_details(limit, spent)
        })

    allocated = sum(
        budget.amount_paise
        for budget in category_budgets
    )

    overall_limit = overall.amount_paise if overall else 0

    return jsonify({
        "month": month,

        "overall": budget_details(
            overall_limit,
            total_spent
        ),

        "allocated": allocated / 100,

        "unallocated": (
            (overall_limit - allocated) / 100
            if overall_limit else None
        ),

        "categories": category_results
    })


@budgets_bp.route(
    "/category-budgets/<month>",
    methods=["PUT"]
)
def save_category_budget(month):
    try:
        validate_month(month)

        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            raise ValueError("JSON object required")

        name = data.get("category")

        if not isinstance(name, str):
            raise ValueError("Category is required")

        name = name.strip()

        if not name or len(name) > 100:
            raise ValueError("Invalid category name")

        amount = to_paise(data.get("amount"))

        category = get_category(name, "expense")

        budget = db.session.execute(
            db.select(CategoryBudget).filter_by(
                user_id=DEV_USER_ID,
                category_id=category.id,
                month=month
            )
        ).scalar_one_or_none()

        if budget is None:
            budget = CategoryBudget(
                user_id=DEV_USER_ID,
                category_id=category.id,
                month=month
            )

            db.session.add(budget)

        budget.amount_paise = amount

        db.session.commit()

        return jsonify({
            "message": "Category budget saved",
            "category_id": category.id,
            "category": category.name,
            "budget": amount / 100
        })

    except (ValueError, IntegrityError) as error:
        db.session.rollback()

        return jsonify({
            "error": str(error)
        }), 400


@budgets_bp.route(
    "/category-budgets/<month>/<int:category_id>",
    methods=["DELETE"]
)
def delete_category_budget(month, category_id):
    try:
        validate_month(month)

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    budget = db.session.execute(
        db.select(CategoryBudget).filter_by(
            user_id=DEV_USER_ID,
            category_id=category_id,
            month=month
        )
    ).scalar_one_or_none()

    if budget is None:
        return jsonify({
            "error": "Category budget not found"
        }), 404

    db.session.delete(budget)
    db.session.commit()

    return jsonify({
        "message": "Category budget removed"
    })


@budgets_bp.route("/budgets/<month>", methods=["DELETE"])
def delete_overall_budget(month):
    try:
        validate_month(month)

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    budget = db.session.execute(
        db.select(Budget).filter_by(
            user_id=DEV_USER_ID,
            month=month
        )
    ).scalar_one_or_none()

    if budget is None:
        return jsonify({
            "error": "Overall budget not found"
        }), 404

    db.session.delete(budget)
    db.session.commit()

    return jsonify({
        "message": "Overall budget removed"
    })
