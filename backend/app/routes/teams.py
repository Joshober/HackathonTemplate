"""
Teams and team chat (MongoDB). All routes require auth; caller is upserted into `users` on each request.
"""
import base64
import io
import os
import re
from datetime import datetime
from functools import wraps

import requests
from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, jsonify, request
from PIL import Image

from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth, get_user_info_from_request as get_user_info_from_token
from app.services.team_chat import run_team_travel_assistant
from app.services.team_items_access import format_item_document

bp = Blueprint('teams', __name__)

_indexes_ensured = False
MAX_TEAM_CITY_PRESETS = 20


def _ensure_indexes(db):
    global _indexes_ensured
    if _indexes_ensured:
        return
    try:
        db.users.create_index([('userId', 1)], unique=True)
        db.users.create_index([('email', 1)])
        db.teams.create_index([('memberIds', 1)])
        db.team_messages.create_index([('teamId', 1), ('createdAt', 1)])
        db.items.create_index([('teamId', 1), ('updatedAt', -1)], sparse=True)
    except Exception as e:
        print(f'Warning: team indexes: {e}', flush=True)
    _indexes_ensured = True


def _normalize_email(email: str) -> str:
    return (email or '').strip().lower()


def _normalize_city_list(raw) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for x in raw:
        if not isinstance(x, str):
            continue
        s = " ".join(x.split()).strip()
        if not s:
            continue
        if s.lower() in {c.lower() for c in out}:
            continue
        out.append(s[:80])
        if len(out) >= MAX_TEAM_CITY_PRESETS:
            break
    return out


def upsert_user_from_token(db, user_id: str) -> None:
    """Sync Auth0 user into `users` from JWT/session (for member lookup by email)."""
    info = get_user_info_from_token()
    now = datetime.utcnow()
    email = _normalize_email(info.get('email') or '')
    name = (info.get('name') or info.get('nickname') or '').strip() or None
    picture = (info.get('picture') or '').strip() or None
    db.users.update_one(
        {'userId': user_id},
        {
            '$set': {
                'email': email,
                'name': name,
                'picture': picture,
                'updatedAt': now,
            },
            '$setOnInsert': {'userId': user_id, 'createdAt': now},
        },
        upsert=True,
    )


def _parse_oid(team_id: str) -> ObjectId | None:
    try:
        return ObjectId(team_id)
    except InvalidId:
        return None


def _team_for_member(db, team_oid: ObjectId, user_id: str) -> dict | None:
    doc = db.teams.find_one({'_id': team_oid, 'memberIds': user_id})
    return doc


def _display_name_for_user(db, uid: str) -> str:
    prof = db.profiles.find_one({'userId': uid})
    if prof and (prof.get('displayName') or '').strip():
        return prof['displayName'].strip()
    u = db.users.find_one({'userId': uid})
    if u and (u.get('name') or '').strip():
        return u['name'].strip()
    em = (u or {}).get('email') or ''
    if em and '@' in em:
        return em.split('@')[0]
    return 'Teammate'


def _serialize_user_message(doc) -> dict:
    out = {
        'id': str(doc['_id']),
        'role': doc.get('role', 'user'),
        'userId': doc.get('userId'),
        'content': doc.get('content', ''),
        'authorDisplayName': doc.get('authorDisplayName'),
        'createdAt': doc['createdAt'].isoformat() if doc.get('createdAt') else None,
    }
    return out


def _serialize_message(doc) -> dict:
    out = {
        'id': str(doc['_id']),
        'role': doc.get('role', 'user'),
        'userId': doc.get('userId'),
        'content': doc.get('content', ''),
        'authorDisplayName': doc.get('authorDisplayName'),
        'createdAt': doc['createdAt'].isoformat() if doc.get('createdAt') else None,
    }
    return out


def _resolve_members(db, member_ids: list) -> list[dict]:
    members = []
    for uid in member_ids:
        u = db.users.find_one({'userId': uid}) or {}
        p = db.profiles.find_one({'userId': uid}) or {}
        members.append({
            'userId': uid,
            'displayName': (p.get('displayName') or u.get('name') or '').strip() or None,
            'email': (u.get('email') or '').strip() or None,
            'profileImageUrl': p.get('profileImageUrl') or u.get('picture') or None,
        })
    return members


