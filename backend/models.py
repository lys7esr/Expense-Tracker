
from datetime import datetime, timezone
from database import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(10), nullable=False)


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False
    )
    category_id = db.Column(
        db.Integer, db.ForeignKey("categories.id"), nullable=False
    )
    type = db.Column(db.String(10), nullable=False)
    amount_paise = db.Column(db.Integer, nullable=False)
    subcategory = db.Column(db.String(100))
    description = db.Column(db.String(255))
    date = db.Column(db.Date, nullable=False)
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    category = db.relationship("Category")


class Budget(db.Model):
    __tablename__ = "budgets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False
    )
    month = db.Column(db.String(7), nullable=False)
    amount_paise = db.Column(db.Integer, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "month"),
    )
class CategoryBudget(db.Model):
    __tablename__ = "category_budgets"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.id"),
        nullable=False
    )

    month = db.Column(
        db.String(7),
        nullable=False
    )

    amount_paise = db.Column(
        db.Integer,
        nullable=False
    )

    category = db.relationship("Category")

    __table_args__ = (
        db.UniqueConstraint(
            "user_id",
            "category_id",
            "month"
        ),
    )

class SavingsGoal(db.Model):
    __tablename__ = "savings_goals"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    name = db.Column(db.String(100), nullable=False)

    target_paise = db.Column(
        db.Integer,
        nullable=False
    )

    deadline = db.Column(db.Date, nullable=True)

    description = db.Column(db.String(255))

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    contributions = db.relationship(
        "SavingsContribution",
        backref="goal",
        cascade="all, delete-orphan"
    )


class SavingsContribution(db.Model):
    __tablename__ = "savings_contributions"

    id = db.Column(db.Integer, primary_key=True)

    goal_id = db.Column(
        db.Integer,
        db.ForeignKey("savings_goals.id"),
        nullable=False
    )

    amount_paise = db.Column(
        db.Integer,
        nullable=False
    )

    type = db.Column(
        db.String(10),
        nullable=False
    )

    date = db.Column(
        db.Date,
        nullable=False
    )

    note = db.Column(db.String(255))

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

class MoneyRecord(db.Model):
    __tablename__ = "money_records"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    person = db.Column(db.String(100), nullable=False)

    type = db.Column(db.String(10), nullable=False)

    amount_paise = db.Column(db.Integer, nullable=False)

    purpose = db.Column(db.String(255))

    date = db.Column(db.Date, nullable=False)

    due_date = db.Column(db.Date, nullable=True)

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    repayments = db.relationship(
        "MoneyRepayment",
        backref="record",
        cascade="all, delete-orphan"
    )


class MoneyRepayment(db.Model):
    __tablename__ = "money_repayments"

    id = db.Column(db.Integer, primary_key=True)

    record_id = db.Column(
        db.Integer,
        db.ForeignKey("money_records.id"),
        nullable=False
    )

    amount_paise = db.Column(db.Integer, nullable=False)

    date = db.Column(db.Date, nullable=False)

    note = db.Column(db.String(255))

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

class RecurringSchedule(db.Model):
    __tablename__ = "recurring_schedules"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.id"),
        nullable=False
    )

    name = db.Column(db.String(100), nullable=False)

    type = db.Column(db.String(10), nullable=False)

    amount_paise = db.Column(
        db.Integer,
        nullable=False
    )

    frequency = db.Column(
        db.String(10),
        nullable=False
    )

    next_due_date = db.Column(
        db.Date,
        nullable=False
    )

    anchor_day = db.Column(
        db.Integer,
        nullable=False
    )

    anchor_month = db.Column(
        db.Integer,
        nullable=False
    )

    active = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )

    description = db.Column(db.String(255))

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    category = db.relationship("Category")

    occurrences = db.relationship(
        "RecurringOccurrence",
        backref="schedule",
        cascade="all, delete-orphan"
    )


class RecurringOccurrence(db.Model):
    __tablename__ = "recurring_occurrences"

    id = db.Column(db.Integer, primary_key=True)

    schedule_id = db.Column(
        db.Integer,
        db.ForeignKey("recurring_schedules.id"),
        nullable=False
    )

    due_date = db.Column(
        db.Date,
        nullable=False
    )

    status = db.Column(
        db.String(10),
        nullable=False
    )

    amount_paise = db.Column(
        db.Integer,
        nullable=False
    )

    transaction_id = db.Column(
        db.Integer,
        nullable=True
    )

    processed_date = db.Column(
        db.Date,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "schedule_id",
            "due_date",
            name="unique_recurring_occurrence"
        ),
    )
class CyclePreference(db.Model):
    __tablename__ = "cycle_preferences"

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        primary_key=True
    )

    enabled = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )


class CycleRecord(db.Model):
    __tablename__ = "cycle_records"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        db.CheckConstraint(
            "end_date >= start_date",
            name="valid_cycle_dates"
        ),
    )