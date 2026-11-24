from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
from statistics import median


def money(paise):
    return round(paise / 100, 2)


def percentage_change(current, previous):
    if previous == 0:
        return None

    return round(
        (current - previous) / previous * 100,
        2
    )


def previous_month(year, month):
    if month == 1:
        return year - 1, 12

    return year, month - 1


def date_range(start, end):
    while start <= end:
        yield start
        start += timedelta(days=1)


def parse_month(month):
    if len(month) != 7:
        raise ValueError("Month must be YYYY-MM")

    try:
        return date.fromisoformat(f"{month}-01")
    except ValueError:
        raise ValueError("Month must be YYYY-MM")


def select_transactions(transactions, start, end):
    return [
        tx for tx in transactions
        if start <= tx.date <= end
    ]


def summarize_transactions(transactions):
    income = 0
    expenses = 0
    categories = defaultdict(int)

    for tx in transactions:
        if tx.type == "income":
            income += tx.amount_paise

        elif tx.type == "expense":
            expenses += tx.amount_paise
            categories[tx.category.name] += tx.amount_paise

    return {
        "income": income,
        "expenses": expenses,
        "net_cash_flow": income - expenses,
        "categories": dict(categories)
    }


def analyze_month(context, month):
    start = parse_month(month)
    today = context["as_of"]

    if start > today:
        raise ValueError("Cannot analyze a future month")

    month_end = date(
        start.year,
        start.month,
        monthrange(start.year, start.month)[1]
    )

    end = min(month_end, today)

    transactions = context["transactions"]

    current = select_transactions(
        transactions, start, end
    )

    summary = summarize_transactions(current)

    py, pm = previous_month(
        start.year, start.month
    )

    previous_start = date(py, pm, 1)

    comparison_days = min(
        end.day,
        monthrange(py, pm)[1]
    )

    previous_end = date(
        py, pm, comparison_days
    )

    comparison_end = date(
        start.year, start.month, comparison_days
    )

    comparison_current = summarize_transactions(
        select_transactions(
            transactions, start, comparison_end
        )
    )

    previous_transactions = select_transactions(
        transactions, previous_start, previous_end
    )

    previous = summarize_transactions(
        previous_transactions
    )

    first_recorded = (
        transactions[0].date
        if transactions else None
    )

    comparison_available = (
        first_recorded is not None
        and first_recorded <= previous_start
    )

    expenses = [
        tx for tx in current
        if tx.type == "expense"
    ]

    category_names = (
        set(summary["categories"])
        | set(previous["categories"])
    )

    categories = []

    for name in category_names:
        amount = summary["categories"].get(name, 0)

        comparable_amount = comparison_current[
            "categories"
        ].get(name, 0)

        old_amount = previous[
            "categories"
        ].get(name, 0)

        categories.append({
            "category": name,
            "amount": money(amount),
            "share": round(
                amount / summary["expenses"] * 100,
                2
            ) if summary["expenses"] else None,
            "previous_amount": (
                money(old_amount)
                if comparison_available else None
            ),
            "change": (
                percentage_change(
                    comparable_amount, old_amount
                )
                if comparison_available else None
            ),
            "difference": (
                money(comparable_amount - old_amount)
                if comparison_available else None
            )
        })

    categories.sort(
        key=lambda item: item["amount"],
        reverse=True
    )

    return {
        "month": month,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "days_elapsed": (end - start).days + 1,
        "income": money(summary["income"]),
        "expenses": money(summary["expenses"]),
        "net_cash_flow": money(
            summary["net_cash_flow"]
        ),
        "transaction_count": len(current),
        "expense_count": len(expenses),
        "comparison": {
            "available": comparison_available,
            "current_start": start.isoformat(),
            "current_end": comparison_end.isoformat(),
            "previous_start": previous_start.isoformat(),
            "previous_end": previous_end.isoformat(),
            "expense_change": (
                percentage_change(
                    comparison_current["expenses"],
                    previous["expenses"]
                )
                if comparison_available else None
            ),
            "income_change": (
                percentage_change(
                    comparison_current["income"],
                    previous["income"]
                )
                if comparison_available else None
            ),
            "expense_difference": (
                money(
                    comparison_current["expenses"]
                    - previous["expenses"]
                )
                if comparison_available else None
            )
        },
        "categories": categories
    }


