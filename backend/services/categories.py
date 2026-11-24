from database import db
from models import Category
from config import DEV_USER_ID


def get_category(name, tx_type):
    category = db.session.execute(
        db.select(Category).filter_by(
            user_id=DEV_USER_ID,
            name=name,
            type=tx_type
        )
    ).scalar_one_or_none()

    if category is None:
        category = Category(
            user_id=DEV_USER_ID,
            name=name,
            type=tx_type
        )
        db.session.add(category)
        db.session.flush()

    return category
