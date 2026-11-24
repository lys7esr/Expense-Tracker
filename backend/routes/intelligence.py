from datetime import date

from flask import Blueprint, jsonify

from config import DEV_USER_ID

from services.intelligence.financial_context import (
    get_financial_context
)

from services.intelligence.analytics import (
    build_analytics
)

from services.intelligence.cycle_analysis import (
    analyze_cycles
)


intelligence_bp = Blueprint(
    "intelligence", __name__
)


@intelligence_bp.get("/intelligence/analytics")
@intelligence_bp.get("/intelligence/analytics/<month>")
def financial_analytics(month=None):
    month = month or date.today().strftime("%Y-%m")

    try:
        context = get_financial_context(DEV_USER_ID)

        result = build_analytics(
            context, month
        )

        return jsonify(result)

    except ValueError as error:
        return jsonify({
            "error": str(error)
        }), 400


@intelligence_bp.get("/intelligence/cycles")
def cycle_insights():
    context = get_financial_context(DEV_USER_ID)

    return jsonify(
        analyze_cycles(DEV_USER_ID, context)
    )