from flask import Flask, jsonify
from flask_cors import CORS

from config import Config, DEV_USER_ID
from database import db
from models import User

from routes.transactions import transactions_bp
from routes.dashboard import dashboard_bp
from routes.budgets import budgets_bp
from routes.goals import goals_bp


def create_app(config=None):
    app = Flask(__name__)

    app.config.from_object(Config)

    if config:
        app.config.update(config)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": app.config["CORS_ORIGINS"]
            }
        }
    )

    db.init_app(app)

    # Register feature modules

    app.register_blueprint(
        transactions_bp,
        url_prefix="/api"
    )

    app.register_blueprint(
        dashboard_bp,
        url_prefix="/api"
    )

    app.register_blueprint(
        budgets_bp,
        url_prefix="/api"
    )

    app.register_blueprint(
        goals_bp,
        url_prefix="/api"
    )

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({
            "status": "ok",
            "app": "SpendWise"
        })

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "error": "Resource not found"
        }), 404

    return app


def initialize_database(app):
    with app.app_context():
        db.create_all()

        if db.session.get(User, DEV_USER_ID) is None:
            db.session.add(
                User(
                    id=DEV_USER_ID,
                    username="local_dev",
                    password_hash="DEV_ONLY_NO_LOGIN"
                )
            )

            db.session.commit()


app = create_app()


if __name__ == "__main__":
    initialize_database(app)
    app.run(debug=True)