def analyze_spending_patterns(
    context, month, small_limit_paise=10000
):
    start = parse_month(month)

    end = min(
        context["as_of"],
        date(
            start.year,
            start.month,
            monthrange(start.year, start.month)[1]
        )
    )

    transactions = context["transactions"]

    expenses = [
        tx for tx in transactions
        if tx.type == "expense"
        and start <= tx.date <= end
    ]

    daily_totals = defaultdict(int)

    for tx in expenses:
        daily_totals[tx.date] += tx.amount_paise

    first_recorded = (
        transactions[0].date
        if transactions else None
    )

    observed_start = (
        max(start, first_recorded)
        if first_recorded else None
    )

    days = (
        list(date_range(observed_start, end))
        if observed_start and observed_start <= end
        else []
    )

    weekdays = [
        daily_totals[d]
        for d in days if d.weekday() < 5
    ]

    weekends = [
        daily_totals[d]
        for d in days if d.weekday() >= 5
    ]

    small_purchases = [
        tx for tx in expenses
        if tx.amount_paise < small_limit_paise
    ]

    small_total = sum(
        tx.amount_paise for tx in small_purchases
    )

    total = sum(
        tx.amount_paise for tx in expenses
    )

    weekday_average = (
        sum(weekdays) / len(weekdays)
        if weekdays else None
    )

    weekend_average = (
        sum(weekends) / len(weekends)
        if weekends else None
    )

    return {
        "available": bool(days),
        "observed_days": len(days),
        "average_daily_spending": (
            money(total / len(days))
            if days else None
        ),
        "median_transaction": (
            money(median([
                tx.amount_paise for tx in expenses
            ]))
            if expenses else None
        ),
        "weekday_average": (
            money(weekday_average)
            if weekday_average is not None else None
        ),
        "weekend_average": (
            money(weekend_average)
            if weekend_average is not None else None
        ),
        "weekend_difference": (
            percentage_change(
                weekend_average,
                weekday_average
            )
            if weekend_average is not None
            and weekday_average is not None
            else None
        ),
        "small_purchases": {
            "threshold": money(small_limit_paise),
            "count": len(small_purchases),
            "total": money(small_total),
            "share": (
                round(small_total / total * 100, 2)
                if total else None
            )
        },
        "daily_spending": [
            {
                "date": d.isoformat(),
                "amount": money(daily_totals[d])
            }
            for d in days
        ],
        "coverage_note": (
            "Days without recorded expenses are treated "
            "as zero recorded spending."
        )
    }


def analyze_budgets(context, month, monthly):
    overall = next(
        (
            budget.amount_paise
            for budget in context["budgets"]
            if budget.month == month
        ),
        None
    )

    spent = round(monthly["expenses"] * 100)

    def details(limit, amount):
        return {
            "budget": (
                money(limit)
                if limit is not None else None
            ),
            "spent": money(amount),
            "remaining": (
                money(limit - amount)
                if limit is not None else None
            ),
            "utilization": (
                round(amount / limit * 100, 2)
                if limit else None
            )
        }

    category_spending = {
        item["category"]: round(item["amount"] * 100)
        for item in monthly["categories"]
    }

    categories = []

    for budget in context["category_budgets"]:
        if budget.month != month:
            continue

        name = budget.category.name

        categories.append({
            "category": name,
            **details(
                budget.amount_paise,
                category_spending.get(name, 0)
            )
        })

    return {
        "overall": details(overall, spent),
        "categories": categories
    }


