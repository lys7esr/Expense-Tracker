
from datetime import date

from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError

from database import db
from models import MoneyRecord, MoneyRepayment
from config import DEV_USER_ID
from utils.validators import to_paise


people_bp = Blueprint("people", __name__)


# ==========================================
# HELPERS
# ==========================================

def total_repaid(record):
    return sum(
        item.amount_paise
        for item in record.repayments
    )


def outstanding_balance(record):
    return record.amount_paise - total_repaid(record)


def find_record(record_id):
    return db.session.execute(
        db.select(MoneyRecord).filter_by(
            id=record_id,
            user_id=DEV_USER_ID
        )
    ).scalar_one_or_none()


def parse_date(value, field):
    try:
        return date.fromisoformat(str(value))

    except (ValueError, TypeError):
        raise ValueError(
            f"{field} must be YYYY-MM-DD"
        )


def serialize_repayment(repayment):
    return {
        "id": repayment.id,
        "amount": repayment.amount_paise / 100,
        "date": repayment.date.isoformat(),
        "note": repayment.note or ""
    }


def serialize_record(record):
    repaid = total_repaid(record)
    outstanding = outstanding_balance(record)

    if outstanding == 0:
        status = "settled"

    elif record.due_date and record.due_date < date.today():
        status = "overdue"

    else:
        status = "outstanding"

    repayments = sorted(
        record.repayments,
        key=lambda item: (item.date, item.id),
        reverse=True
    )

    return {
        "id": record.id,
        "person": record.person,
        "type": record.type,
        "amount": record.amount_paise / 100,
        "purpose": record.purpose or "",
        "date": record.date.isoformat(),

        "due_date": (
            record.due_date.isoformat()
            if record.due_date else None
        ),

        "repaid": repaid / 100,
        "outstanding": outstanding / 100,

        "percentage": round(
            repaid / record.amount_paise * 100,
            2
        ),

        "status": status,

        "repayments": [
            serialize_repayment(item)
            for item in repayments
        ]
    }


def parse_record(data):
    if not isinstance(data, dict):
        raise ValueError("JSON object required")

    person = data.get("person")

    if not isinstance(person, str):
        raise ValueError("Person name is required")

    person = person.strip()

    if not person or len(person) > 100:
        raise ValueError("Invalid person name")

    record_type = data.get("type")

    if record_type not in ("lent", "borrowed"):
        raise ValueError("Invalid record type")

    amount = to_paise(data.get("amount"))

    purpose = str(
        data.get("purpose") or ""
    ).strip()

    if len(purpose) > 255:
        raise ValueError("Purpose is too long")

    record_date = parse_date(
        data.get("date"),
        "Date"
    )

    if record_date > date.today():
        raise ValueError(
            "Record date cannot be in the future"
        )

    due_date = None

    if data.get("due_date"):
        due_date = parse_date(
            data["due_date"],
            "Due date"
        )

        if due_date < record_date:
            raise ValueError(
                "Due date cannot be before record date"
            )

    return {
        "person": person,
        "type": record_type,
        "amount_paise": amount,
        "purpose": purpose,
        "date": record_date,
        "due_date": due_date
    }


# ==========================================
# LIST RECORDS
# ==========================================

@people_bp.route("/people", methods=["GET"])
def list_records():
    records = db.session.execute(
        db.select(MoneyRecord)
        .filter_by(user_id=DEV_USER_ID)
        .order_by(
            MoneyRecord.date.desc(),
            MoneyRecord.id.desc()
        )
    ).scalars().all()

    receivable = sum(
        outstanding_balance(record)
        for record in records
        if record.type == "lent"
    )

    payable = sum(
        outstanding_balance(record)
        for record in records
        if record.type == "borrowed"
    )

    serialized = [
        serialize_record(record)
        for record in records
    ]

    return jsonify({
        "receivable": receivable / 100,
        "payable": payable / 100,
        "net_position": (receivable - payable) / 100,

        "settled_count": sum(
            item["status"] == "settled"
            for item in serialized
        ),

        "overdue_count": sum(
            item["status"] == "overdue"
            for item in serialized
        ),

        "records": serialized
    })


