from datetime import date

from flask import Blueprint, jsonify, request

from database import db
from config import DEV_USER_ID
from models import CyclePreference, CycleRecord


cycles_bp = Blueprint("cycles", __name__)


def serialize_cycle(record):
    return {
        "id": record.id,
        "start_date": record.start_date.isoformat(),
        "end_date": record.end_date.isoformat(),
        "days": (
            record.end_date - record.start_date
        ).days + 1
    }


def parse_cycle(data, exclude_id=None):
    if not isinstance(data, dict):
        raise ValueError("JSON object required")

    try:
        start = date.fromisoformat(data["start_date"])
        end = date.fromisoformat(data["end_date"])
    except (KeyError, ValueError, TypeError):
        raise ValueError("Valid start and end dates required")

    if end < start:
        raise ValueError("End date cannot precede start date")

    if end > date.today():
        raise ValueError("Future dates cannot be logged")

    query = db.select(CycleRecord).where(
        CycleRecord.user_id == DEV_USER_ID,
        CycleRecord.start_date <= end,
        CycleRecord.end_date >= start
    )

    if exclude_id is not None:
        query = query.where(
            CycleRecord.id != exclude_id
        )

    overlap = db.session.execute(
        query
    ).scalars().first()

    if overlap:
        raise ValueError(
            "These dates overlap an existing record"
        )

    return start, end


def cycle_enabled():
    preference = db.session.get(
        CyclePreference, DEV_USER_ID
    )

    return bool(preference and preference.enabled)


@cycles_bp.get("/cycles")
def list_cycles():
    records = db.session.execute(
        db.select(CycleRecord)
        .filter_by(user_id=DEV_USER_ID)
        .order_by(CycleRecord.start_date.desc())
    ).scalars().all()

    return jsonify({
        "enabled": cycle_enabled(),
        "records": [
            serialize_cycle(record)
            for record in records
        ]
    })


@cycles_bp.put("/cycles/preferences")
def update_preferences():
    data = request.get_json(silent=True)

    if (
        not isinstance(data, dict)
        or not isinstance(data.get("enabled"), bool)
    ):
        return jsonify({
            "error": "enabled must be a boolean"
        }), 400

    preference = db.session.get(
        CyclePreference, DEV_USER_ID
    )

    if preference is None:
        preference = CyclePreference(
            user_id=DEV_USER_ID
        )

        db.session.add(preference)

    preference.enabled = data["enabled"]

    db.session.commit()

    return jsonify({
        "enabled": preference.enabled
    })


@cycles_bp.post("/cycles")
def create_cycle():
    if not cycle_enabled():
        return jsonify({
            "error": "Enable cycle insights first"
        }), 403

    try:
        start, end = parse_cycle(
            request.get_json(silent=True)
        )

        record = CycleRecord(
            user_id=DEV_USER_ID,
            start_date=start,
            end_date=end
        )

        db.session.add(record)
        db.session.commit()

        return jsonify(serialize_cycle(record)), 201

    except ValueError as error:
        db.session.rollback()
        return jsonify({"error": str(error)}), 400


@cycles_bp.put("/cycles/<int:record_id>")
def update_cycle(record_id):
    if not cycle_enabled():
        return jsonify({
            "error": "Enable cycle insights first"
        }), 403

    record = db.session.get(
        CycleRecord, record_id
    )

    if record is None or record.user_id != DEV_USER_ID:
        return jsonify({
            "error": "Record not found"
        }), 404

    try:
        start, end = parse_cycle(
            request.get_json(silent=True),
            exclude_id=record_id
        )

        record.start_date = start
        record.end_date = end

        db.session.commit()

        return jsonify(serialize_cycle(record))

    except ValueError as error:
        db.session.rollback()
        return jsonify({"error": str(error)}), 400


@cycles_bp.delete("/cycles/<int:record_id>")
def delete_cycle(record_id):
    record = db.session.get(
        CycleRecord, record_id
    )

    if record is None or record.user_id != DEV_USER_ID:
        return jsonify({
            "error": "Record not found"
        }), 404

    db.session.delete(record)
    db.session.commit()

    return jsonify({
        "message": "Cycle record deleted"
    })


@cycles_bp.delete("/cycles")
def delete_all_cycles():
    db.session.execute(
        db.delete(CycleRecord)
        .where(CycleRecord.user_id == DEV_USER_ID)
    )

    preference = db.session.get(
        CyclePreference, DEV_USER_ID
    )

    if preference:
        preference.enabled = False

    db.session.commit()

    return jsonify({
        "message": "All cycle records deleted",
        "enabled": False
    })