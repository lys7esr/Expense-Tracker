from datetime import date

from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError

from database import db
from models import Transaction
from config import DEV_USER_ID

from utils.validators import to_paise
from services.categories import get_category


transactions_bp = Blueprint("transactions", __name__)


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


@transactions_bp.route("/transactions", methods=["GET"])
def list_transactions():
    transactions = db.session.execute(
        db.select(Transaction)
        .filter_by(user_id=DEV_USER_ID)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
    ).scalars().all()

    return jsonify([serialize_transaction(t) for t in transactions])


@transactions_bp.route("/transactions", methods=["POST"])
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


@transactions_bp.route("/transactions/<int:tx_id>", methods=["PUT"])
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


@transactions_bp.route("/transactions/<int:tx_id>", methods=["DELETE"])
def delete_transaction(tx_id):
    transaction = db.session.get(Transaction, tx_id)

    if transaction is None or transaction.user_id != DEV_USER_ID:
        return jsonify({"error": "Transaction not found"}), 404

    db.session.delete(transaction)
    db.session.commit()
    return jsonify({"message": "Transaction deleted"})