def analyze_savings(context, month):
    goals = context["goals"]
    today = context["as_of"]

    total_target = 0
    total_saved = 0
    monthly_deposits = 0
    monthly_withdrawals = 0
    completed = 0

    for goal in goals:
        balance = 0

        for contribution in goal.contributions:
            if contribution.date > today:
                continue

            is_deposit = contribution.type == "deposit"

            balance += (
                contribution.amount_paise
                if is_deposit
                else -contribution.amount_paise
            )

            if contribution.date.strftime("%Y-%m") == month:
                if is_deposit:
                    monthly_deposits += (
                        contribution.amount_paise
                    )
                else:
                    monthly_withdrawals += (
                        contribution.amount_paise
                    )

        total_target += goal.target_paise
        total_saved += balance

        if balance >= goal.target_paise:
            completed += 1

    return {
        "goal_count": len(goals),
        "completed_goals": completed,
        "total_target": money(total_target),
        "total_saved": money(total_saved),
        "monthly_deposits": money(monthly_deposits),
        "monthly_withdrawals": money(monthly_withdrawals),
        "monthly_net_contributions": money(
            monthly_deposits - monthly_withdrawals
        )
    }


def analyze_money_records(context):
    receivable = 0
    payable = 0
    overdue_payable = 0
    overdue_receivable = 0

    today = context["as_of"]

    for record in context["money_records"]:
        repaid = sum(
            repayment.amount_paise
            for repayment in record.repayments
            if repayment.date <= today
        )

        outstanding = max(
            0, record.amount_paise - repaid
        )

        overdue = (
            record.due_date is not None
            and record.due_date < today
        )

        if record.type == "lent":
            receivable += outstanding

            if overdue:
                overdue_receivable += outstanding

        elif record.type == "borrowed":
            payable += outstanding

            if overdue:
                overdue_payable += outstanding

    return {
        "receivable": money(receivable),
        "payable": money(payable),
        "overdue_receivable": money(overdue_receivable),
        "overdue_payable": money(overdue_payable)
    }


def analyze_recurring(context):
    today = context["as_of"]
    horizon = today + timedelta(days=30)

    upcoming_expenses = 0
    upcoming_income = 0
    overdue_expenses = 0

    for schedule in context["recurring"]:
        if schedule.next_due_date < today:
            if schedule.type == "expense":
                overdue_expenses += schedule.amount_paise

        elif schedule.next_due_date <= horizon:
            if schedule.type == "expense":
                upcoming_expenses += schedule.amount_paise
            else:
                upcoming_income += schedule.amount_paise

    return {
        "active_schedules": len(context["recurring"]),
        "next_due_expenses_within_30_days": money(
            upcoming_expenses
        ),
        "next_due_income_within_30_days": money(
            upcoming_income
        ),
        "overdue_next_due_expenses": money(
            overdue_expenses
        ),
        "note": (
            "Includes only the next pending occurrence "
            "of each active schedule."
        )
    }


def analyze_data_readiness(context):
    transactions = context["transactions"]

    expenses = [
        tx for tx in transactions
        if tx.type == "expense"
    ]

    history_days = (
        (context["as_of"] - expenses[0].date).days + 1
        if expenses else 0
    )

    category_counts = defaultdict(int)

    for tx in expenses:
        category_counts[tx.category.name] += 1

    return {
        "transaction_count": len(transactions),
        "expense_count": len(expenses),
        "history_days": history_days,
        "category_counts": dict(category_counts),
        "statistical_baseline_candidate": any(
            count >= 10
            for count in category_counts.values()
        ),
        "isolation_forest_candidate": (
            len(expenses) >= 100
            and history_days >= 60
        ),
        "forecast_candidate": (
            history_days >= 30
            and len(expenses) >= 20
        ),
        "note": (
            "Eligibility thresholds are preliminary. "
            "Model reliability requires further validation."
        )
    }


def build_analytics(context, month):
    monthly = analyze_month(context, month)

    return {
        "monthly": monthly,
        "patterns": analyze_spending_patterns(
            context, month
        ),
        "budgets": analyze_budgets(
            context, month, monthly
        ),
        "savings": analyze_savings(context, month),
        "money": analyze_money_records(context),
        "recurring": analyze_recurring(context),
        "data_readiness": analyze_data_readiness(context),
        "as_of": context["as_of"].isoformat()
    }