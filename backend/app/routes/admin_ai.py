"""
AI Admin Solver — structured admin copilot (teams, pricing, planning, prompts).
All routes require authenticated admin (is_admin_email).
"""

from __future__ import annotations

import logging

from flask import Blueprint, jsonify, request

from app.db.mongodb import get_db
from app.routes.auth_backend import get_user_info_from_request, require_auth
from app.services.roles import is_admin_email
from app.services.admin_ai.admin_ai_service import confirm_and_execute, run_admin_solver_turn

bp = Blueprint("admin_ai", __name__)
log = logging.getLogger(__name__)

_indexes_done = False


def _ensure_indexes(db):
    global _indexes_done
    if _indexes_done:
        return
    try:
        db.admin_ai_audit.create_index([("createdAt", -1)])
        db.admin_ai_pending.create_index([("expiresAt", 1)], expireAfterSeconds=0)
        db.admin_ai_pending.create_index([("adminUserId", 1)])
    except Exception as e:
        log.warning("admin_ai indexes: %s", e)
    _indexes_done = True


def _admin_guard():
    try:
        info = get_user_info_from_request()
    except ValueError as e:
        return None, (jsonify({"error": str(e)}), 401)
    email = (info.get("email") or "").strip().lower()
    if not is_admin_email(email):
        return None, (jsonify({"error": "Admin access required"}), 403)
    return info, None


@bp.route("/admin/ai/solver", methods=["POST"])
@require_auth
def admin_ai_solver(user_id):
    """Run one Admin AI turn; may return pendingActionId for destructive ops."""
    try:
        info, err = _admin_guard()
        if err:
            return err
        body = request.get_json(silent=True) or {}
        message = (body.get("message") or "").strip()
        if not message:
            return jsonify({"error": "message is required"}), 400

        db = get_db()
        _ensure_indexes(db)

        email = (info.get("email") or "").strip().lower()
        out = run_admin_solver_turn(
            db,
            admin_user_id=user_id,
            admin_email=email,
            message=message,
            current_page=(body.get("currentPage") or "").strip() or None,
            selected_team_id=(body.get("selectedTeamId") or "").strip() or None,
            selected_trip_id=(body.get("selectedTripId") or "").strip() or None,
            selected_date_range=body.get("selectedDateRange")
            if isinstance(body.get("selectedDateRange"), dict)
            else None,
            extra_ui=body.get("uiState") if isinstance(body.get("uiState"), dict) else None,
            model=(body.get("model") or "").strip() or None,
        )
        status = 200 if out.get("ok") else 500
        return jsonify(out), status
    except Exception as e:
        log.exception("admin_ai_solver")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/admin/ai/solver/confirm", methods=["POST"])
@require_auth
def admin_ai_solver_confirm(user_id):
    """Execute a previously proposed action after explicit confirmation."""
    try:
        info, err = _admin_guard()
        if err:
            return err
        body = request.get_json(silent=True) or {}
        pid = (body.get("pendingActionId") or "").strip()
        if not pid:
            return jsonify({"error": "pendingActionId is required"}), 400
        if not body.get("confirm"):
            return jsonify({"error": "confirm must be true"}), 400

        db = get_db()
        _ensure_indexes(db)
        email = (info.get("email") or "").strip().lower()
        out = confirm_and_execute(
            db,
            admin_user_id=user_id,
            admin_email=email,
            pending_action_id=pid,
        )
        if not out.get("ok"):
            return jsonify(out), 400
        return jsonify(out), 200
    except Exception as e:
        log.exception("admin_ai_solver_confirm")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/admin/ai/health", methods=["GET"])
@require_auth
def admin_ai_health(_user_id):
    """Lightweight check that the module is registered (admin-only)."""
    _, err = _admin_guard()
    if err:
        return err
    return jsonify({"ok": True, "module": "admin_ai"}), 200
