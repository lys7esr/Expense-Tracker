
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
