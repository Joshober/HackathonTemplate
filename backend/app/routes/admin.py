"""Admin-only API: roles and professor email list (MongoDB)."""
from flask import Blueprint, request, jsonify

from app.routes.auth_backend import require_auth, get_user_info_from_request
from app.services.roles import (
    is_admin_email,
    is_professor_email,
    get_admin_emails,
    get_env_professor_emails,
    get_effective_professor_emails,
    get_managed_professor_emails_list,
    set_managed_professor_emails,
    mask_smtp_user_hint,
)
from app.services.mail import is_configured

bp = Blueprint('admin', __name__)


def _require_admin():
    info = get_user_info_from_request()
    email = (info.get('email') or '').strip().lower()
    if not is_admin_email(email):
        return None, (jsonify({'error': 'Admin access required'}), 403)
    return info, None


@bp.route('/admin/me', methods=['GET'])
@require_auth
def admin_me(user_id):
    """Any authenticated user: whether they are admin / professor (for UI)."""
    try:
        info = get_user_info_from_request()
        email = (info.get('email') or '').strip().lower()
        return jsonify(
            {
                'email': info.get('email') or '',
                'isAdmin': is_admin_email(email),
                'isProfessor': is_professor_email(email),
            }
        ), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 401


@bp.route('/admin/settings', methods=['GET'])
@require_auth
def admin_settings_get(user_id):
    try:
        _, err = _require_admin()
        if err:
            return err
        effective = sorted(get_effective_professor_emails())
        managed = get_managed_professor_emails_list()
        builtin = sorted(get_env_professor_emails())
        return jsonify(
            {
                'admin_emails': sorted(get_admin_emails()),
                'builtin_professor_emails': builtin,
                'additional_professor_emails': managed,
                'effective_professor_emails': effective,
                'smtp_configured': is_configured(),
                'smtp_user_hint': mask_smtp_user_hint(),
            }
        ), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/admin/settings', methods=['PUT'])
@require_auth
def admin_settings_put(user_id):
    try:
        _, err = _require_admin()
        if err:
            return err
        data = request.get_json() or {}
        raw = data.get('additional_professor_emails')
        if raw is None:
            return jsonify({'error': 'Body must include additional_professor_emails (array of strings).'}), 400
        if not isinstance(raw, list):
            return jsonify({'error': 'additional_professor_emails must be an array.'}), 400
        saved = set_managed_professor_emails(raw)
        return jsonify(
            {
                'additional_professor_emails': saved,
                'effective_professor_emails': sorted(get_effective_professor_emails()),
            }
        ), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
