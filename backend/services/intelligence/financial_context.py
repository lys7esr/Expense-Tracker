from datetime import date

from sqlalchemy.orm import joinedload, selectinload

from database import db
from models import (
    Transaction,
    Budget,
    CategoryBudget,
    SavingsGoal,
    MoneyRecord,
    RecurringSchedule
)


def get_financial_context(user_id, as_of=None):
    as_of = as_of or date.today()

    transactions = db.session.execute(
        db.select(Transaction)
        .options(joinedload(Transaction.category))
        .where(
            Transaction.user_id == user_id,
            Transaction.date <= as_of
        )
        .order_by(Transaction.date, Transaction.id)
    ).scalars().all()

    budgets = db.session.execute(
        db.select(Budget)
        .filter_by(user_id=user_id)
    ).scalars().all()

    category_budgets = db.session.execute(
        db.select(CategoryBudget)
        .options(joinedload(CategoryBudget.category))
        .filter_by(user_id=user_id)
    ).scalars().all()

    goals = db.session.execute(
        db.select(SavingsGoal)
        .options(selectinload(SavingsGoal.contributions))
        .filter_by(user_id=user_id)
    ).scalars().all()

    money_records = db.session.execute(
        db.select(MoneyRecord)
        .options(selectinload(MoneyRecord.repayments))
        .where(
            MoneyRecord.user_id == user_id,
            MoneyRecord.date <= as_of
        )
    ).scalars().all()

    recurring = db.session.execute(
        db.select(RecurringSchedule)
        .options(joinedload(RecurringSchedule.category))
        .filter_by(user_id=user_id, active=True)
    ).scalars().all()

    return {
        "as_of": as_of,
        "transactions": transactions,
        "budgets": budgets,
        "category_budgets": category_budgets,
        "goals": goals,
        "money_records": money_records,
        "recurring": recurring
    }