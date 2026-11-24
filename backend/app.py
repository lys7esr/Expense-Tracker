
from datetime import date
from decimal import Decimal, InvalidOperation
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from math import ceil

from database import db
from models import (
    User, 
    Category, 
    Transaction, 
    Budget,
    CategoryBudget,
    SavingsGoal,
    SavingsContribution,
)

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

def validate_month(month):
    try:
        if len(month) != 7:
            raise ValueError()

        date.fromisoformat(month + "-01")

    except ValueError:
        raise ValueError("Month must be YYYY-MM")


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


@app.route("/api/budget-overview/<month>", methods=["GET"])
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


@app.route(
    "/api/category-budgets/<month>",
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


@app.route(
    "/api/category-budgets/<month>/<int:category_id>",
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


@app.route("/api/budgets/<month>", methods=["DELETE"])
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

def goal_balance(goal):
    return sum(
        contribution.amount_paise
        if contribution.type == "deposit"
        else -contribution.amount_paise
        for contribution in goal.contributions
    )


def serialize_contribution(contribution):
    return {
        "id": contribution.id,
        "amount": contribution.amount_paise / 100,
        "type": contribution.type,
        "date": contribution.date.isoformat(),
        "note": contribution.note or ""
    }


def serialize_goal(goal):
    saved = goal_balance(goal)

    remaining = max(
        0,
        goal.target_paise - saved
    )

    percentage = (
        saved / goal.target_paise
    ) * 100

    days_left = None
    monthly_required = None

    if saved >= goal.target_paise:
        status = "completed"

    elif goal.deadline and goal.deadline < date.today():
        status = "overdue"

    else:
        status = "active"

    if goal.deadline:
        days_left = (
            goal.deadline - date.today()
        ).days

        if remaining == 0:
            monthly_required = 0

        elif days_left >= 0:
            months_left = max(
                1,
                ceil(days_left / 30)
            )

            monthly_required = (
                ceil(remaining / months_left) / 100
            )

    history = sorted(
        goal.contributions,
        key=lambda item: (item.date, item.id),
        reverse=True
    )

    return {
        "id": goal.id,
        "name": goal.name,
        "description": goal.description or "",
        "target": goal.target_paise / 100,
        "saved": saved / 100,
        "remaining": remaining / 100,
        "percentage": round(percentage, 2),

        "deadline": (
            goal.deadline.isoformat()
            if goal.deadline else None
        ),

        "days_left": days_left,
        "monthly_required": monthly_required,
        "status": status,

        "contributions": [
            serialize_contribution(item)
            for item in history
        ]
    }


def parse_goal(data):
    if not isinstance(data, dict):
        raise ValueError("JSON object required")

    name = data.get("name")

    if not isinstance(name, str):
        raise ValueError("Goal name is required")

    name = name.strip()

    if not name or len(name) > 100:
        raise ValueError("Invalid goal name")

    target = to_paise(data.get("target"))

    description = str(
        data.get("description") or ""
    ).strip()

    if len(description) > 255:
        raise ValueError("Description is too long")

    deadline = None

    if data.get("deadline"):
        try:
            deadline = date.fromisoformat(
                str(data["deadline"])
            )

        except ValueError:
            raise ValueError(
                "Deadline must be YYYY-MM-DD"
            )

    return {
        "name": name,
        "target_paise": target,
        "deadline": deadline,
        "description": description
    }


def find_goal(goal_id):
    return db.session.execute(
        db.select(SavingsGoal).filter_by(
            id=goal_id,
            user_id=DEV_USER_ID
        )
    ).scalar_one_or_none()


@app.route("/api/goals", methods=["GET"])
def list_goals():
    goals = db.session.execute(
        db.select(SavingsGoal)
        .filter_by(user_id=DEV_USER_ID)
        .order_by(SavingsGoal.id.desc())
    ).scalars().all()

    return jsonify([
        serialize_goal(goal)
        for goal in goals
    ])


@app.route("/api/goals", methods=["POST"])
def create_goal():
    try:
        data = request.get_json(silent=True)

        fields = parse_goal(data)

        goal = SavingsGoal(
            user_id=DEV_USER_ID,
            **fields
        )

        db.session.add(goal)
        db.session.commit()

        return jsonify(
            serialize_goal(goal)
        ), 201

    except (ValueError, IntegrityError) as error:
        db.session.rollback()

        return jsonify({
            "error": str(error)
        }), 400


@app.route("/api/goals/<int:goal_id>", methods=["PUT"])
def update_goal(goal_id):
    goal = find_goal(goal_id)

    if goal is None:
        return jsonify({
            "error": "Goal not found"
        }), 404

    try:
        data = request.get_json(silent=True)

        fields = parse_goal(data)

        for key, value in fields.items():
            setattr(goal, key, value)

        db.session.commit()

        return jsonify(
            serialize_goal(goal)
        )

    except (ValueError, IntegrityError) as error:
        db.session.rollback()

        return jsonify({
            "error": str(error)
        }), 400


@app.route(
    "/api/goals/<int:goal_id>",
    methods=["DELETE"]
)
def delete_goal(goal_id):
    goal = find_goal(goal_id)

    if goal is None:
        return jsonify({
            "error": "Goal not found"
        }), 404

    db.session.delete(goal)
    db.session.commit()

    return jsonify({
        "message": "Goal deleted"
    })


@app.route(
    "/api/goals/<int:goal_id>/contributions",
    methods=["POST"]
)
def add_goal_contribution(goal_id):
    goal = find_goal(goal_id)

    if goal is None:
        return jsonify({
            "error": "Goal not found"
        }), 404

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            raise ValueError("JSON object required")

        contribution_type = data.get(
            "type",
            "deposit"
        )

        if contribution_type not in (
            "deposit",
            "withdrawal"
        ):
            raise ValueError(
                "Invalid contribution type"
            )

        amount = to_paise(data.get("amount"))

        if (
            contribution_type == "withdrawal"
            and amount > goal_balance(goal)
        ):
            raise ValueError(
                "Withdrawal exceeds saved amount"
            )

        try:
            contribution_date = date.fromisoformat(
                str(data.get("date"))
            )

        except ValueError:
            raise ValueError(
                "Date must be YYYY-MM-DD"
            )

        if contribution_date > date.today():
            raise ValueError(
                "Contribution date cannot be in the future"
            )

        note = str(
            data.get("note") or ""
        ).strip()

        if len(note) > 255:
            raise ValueError("Note is too long")

        contribution = SavingsContribution(
            goal_id=goal.id,
            amount_paise=amount,
            type=contribution_type,
            date=contribution_date,
            note=note
        )

        db.session.add(contribution)
        db.session.commit()

        return jsonify(
            serialize_goal(goal)
        ), 201

    except (ValueError, IntegrityError) as error:
        db.session.rollback()

        return jsonify({
            "error": str(error)
        }), 400


@app.route(
    "/api/goals/<int:goal_id>/contributions/<int:contribution_id>",
    methods=["DELETE"]
)
def delete_goal_contribution(
    goal_id,
    contribution_id
):
    goal = find_goal(goal_id)

    if goal is None:
        return jsonify({
            "error": "Goal not found"
        }), 404

    contribution = db.session.execute(
        db.select(SavingsContribution).filter_by(
            id=contribution_id,
            goal_id=goal.id
        )
    ).scalar_one_or_none()

    if contribution is None:
        return jsonify({
            "error": "Contribution not found"
        }), 404

    if (
        contribution.type == "deposit"
        and goal_balance(goal) < contribution.amount_paise
    ):
        return jsonify({
            "error": "Removing this deposit would create a negative balance"
        }), 400

    db.session.delete(contribution)
    db.session.commit()

    return jsonify(
        serialize_goal(goal)
    )

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