def with_user_sync(f):
    """Upsert caller into `users` before handler."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        uid = kwargs.get('user_id')
        if not uid:
            return jsonify({'error': 'Authentication failed'}), 401
        db = get_db()
        _ensure_indexes(db)
        upsert_user_from_token(db, uid)
        return f(*args, **kwargs)
    return wrapped


@bp.route('/users/sync', methods=['POST'])
@require_auth
@with_user_sync
def sync_user(user_id):
    """Explicit sync from team page on load (same upsert as other team routes)."""
    return jsonify({'ok': True, 'userId': user_id}), 200


@bp.route('/teams', methods=['POST'])
@require_auth
@with_user_sync
def create_team(user_id):
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    description = (data.get('description') or '').strip() or None
    db = get_db()
    now = datetime.utcnow()
    doc = {
        'name': name,
        'description': description,
        'memberIds': [user_id],
        'createdBy': user_id,
        'createdAt': now,
        'updatedAt': now,
    }
    result = db.teams.insert_one(doc)
    doc['_id'] = result.inserted_id
    return jsonify({
        'id': str(doc['_id']),
        'name': doc['name'],
        'memberCount': 1,
        'createdBy': user_id,
    }), 201


@bp.route('/teams', methods=['GET'])
@require_auth
@with_user_sync
def list_teams(user_id):
    db = get_db()
    cursor = db.teams.find({'memberIds': user_id}).sort('updatedAt', -1)
    teams = []
    for t in cursor:
        teams.append({
            'id': str(t['_id']),
            'name': t.get('name', ''),
            'memberCount': len(t.get('memberIds') or []),
        })
    return jsonify({'teams': teams}), 200


@bp.route('/teams/<team_id>', methods=['GET'])
@require_auth
@with_user_sync
def get_team(user_id, team_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    team = _team_for_member(db, oid, user_id)
    if not team:
        return jsonify({'error': 'Forbidden or not found'}), 403
    members = _resolve_members(db, team.get('memberIds') or [])
    return jsonify({
        'id': str(team['_id']),
        'name': team.get('name', ''),
        'description': team.get('description'),
        'createdBy': team.get('createdBy'),
        'members': members,
        'cityPresets': _normalize_city_list(team.get('cityPresets') or []),
    }), 200


@bp.route('/teams/<team_id>/city-presets', methods=['PUT'])
@require_auth
@with_user_sync
def set_team_city_presets(user_id, team_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    team = _team_for_member(db, oid, user_id)
    if not team:
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(silent=True) or {}
    cities = _normalize_city_list(data.get('cities') or [])
    db.teams.update_one(
        {'_id': oid},
        {'$set': {'cityPresets': cities, 'updatedAt': datetime.utcnow()}},
    )
    return jsonify({'cities': cities}), 200


@bp.route('/teams/<team_id>/members', methods=['POST'])
@require_auth
@with_user_sync
def add_team_member(user_id, team_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    team = _team_for_member(db, oid, user_id)
    if not team:
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(silent=True) or {}
    email = _normalize_email(data.get('email') or '')
    if not email:
        return jsonify({'error': 'email is required'}), 400
    target = db.users.find_one({'email': email})
    if not target:
        return jsonify({'error': 'No user found with that email. They must sign in once so their account syncs.'}), 404
    new_id = target['userId']
    if new_id in (team.get('memberIds') or []):
        members = _resolve_members(db, team.get('memberIds') or [])
        return jsonify({'members': members, 'message': 'Already a member'}), 200
    db.teams.update_one(
        {'_id': oid},
        {'$addToSet': {'memberIds': new_id}, '$set': {'updatedAt': datetime.utcnow()}},
    )
    team = db.teams.find_one({'_id': oid})
    members = _resolve_members(db, team.get('memberIds') or [])
    return jsonify({'members': members}), 200


@bp.route('/teams/<team_id>/members/me', methods=['DELETE'])
@require_auth
@with_user_sync
def leave_team(user_id, team_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    team = db.teams.find_one({'_id': oid})
    if not team:
        return jsonify({'error': 'Not found'}), 404
    mids = team.get('memberIds') or []
    if user_id not in mids:
        return jsonify({'error': 'Forbidden'}), 403
    # Demo: allow sole member to leave (orphan team); no delete.
    db.teams.update_one(
        {'_id': oid},
        {'$pull': {'memberIds': user_id}, '$set': {'updatedAt': datetime.utcnow()}},
    )
    return jsonify({'ok': True}), 200


@bp.route('/teams/<team_id>/messages', methods=['GET'])
@require_auth
@with_user_sync
def list_messages(user_id, team_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    if not _team_for_member(db, oid, user_id):
        return jsonify({'error': 'Forbidden'}), 403
    limit = request.args.get('limit', default=100, type=int)
    limit = max(1, min(limit, 200))
    cursor = (
        db.team_messages.find({'teamId': oid})
        .sort('createdAt', -1)
        .limit(limit)
    )
    rows = list(cursor)
    rows.reverse()
    return jsonify({'messages': [_serialize_message(r) for r in rows]}), 200


@bp.route('/teams/<team_id>/messages', methods=['POST'])
@require_auth
@with_user_sync
def post_message(user_id, team_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    if not _team_for_member(db, oid, user_id):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(silent=True) or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'error': 'content is required'}), 400

    invoke_raw = data.get('invokeAssistant')
    invoke_assistant = True if invoke_raw is None else bool(invoke_raw)
    if re.match(r'^\s*@assistant\b', content, re.IGNORECASE) or re.match(r'^\s*@ai\b', content, re.IGNORECASE):
        invoke_assistant = True

    now = datetime.utcnow()
    author_display = _display_name_for_user(db, user_id)
    user_doc = {
        'teamId': oid,
        'role': 'user',
        'userId': user_id,
        'content': content,
        'authorDisplayName': author_display,
        'createdAt': now,
    }
    ins_user = db.team_messages.insert_one(user_doc)
    user_doc['_id'] = ins_user.inserted_id

    # Build model history: last N messages chronologically (including new user line).
    hist_cursor = (
        db.team_messages.find({'teamId': oid})
        .sort('createdAt', -1)
        .limit(60)
    )
    hist = list(hist_cursor)
    hist.reverse()
    conversation = []
    for m in hist:
        r = m.get('role')
        if r not in ('user', 'assistant'):
            continue
        text = (m.get('content') or '').strip()
        if r == 'user':
            author = (m.get('authorDisplayName') or 'Teammate').strip() or 'Teammate'
            text = f'[{author}]: {text}' if text else f'[{author}]:'
        conversation.append({'role': r, 'content': text})

    if not invoke_assistant:
        db.teams.update_one({'_id': oid}, {'$set': {'updatedAt': datetime.utcnow()}})
        return jsonify({
            'userMessage': _serialize_user_message(user_doc),
            'assistantMessage': None,
        }), 201

    assistant_content = ''
    assistant_err = None
    try:
        assistant_content, _usage = run_team_travel_assistant(conversation)
    except Exception as e:
        assistant_err = str(e)
        # Prefer storing assistant error row so UI stays consistent (spec).
        assistant_content = (
            'Sorry — the travel assistant could not complete a reply right now. '
            f'({assistant_err[:200]})' if assistant_err else 'Sorry — the travel assistant could not complete a reply.'
        )

    asst_doc = {
        'teamId': oid,
        'role': 'assistant',
        'userId': None,
        'content': assistant_content,
        'authorDisplayName': 'Travel assistant',
        'createdAt': datetime.utcnow(),
    }
    ins_asst = db.team_messages.insert_one(asst_doc)
    asst_doc['_id'] = ins_asst.inserted_id

    db.teams.update_one({'_id': oid}, {'$set': {'updatedAt': datetime.utcnow()}})

    return jsonify({
        'userMessage': _serialize_user_message(user_doc),
        'assistantMessage': _serialize_message(asst_doc),
    }), 201


RETURN_FEED_STATUSES = ('approved', 'booked', 'completed')

INSTAGRAM_CAPTION_SYSTEM = (
    'You write Instagram captions for a professional travel / conference team. '
    'Output only the caption text (no preamble). Use 2–4 short lines or one tight paragraph. '
    'Warm, confident tone; avoid cringe or excessive emojis (at most one emoji if it fits naturally). '
    'End with a separate line of 3–6 relevant hashtags (each starting with #). '
    'Do not invent specific facts not visible in the image or given title/location.'
)


def _primary_image_url(item: dict) -> str | None:
    urls = item.get('imageUrls') or []
    if isinstance(urls, list) and urls and isinstance(urls[0], str):
        return urls[0].strip() or None
    t = item.get('travel') or {}
    if isinstance(t, dict):
        u = t.get('imageUrl')
        if isinstance(u, str) and u.strip():
            return u.strip()
    return None


def _image_url_to_jpeg_b64(url: str, max_side: int = 1536) -> tuple[str | None, str | None]:
    try:
        r = requests.get(
            url,
            timeout=20,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; TravelReturn/1.0)'},
        )
        if not r.ok:
            return None, f'Image fetch failed: HTTP {r.status_code}'
        img = Image.open(io.BytesIO(r.content))
        if img.mode in ('RGBA', 'P'):
            rgb = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            rgb.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = rgb
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        w, h = img.size
        if max(w, h) > max_side:
            scale = max_side / float(max(w, h))
            img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=88)
        return base64.b64encode(buf.getvalue()).decode('ascii'), None
    except Exception as e:
        return None, str(e)


@bp.route('/teams/<team_id>/return-feed', methods=['GET'])
@require_auth
@with_user_sync
def return_feed(user_id, team_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    if not _team_for_member(db, oid, user_id):
        return jsonify({'error': 'Forbidden'}), 403

    q = {
        'teamId': oid,
        '$or': [
            {'travel.opportunityStatus': {'$in': list(RETURN_FEED_STATUSES)}},
            {'travel.tripType': 'post_trip'},
        ],
    }
    cursor = db.items.find(q).sort('updatedAt', -1).limit(200)
    items = [format_item_document(doc) for doc in cursor]
    return jsonify({'items': items}), 200


@bp.route('/teams/<team_id>/items/<item_id>/instagram-caption', methods=['POST'])
@require_auth
@with_user_sync
def instagram_caption(user_id, team_id, item_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    try:
        item_oid = ObjectId(item_id)
    except InvalidId:
        return jsonify({'error': 'Invalid item id'}), 400

    db = get_db()
    if not _team_for_member(db, oid, user_id):
        return jsonify({'error': 'Forbidden'}), 403

    item = db.items.find_one({'_id': item_oid})
    if not item or item.get('teamId') != oid:
        return jsonify({'error': 'Item not found'}), 404

    img_url = _primary_image_url(item)
    if not img_url:
        return jsonify({'error': 'Add at least one photo before generating a caption.'}), 400

    b64, err = _image_url_to_jpeg_b64(img_url)
    if not b64:
        return jsonify({'error': err or 'Could not read image'}), 400

    title = (item.get('title') or 'Trip moment').strip()
    loc = ''
    t = item.get('travel') or {}
    if isinstance(t, dict) and isinstance(t.get('location'), str):
        loc = t['location'].strip()

    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        return jsonify({'error': 'OPENROUTER_API_KEY is not configured'}), 500

    model = os.getenv('OPENROUTER_CHAT_VISION_MODEL') or 'openai/gpt-4o-mini'
    user_text = f'Event title: {title}\nLocation: {loc or "unknown"}\nWrite the Instagram caption for this photo.'
    content = [
        {'type': 'text', 'text': user_text},
        {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{b64}'}},
    ]
    messages = [
        {'role': 'system', 'content': INSTAGRAM_CAPTION_SYSTEM},
        {'role': 'user', 'content': content},
    ]
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
        'HTTP-Referer': request.headers.get('Origin', ''),
        'X-Title': 'Return Instagram caption',
    }
    try:
        resp = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers=headers,
            json={'model': model, 'messages': messages},
            timeout=90,
        )
    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 502

    if not resp.ok:
        err = resp.json() if resp.content else {}
        msg = err.get('error', resp.reason)
        if isinstance(msg, dict):
            msg = msg.get('message', str(msg))
        return jsonify({'error': str(msg)}), resp.status_code

    result = resp.json()
    raw = (result.get('choices') or [{}])[0].get('message', {}).get('content', '') or ''
    caption = raw.strip()
    if not caption:
        return jsonify({'error': 'Model returned an empty caption'}), 502

    return jsonify({'caption': caption}), 200
