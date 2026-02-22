"""Pose attendance sessions: professor saves 3 poses, students join by password (MongoDB)."""
import secrets
import string
from datetime import datetime
from flask import Blueprint, request, jsonify
from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth, get_user_info_from_request

bp = Blueprint('pose_sessions', __name__)
COLLECTION = 'pose_sessions'

PROFESSOR_EMAIL = 'contatothomastesa@gmail.com'
REQUIRED_POSES = 3
PASSWORD_LENGTH = 8
PASSWORD_ALPHABET = string.ascii_lowercase + string.digits  # no uppercase to avoid confusion


def _generate_password() -> str:
    return ''.join(secrets.choice(PASSWORD_ALPHABET) for _ in range(PASSWORD_LENGTH))


def _validate_poses(poses: list) -> bool:
    if not poses or not isinstance(poses, list) or len(poses) < REQUIRED_POSES:
        return False
    for i in range(REQUIRED_POSES):
        p = poses[i] if i < len(poses) else None
        if not p or not isinstance(p, dict):
            return False
        pose_arr = p.get('pose')
        if not isinstance(pose_arr, list) or len(pose_arr) < 33 * 3:
            return False
    return True


@bp.route('/pose-sessions', methods=['POST'])
@require_auth
def create_pose_session(user_id):
    """
    Create a pose session (professor only: contatothomastesa@gmail.com).
    Body: { "poses": [ { "pose": [...], "image": "data:..." or null }, ... ] } (3 poses).
    Returns: { "password": "xxxxxxxx" }.
    """
    try:
        user = get_user_info_from_request()
        email = (user.get('email') or '').strip().lower()
        if email != PROFESSOR_EMAIL:
            return jsonify({'error': 'Only the professor can create pose sessions.'}), 403

        data = request.get_json() or {}
        poses = data.get('poses')
        if not _validate_poses(poses):
            return jsonify({'error': f'Send exactly {REQUIRED_POSES} poses, each with a "pose" array of keypoints.'}), 400

        # Build documents to store (pose arrays + optional image data URL)
        stored = []
        for i in range(REQUIRED_POSES):
            p = poses[i]
            stored.append({
                'pose': p['pose'],
                'image': p.get('image') if isinstance(p.get('image'), str) else None,
            })

        password = _generate_password()
        db = get_db()
        col = db[COLLECTION]
        now = datetime.utcnow()
        doc = {
            'professor_email': email,
            'password': password,
            'poses': stored,
            'created_at': now,
        }
        col.insert_one(doc)
        return jsonify({'password': password}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/pose-sessions/<password>', methods=['GET'])
def get_pose_session(password):
    """
    Get a pose session by password (for students). No auth required.
    Returns: { "poses": [ { "pose": [...], "image": "..." or null }, ... ] }.
    """
    try:
        password = (password or '').strip()
        if not password:
            return jsonify({'error': 'Password required.'}), 400

        db = get_db()
        col = db[COLLECTION]
        doc = col.find_one({'password': password})
        if not doc:
            return jsonify({'error': 'Invalid or expired password.'}), 404

        poses = doc.get('poses') or []
        if len(poses) < REQUIRED_POSES:
            return jsonify({'error': 'Session data incomplete.'}), 404

        out = [{'pose': p['pose'], 'image': p.get('image')} for p in poses[:REQUIRED_POSES]]
        return jsonify({'poses': out}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
