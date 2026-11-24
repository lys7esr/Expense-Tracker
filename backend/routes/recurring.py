
from datetime import date
from decimal import Decimal

from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError, OperationalError

from database import db
from config import DEV_USER_ID

from models import (
    RecurringSchedule,
    RecurringOccurrence,
    Transaction
)

from utils.validators import to_paise
from services.categories import get_category

from services.recurrence import (
    FREQUENCIES,
    next_occurrence,
    monthly_equivalent,
    schedule_status
)


recurring_bp = Blueprint("recurring", __name__)


# ==========================================
# HELPERS
# ==========================================

def find_schedule(schedule_id):
    return db.session.execute(
        db.select(RecurringSchedule).filter_by(
            id=schedule_id,
            user_id=DEV_USER_ID
        )
    ).scalar_one_or_none()


def parse_date(value):
    try:
        return date.fromisoformat(str(value))

    except (ValueError, TypeError):
        raise ValueError("Date must be YYYY-MM-DD")


def serialize_occurrence(item):
    return {
        "id": item.id,
        "due_date": item.due_date.isoformat(),
        "status": item.status,
        "amount": item.amount_paise / 100,
        "transaction_id": item.transaction_id,
        "processed_date": item.processed_date.isoformat()
    }


def serialize_schedule(schedule):
    history = sorted(
        schedule.occurrences,
        key=lambda item: (item.due_date, item.id),
        reverse=True
    )

    return {
        "id": schedule.id,
        "name": schedule.name,
        "type": schedule.type,
        "amount": schedule.amount_paise / 100,
        "category": schedule.category.name,
        "frequency": schedule.frequency,
        "description": schedule.description or "",
        "active": schedule.active,

        "next_due_date":
            schedule.next_due_date.isoformat(),

        "days_until_due": (
            schedule.next_due_date - date.today()
        ).days,

        "monthly_equivalent": float(
            round(
                monthly_equivalent(
                    schedule.amount_paise,
                    schedule.frequency
                ),
                2
            )
        ),

        "status": schedule_status(schedule),

        "history": [
            serialize_occurrence(item)
            for item in history
        ]
    }


def parse_schedule(data):
    if not isinstance(data, dict):
        raise ValueError("JSON object required")

    name = str(data.get("name") or "").strip()

    if not name or len(name) > 100:
        raise ValueError("Invalid schedule name")

    tx_type = data.get("type")

    if tx_type not in ("income", "expense"):
        raise ValueError("Invalid transaction type")

    frequency = data.get("frequency")

    if frequency not in FREQUENCIES:
        raise ValueError("Invalid frequency")

    amount = to_paise(data.get("amount"))

    category_name = str(
        data.get("category") or ""
    ).strip()

    if not category_name or len(category_name) > 100:
        raise ValueError("Invalid category")

    due_date = parse_date(
        data.get("next_due_date")
    )

    description = str(
        data.get("description") or ""
    ).strip()

    if len(description) > 255:
        raise ValueError("Description is too long")

    return {
        "name": name,
        "type": tx_type,
        "amount_paise": amount,
        "frequency": frequency,
        "category": get_category(
            category_name,
            tx_type
        ),
        "next_due_date": due_date,
        "anchor_day": due_date.day,
        "anchor_month": due_date.month,
        "description": description
    }


# ==========================================
# LIST SCHEDULES
# ==========================================

@recurring_bp.route("/recurring", methods=["GET"])
def list_schedules():
    schedules = db.session.execute(
        db.select(RecurringSchedule)
        .filter_by(user_id=DEV_USER_ID)
        .order_by(
            RecurringSchedule.next_due_date.asc(),
            RecurringSchedule.id.asc()
        )
    ).scalars().all()

    active = [
        item for item in schedules
        if item.active
    ]

    monthly_expenses = sum(
        (
            monthly_equivalent(
                item.amount_paise,
                item.frequency
            )
            for item in active
            if item.type == "expense"
        ),
        Decimal(0)
    )

    monthly_income = sum(
        (
            monthly_equivalent(
                item.amount_paise,
                item.frequency
            )
            for item in active
            if item.type == "income"
        ),
        Decimal(0)
    )

    return jsonify({
        "monthly_expenses": float(
            round(monthly_expenses, 2)
        ),

        "monthly_income": float(
            round(monthly_income, 2)
        ),

        "monthly_net": float(
            round(monthly_income - monthly_expenses, 2)
        ),

        "active_count": len(active),

        "due_count": sum(
            item.next_due_date <= date.today()
            for item in active
        ),

        "schedules": [
            serialize_schedule(item)
            for item in schedules
        ]
    })


# ==========================================
# CREATE SCHEDULE
# ==========================================

@recurring_bp.route("/recurring", methods=["POST"])
def create_schedule():
    try:
        fields = parse_schedule(
            request.get_json(silent=True)
        )

        schedule = RecurringSchedule(
            user_id=DEV_USER_ID,
            active=True,
            **fields
        )

        db.session.add(schedule)
        db.session.commit()

        return jsonify(
            serialize_schedule(schedule)
        ), 201

    except (ValueError, IntegrityError) as error:
        db.session.rollback()

        return jsonify({
            "error": str(error)
        }), 400


