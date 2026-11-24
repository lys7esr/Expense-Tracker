
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal


FREQUENCIES = (
    "daily",
    "weekly",
    "monthly",
    "yearly"
)


def next_occurrence(
    current_date,
    frequency,
    anchor_day,
    anchor_month
):
    if frequency == "daily":
        return current_date + timedelta(days=1)

    if frequency == "weekly":
        return current_date + timedelta(days=7)

    if frequency == "monthly":
        year = current_date.year
        month = current_date.month + 1

        if month > 12:
            month = 1
            year += 1

        last_day = monthrange(year, month)[1]

        return date(
            year,
            month,
            min(anchor_day, last_day)
        )

    if frequency == "yearly":
        year = current_date.year + 1

        last_day = monthrange(
            year,
            anchor_month
        )[1]

        return date(
            year,
            anchor_month,
            min(anchor_day, last_day)
        )

    raise ValueError("Invalid frequency")


def monthly_equivalent(amount_paise, frequency):
    amount = Decimal(amount_paise) / 100

    factors = {
        "daily": Decimal(365) / 12,
        "weekly": Decimal(52) / 12,
        "monthly": Decimal(1),
        "yearly": Decimal(1) / 12
    }

    return amount * factors[frequency]


def schedule_status(schedule):
    if not schedule.active:
        return "paused"

    days = (
        schedule.next_due_date - date.today()
    ).days

    if days < 0:
        return "overdue"

    if days == 0:
        return "due"

    if days <= 7:
        return "upcoming"

    return "scheduled"
