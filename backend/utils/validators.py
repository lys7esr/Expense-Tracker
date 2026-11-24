from datetime import date
from decimal import Decimal, InvalidOperation


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


def validate_month(month):
    try:
        if len(month) != 7:
            raise ValueError()

        date.fromisoformat(month + "-01")

    except ValueError:
        raise ValueError("Month must be YYYY-MM")