# ==========================================
# CREATE RECORD
# ==========================================

@people_bp.route("/people", methods=["POST"])
def create_record():
    try:
        fields = parse_record(
            request.get_json(silent=True)
        )

        record = MoneyRecord(
            user_id=DEV_USER_ID,
            **fields
        )

        db.session.add(record)
        db.session.commit()

        return jsonify(
            serialize_record(record)
        ), 201

    except (ValueError, IntegrityError) as error:
        db.session.rollback()

        return jsonify({
            "error": str(error)
        }), 400


# ==========================================
# UPDATE RECORD
# ==========================================

@people_bp.route(
    "/people/<int:record_id>",
    methods=["PUT"]
)
def update_record(record_id):
    record = find_record(record_id)

    if record is None:
        return jsonify({
            "error": "Record not found"
        }), 404

    try:
        fields = parse_record(
            request.get_json(silent=True)
        )

        if fields["amount_paise"] < total_repaid(record):
            raise ValueError(
                "Amount cannot be less than repayments"
            )

        if record.repayments:
            if fields["type"] != record.type:
                raise ValueError(
                    "Cannot change type after repayments"
                )

            if any(
                item.date < fields["date"]
                for item in record.repayments
            ):
                raise ValueError(
                    "Record date cannot be after a repayment"
                )

        for key, value in fields.items():
            setattr(record, key, value)

        db.session.commit()

        return jsonify(
            serialize_record(record)
        )

    except (ValueError, IntegrityError) as error:
        db.session.rollback()

        return jsonify({
            "error": str(error)
        }), 400


# ==========================================
# DELETE RECORD
# ==========================================

@people_bp.route(
    "/people/<int:record_id>",
    methods=["DELETE"]
)
def delete_record(record_id):
    record = find_record(record_id)

    if record is None:
        return jsonify({
            "error": "Record not found"
        }), 404

    db.session.delete(record)
    db.session.commit()

    return jsonify({
        "message": "Record deleted"
    })


# ==========================================
# RECORD REPAYMENT
# ==========================================

@people_bp.route(
    "/people/<int:record_id>/repayments",
    methods=["POST"]
)
def add_repayment(record_id):
    record = find_record(record_id)

    if record is None:
        return jsonify({
            "error": "Record not found"
        }), 404

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            raise ValueError("JSON object required")

        amount = to_paise(data.get("amount"))

        if amount > outstanding_balance(record):
            raise ValueError(
                "Repayment exceeds outstanding balance"
            )

        repayment_date = parse_date(
            data.get("date"),
            "Repayment date"
        )

        if repayment_date > date.today():
            raise ValueError(
                "Repayment date cannot be in the future"
            )

        if repayment_date < record.date:
            raise ValueError(
                "Repayment cannot precede the record"
            )

        note = str(
            data.get("note") or ""
        ).strip()

        if len(note) > 255:
            raise ValueError("Note is too long")

        repayment = MoneyRepayment(
            record_id=record.id,
            amount_paise=amount,
            date=repayment_date,
            note=note
        )

        db.session.add(repayment)
        db.session.commit()

        return jsonify(
            serialize_record(record)
        ), 201

    except (ValueError, IntegrityError) as error:
        db.session.rollback()

        return jsonify({
            "error": str(error)
        }), 400


# ==========================================
# REMOVE INCORRECT REPAYMENT
# ==========================================

@people_bp.route(
    "/people/<int:record_id>/repayments/<int:repayment_id>",
    methods=["DELETE"]
)
def delete_repayment(record_id, repayment_id):
    record = find_record(record_id)

    if record is None:
        return jsonify({
            "error": "Record not found"
        }), 404

    repayment = db.session.execute(
        db.select(MoneyRepayment).filter_by(
            id=repayment_id,
            record_id=record.id
        )
    ).scalar_one_or_none()

    if repayment is None:
        return jsonify({
            "error": "Repayment not found"
        }), 404

    db.session.delete(repayment)
    db.session.commit()

    return jsonify(
        serialize_record(record)
    )