# ==========================================
# UPDATE SCHEDULE
# ==========================================

@recurring_bp.route(
    "/recurring/<int:schedule_id>",
    methods=["PUT"]
)
def update_schedule(schedule_id):
    schedule = find_schedule(schedule_id)

    if schedule is None:
        return jsonify({
            "error": "Schedule not found"
        }), 404

    try:
        fields = parse_schedule(
            request.get_json(silent=True)
        )

        new_due_date = fields["next_due_date"]

        if any(
            item.due_date >= new_due_date
            for item in schedule.occurrences
        ):
            raise ValueError(
                "Next due date must be after "
                "previously processed occurrences"
            )

        if (
            new_due_date == schedule.next_due_date
            and fields["frequency"] == schedule.frequency
        ):
            fields["anchor_day"] = schedule.anchor_day
            fields["anchor_month"] = schedule.anchor_month

        for key, value in fields.items():
            setattr(schedule, key, value)

        db.session.commit()

        return jsonify(
            serialize_schedule(schedule)
        )

    except (ValueError, IntegrityError) as error:
        db.session.rollback()

        return jsonify({
            "error": str(error)
        }), 400


# ==========================================
# PAUSE OR RESUME
# ==========================================

@recurring_bp.route(
    "/recurring/<int:schedule_id>/active",
    methods=["PATCH"]
)
def set_schedule_active(schedule_id):
    schedule = find_schedule(schedule_id)

    if schedule is None:
        return jsonify({
            "error": "Schedule not found"
        }), 404

    data = request.get_json(silent=True)

    if (
        not isinstance(data, dict)
        or not isinstance(data.get("active"), bool)
    ):
        return jsonify({
            "error": "Active must be true or false"
        }), 400

    schedule.active = data["active"]

    db.session.commit()

    return jsonify(
        serialize_schedule(schedule)
    )


# ==========================================
# CONFIRM OR SKIP OCCURRENCE
# ==========================================

@recurring_bp.route(
    "/recurring/<int:schedule_id>/process",
    methods=["POST"]
)
def process_occurrence(schedule_id):
    schedule = find_schedule(schedule_id)

    if schedule is None:
        return jsonify({
            "error": "Schedule not found"
        }), 404

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            raise ValueError("JSON object required")

        if not schedule.active:
            raise ValueError("Schedule is paused")

        action = data.get("action")

        if action not in ("confirm", "skip"):
            raise ValueError("Invalid action")

        expected_due_date = parse_date(
            data.get("due_date")
        )

        if expected_due_date != schedule.next_due_date:
            return jsonify({
                "error": "Occurrence has already changed. Refresh and try again."
            }), 409

        due_date = schedule.next_due_date

        if due_date > date.today():
            raise ValueError(
                "This occurrence is not due yet"
            )

        existing = db.session.execute(
            db.select(RecurringOccurrence).filter_by(
                schedule_id=schedule.id,
                due_date=due_date
            )
        ).scalar_one_or_none()

        if existing:
            return jsonify({
                "error": "Occurrence already processed"
            }), 409

        transaction_id = None
        amount = schedule.amount_paise
        processed_date = date.today()

        if action == "confirm":
            amount = to_paise(data.get("amount"))

            processed_date = parse_date(
                data.get("date")
            )

            if processed_date > date.today():
                raise ValueError(
                    "Payment date cannot be in the future"
                )

            transaction = Transaction(
                user_id=DEV_USER_ID,
                category_id=schedule.category_id,
                type=schedule.type,
                amount_paise=amount,
                subcategory="Recurring",
                description=f"{schedule.name} (Recurring)",
                date=processed_date
            )

            db.session.add(transaction)
            db.session.flush()

            transaction_id = transaction.id

        occurrence = RecurringOccurrence(
            schedule_id=schedule.id,
            due_date=due_date,

            status=(
                "confirmed"
                if action == "confirm"
                else "skipped"
            ),

            amount_paise=(
                amount if action == "confirm" else 0
            ),

            transaction_id=transaction_id,
            processed_date=processed_date
        )

        db.session.add(occurrence)

        schedule.next_due_date = next_occurrence(
            due_date,
            schedule.frequency,
            schedule.anchor_day,
            schedule.anchor_month
        )

        db.session.commit()

        return jsonify(
            serialize_schedule(schedule)
        )

    except ValueError as error:
        db.session.rollback()

        return jsonify({
            "error": str(error)
        }), 400

    except (IntegrityError, OperationalError):
        db.session.rollback()

        return jsonify({
            "error": "Could not process occurrence. Refresh and try again."
        }), 409


# ==========================================
# DELETE SCHEDULE
# ==========================================

@recurring_bp.route(
    "/recurring/<int:schedule_id>",
    methods=["DELETE"]
)
def delete_schedule(schedule_id):
    schedule = find_schedule(schedule_id)

    if schedule is None:
        return jsonify({
            "error": "Schedule not found"
        }), 404

    db.session.delete(schedule)
    db.session.commit()

    return jsonify({
        "message": "Schedule deleted"
    })
