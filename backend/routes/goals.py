from datetime import date
from math import ceil

from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError

from database import db
from models import (
    SavingsGoal,
    SavingsContribution,
)

from config import DEV_USER_ID
from utils.validators import to_paise


goals_bp = Blueprint("goals", __name__)


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


@goals_bp.route("/goals", methods=["GET"])
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


@goals_bp.route("/goals", methods=["POST"])
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


@goals_bp.route("/goals/<int:goal_id>", methods=["PUT"])
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


@goals_bp.route(
    "/goals/<int:goal_id>",
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


@goals_bp.route(
    "/goals/<int:goal_id>/contributions",
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


@goals_bp.route(
    "/goals/<int:goal_id>/contributions/<int:contribution_id>",
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
