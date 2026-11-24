from collections import defaultdict
from datetime import timedelta

from database import db
from models import CyclePreference, CycleRecord

from services.intelligence.analytics import (
    money,
    percentage_change,
    date_range
)


def analyze_cycles(user_id, context):
    preference = db.session.get(
        CyclePreference, user_id
    )

    if not preference or not preference.enabled:
        return {
            "enabled": False,
            "available": False
        }

    today = context["as_of"]

    records = db.session.execute(
        db.select(CycleRecord)
        .where(
            CycleRecord.user_id == user_id,
            CycleRecord.end_date <= today
        )
        .order_by(CycleRecord.start_date)
    ).scalars().all()

    transactions = context["transactions"]

    if not records or not transactions:
        return {
            "enabled": True,
            "available": False,
            "message": (
                "Log completed cycles and transactions "
                "to discover spending patterns."
            )
        }

    first_recorded = transactions[0].date

    records = [
        record for record in records
        if record.start_date >= first_recorded
    ]

    if not records:
        return {
            "enabled": True,
            "available": False,
            "message": "Insufficient overlapping history."
        }

    expenses = [
        tx for tx in transactions
        if tx.type == "expense"
    ]

    daily = defaultdict(int)

    for tx in expenses:
        daily[tx.date] += tx.amount_paise

    period_days = set()
    cycle_summaries = []

    for record in records:
        days = list(date_range(
            record.start_date,
            record.end_date
        ))

        period_days.update(days)

        total = sum(daily[d] for d in days)

        cycle_summaries.append({
            "id": record.id,
            "start_date": record.start_date.isoformat(),
            "end_date": record.end_date.isoformat(),
            "days": len(days),
            "total_spending": money(total),
            "average_daily_spending": money(
                total / len(days)
            )
        })

    observation_start = records[0].start_date
    observation_end = records[-1].end_date

    other_days = {
        d for d in date_range(
            observation_start,
            observation_end
        )
        if d not in period_days
    }

    period_total = sum(
        daily[d] for d in period_days
    )

    other_total = sum(
        daily[d] for d in other_days
    )

    period_average = period_total / len(period_days)

    other_average = (
        other_total / len(other_days)
        if other_days else None
    )

    period_categories = defaultdict(int)
    other_categories = defaultdict(int)

    for tx in expenses:
        if tx.date in period_days:
            period_categories[tx.category.name] += (
                tx.amount_paise
            )

        elif tx.date in other_days:
            other_categories[tx.category.name] += (
                tx.amount_paise
            )

    categories = []

    for name in (
        set(period_categories) | set(other_categories)
    ):
        period_value = (
            period_categories[name] / len(period_days)
        )

        other_value = (
            other_categories[name] / len(other_days)
            if other_days else None
        )

        categories.append({
            "category": name,
            "period_daily_average": money(period_value),
            "other_daily_average": (
                money(other_value)
                if other_value is not None else None
            ),
            "difference": (
                percentage_change(
                    period_value, other_value
                )
                if other_value is not None else None
            )
        })

    categories.sort(
        key=lambda item: item["period_daily_average"],
        reverse=True
    )

    comparison_available = (
        len(records) >= 2
        and len(other_days) >= 7
    )

    return {
        "enabled": True,
        "available": True,
        "comparison_available": comparison_available,
        "cycle_count": len(records),
        "period_days": len(period_days),
        "other_days": len(other_days),
        "period_daily_average": money(period_average),
        "other_daily_average": (
            money(other_average)
            if other_average is not None else None
        ),
        "spending_difference": (
            percentage_change(
                period_average, other_average
            )
            if comparison_available else None
        ),
        "cycles": cycle_summaries,
        "categories": (
            categories if comparison_available else []
        ),
        "note": (
            "Based on manually logged period dates and "
            "recorded transactions. Unlogged days are "
            "assumed to be non-period days within the "
            "observation window. Associations do not "
            "establish causation."
        )
    }