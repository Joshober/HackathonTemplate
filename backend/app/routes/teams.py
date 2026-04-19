"""
Teams and team chat (MongoDB). All routes require auth; caller is upserted into `users` on each request.
"""
import base64
import io
import os
import re
from datetime import datetime, date
from functools import wraps

import requests
from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, jsonify, request
from PIL import Image

from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth, get_user_info_from_request as get_user_info_from_token
from app.config.openrouter_models import DEFAULT_VISION_MODEL
from app.services.team_chat import run_team_travel_assistant
from app.services.team_items_access import format_item_document
from app.services.google_calendar import get_google_calendar_token_doc

bp = Blueprint('teams', __name__)

_indexes_ensured = False
MAX_TEAM_CITY_PRESETS = 20
MAX_MANUAL_AVAILABILITY_WINDOWS = 24

# Doc-aligned defaults when a team has no linked trip cards yet (README / Plan brief: London + passport window; HackKU 2026).
TEAM_TRIP_DOCS_DEFAULT_DESTINATION = 'London, UK'
TEAM_TRIP_DOCS_DEFAULT_START = '2026-04-22'
TEAM_TRIP_DOCS_DEFAULT_END = '2026-04-26'

_TRIP_STATUS_RANK = {
    'booked': 8,
    'approved': 7,
    'completed': 6,
    'pending': 5,
    'submitted': 4,
    'ready_for_approval': 3,
    'needs_changes': 2,
    'draft': 1,
}


def _team_message_invokes_assistant(content: str, invoke_explicit) -> bool:
    """
    Whether to run the travel assistant for this team message.

    - invokeAssistant true from client: always run.
    - invokeAssistant false: run only if the text contains @AI or @assistant
      (after line start or whitespace; case-insensitive).
    - invokeAssistant omitted: same as false (mention-only unless overridden).
    """
    text = (content or '').strip()
    has_mention = bool(
        re.search(r'(?:^|\s)@ai\b', text, re.IGNORECASE)
        or re.search(r'(?:^|\s)@assistant\b', text, re.IGNORECASE)
    )
    if invoke_explicit is True:
        return True
    if invoke_explicit is False:
        return has_mention
    return has_mention


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


def _normalize_iso_day(raw) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.date().isoformat()
    s = " ".join(str(raw).split()).strip()
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10]).isoformat()
    except ValueError:
        return None


def _normalize_manual_windows(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        start_day = _normalize_iso_day(row.get('startDate'))
        end_day = _normalize_iso_day(row.get('endDate'))
        if not start_day or not end_day or start_day > end_day:
            continue
        out.append({'startDate': start_day, 'endDate': end_day})
        if len(out) >= MAX_MANUAL_AVAILABILITY_WINDOWS:
            break
    return out


def _normalize_budget(raw) -> float | None:
    if raw is None or raw == '':
        return None
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None
    if v < 0:
        return None
    return round(v, 2)


def _normalize_object_id_hex(raw) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, ObjectId):
        return str(raw)
    s = str(raw).strip()
    if not s:
        return None
    try:
        return str(ObjectId(s))
    except InvalidId:
        return None


def _travel_dict(item: dict) -> dict:
    t = item.get('travel')
    return t if isinstance(t, dict) else {}


def _item_trip_score(item: dict) -> tuple:
    """Higher tuple = better candidate for team trip context."""
    t = _travel_dict(item)
    st = str(t.get('opportunityStatus') or 'draft').lower()
    rank = _TRIP_STATUS_RANK.get(st, 0)
    start = _normalize_iso_day(t.get('startDate'))
    end = _normalize_iso_day(t.get('endDate'))
    loc = str(t.get('location') or '').strip()
    completeness = (4 if start and end else 0) + (2 if loc else 0)
    upd = item.get('updatedAt')
    if isinstance(upd, datetime):
        if upd.tzinfo:
            upd = upd.replace(tzinfo=None)
    else:
        upd = datetime.min
    return (rank, completeness, upd)


def _infer_trip_from_team_items(db, team_oid: ObjectId) -> dict | None:
    """Best-effort trip from items already linked to this team (teamId)."""
    items = list(db.items.find({'teamId': team_oid}).sort('updatedAt', -1).limit(120))
    if not items:
        return None
    best = max(items, key=_item_trip_score)
    t = _travel_dict(best)
    loc = str(t.get('location') or '').strip()
    start = _normalize_iso_day(t.get('startDate'))
    end = _normalize_iso_day(t.get('endDate'))
    if not loc and not (start and end):
        return None
    return {
        'focusTripItemId': str(best['_id']),
        'tripDestination': loc or None,
        'tripStartDate': start,
        'tripEndDate': end,
    }


def _docs_default_trip() -> dict:
    return {
        'focusTripItemId': None,
        'tripDestination': TEAM_TRIP_DOCS_DEFAULT_DESTINATION,
        'tripStartDate': TEAM_TRIP_DOCS_DEFAULT_START,
        'tripEndDate': TEAM_TRIP_DOCS_DEFAULT_END,
    }


def _merge_trip_plan(db, team_oid: ObjectId, team: dict) -> dict:
    """
    Merge stored team fields, focused item, inferred team items, then doc demo defaults.
    Returns tripContext dict for API + optional persistence hints.
    """
    raw_start = _normalize_iso_day(team.get('tripStartDate'))
    raw_end = _normalize_iso_day(team.get('tripEndDate'))
    raw_dest = str(team.get('tripDestination') or '').strip() or None
    raw_focus = _normalize_object_id_hex(team.get('focusTripItemId'))

    from_focus: dict = {}
    if raw_focus:
        try:
            item = db.items.find_one({'_id': ObjectId(raw_focus), 'teamId': team_oid})
        except (InvalidId, TypeError):
            item = None
        if item:
            t = _travel_dict(item)
            from_focus = {
                'tripDestination': str(t.get('location') or '').strip() or None,
                'tripStartDate': _normalize_iso_day(t.get('startDate')),
                'tripEndDate': _normalize_iso_day(t.get('endDate')),
            }

    inferred = _infer_trip_from_team_items(db, team_oid)

    dest = raw_dest or from_focus.get('tripDestination') or (inferred or {}).get('tripDestination')
    start = raw_start or from_focus.get('tripStartDate') or (inferred or {}).get('tripStartDate')
    end = raw_end or from_focus.get('tripEndDate') or (inferred or {}).get('tripEndDate')
    focus = raw_focus or (inferred or {}).get('focusTripItemId')

    used_demo = False
    if not dest or not start or not end:
        demo = _docs_default_trip()
        if not dest:
            dest = demo['tripDestination']
            used_demo = True
        if not start:
            start = demo['tripStartDate']
            used_demo = True
        if not end:
            end = demo['tripEndDate']
            used_demo = True

    persisted_src = str(team.get('tripContextSource') or '').strip()
    if persisted_src in ('user', 'inferred', 'demo_docs', 'mixed') and raw_start and raw_end:
        source = persisted_src
    elif raw_start and raw_end:
        source = 'user'
    elif inferred and not used_demo:
        source = 'inferred'
    elif inferred and used_demo:
        source = 'mixed'
    else:
        source = 'demo_docs'

    return {
        'focusTripItemId': focus,
        'tripDestination': dest,
        'tripStartDate': start,
        'tripEndDate': end,
        'tripContextSource': source,
    }


def _persist_team_trip_if_empty(db, team_oid: ObjectId, team: dict, merged: dict) -> None:
    """Backfill Mongo when the team has no trip fields yet (infer from items or doc defaults)."""
    has_any = bool(
        team.get('tripStartDate')
        or team.get('tripEndDate')
        or team.get('tripDestination')
        or team.get('focusTripItemId')
    )
    if has_any:
        return
    if not merged.get('tripStartDate') or not merged.get('tripEndDate'):
        return
    db.teams.update_one(
        {'_id': team_oid},
        {
            '$set': {
                'tripDestination': merged.get('tripDestination'),
                'tripStartDate': merged.get('tripStartDate'),
                'tripEndDate': merged.get('tripEndDate'),
                'focusTripItemId': merged.get('focusTripItemId'),
                'tripContextSource': merged.get('tripContextSource'),
                'updatedAt': datetime.utcnow(),
            }
        },
    )


def _trip_context_response(merged: dict) -> dict:
    return {
        'focusTripItemId': merged.get('focusTripItemId'),
        'tripDestination': merged.get('tripDestination'),
        'tripStartDate': merged.get('tripStartDate'),
        'tripEndDate': merged.get('tripEndDate'),
        'tripContextSource': merged.get('tripContextSource'),
    }


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
    ts = _normalize_iso_day(data.get('tripStartDate'))
    te = _normalize_iso_day(data.get('tripEndDate'))
    td = str(data.get('tripDestination') or '').strip() or None
    focus = _normalize_object_id_hex(data.get('focusTripItemId'))
    if ts and te:
        if ts > te:
            return jsonify({'error': 'tripStartDate must be on or before tripEndDate'}), 400
        doc['tripStartDate'] = ts
        doc['tripEndDate'] = te
        doc['tripContextSource'] = 'user'
    if td:
        doc['tripDestination'] = td[:160]
    if focus:
        try:
            own = db.items.find_one({'_id': ObjectId(focus), 'userId': user_id})
        except (InvalidId, TypeError):
            own = None
        if own:
            doc['focusTripItemId'] = focus
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
        merged = _merge_trip_plan(db, t['_id'], t)
        teams.append({
            'id': str(t['_id']),
            'name': t.get('name', ''),
            'memberCount': len(t.get('memberIds') or []),
            'tripContext': _trip_context_response(merged),
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
    merged = _merge_trip_plan(db, oid, team)
    _persist_team_trip_if_empty(db, oid, team, merged)
    return jsonify({
        'id': str(team['_id']),
        'name': team.get('name', ''),
        'description': team.get('description'),
        'createdBy': team.get('createdBy'),
        'members': members,
        'cityPresets': _normalize_city_list(team.get('cityPresets') or []),
        'tripContext': _trip_context_response(merged),
    }), 200


@bp.route('/teams/<team_id>/trip-plan', methods=['PATCH'])
@require_auth
@with_user_sync
def set_team_trip_plan(user_id, team_id):
    """Set team trip focus + destination + dates (any member)."""
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    team = _team_for_member(db, oid, user_id)
    if not team:
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(silent=True) or {}

    set_fields: dict = {'updatedAt': datetime.utcnow(), 'tripContextSource': 'user'}
    unset_doc: dict[str, str] = {}

    if 'focusTripItemId' in data:
        raw_f = data.get('focusTripItemId')
        if raw_f in (None, '', False):
            unset_doc['focusTripItemId'] = ''
        else:
            focus = _normalize_object_id_hex(raw_f)
            if not focus:
                return jsonify({'error': 'Invalid focusTripItemId'}), 400
            item = db.items.find_one({'_id': ObjectId(focus), 'teamId': oid})
            if not item:
                return jsonify({'error': 'focusTripItemId must reference an item linked to this team'}), 400
            set_fields['focusTripItemId'] = focus

    if 'tripDestination' in data:
        dest = str(data.get('tripDestination') or '').strip()
        set_fields['tripDestination'] = dest[:160] if dest else None

    if 'tripStartDate' in data:
        set_fields['tripStartDate'] = _normalize_iso_day(data.get('tripStartDate'))
    if 'tripEndDate' in data:
        set_fields['tripEndDate'] = _normalize_iso_day(data.get('tripEndDate'))

    ts_eff = set_fields.get('tripStartDate', team.get('tripStartDate'))
    te_eff = set_fields.get('tripEndDate', team.get('tripEndDate'))
    ts_eff = _normalize_iso_day(ts_eff) if ts_eff else None
    te_eff = _normalize_iso_day(te_eff) if te_eff else None
    if ts_eff and te_eff and ts_eff > te_eff:
        return jsonify({'error': 'tripStartDate must be on or before tripEndDate'}), 400

    upd: dict = {'$set': set_fields}
    if unset_doc:
        upd['$unset'] = unset_doc
    db.teams.update_one({'_id': oid}, upd)

    team = db.teams.find_one({'_id': oid}) or team
    merged = _merge_trip_plan(db, oid, team)
    return jsonify({'tripContext': _trip_context_response(merged)}), 200


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

    invoke_assistant = _team_message_invokes_assistant(content, data.get('invokeAssistant'))

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


@bp.route('/teams/<team_id>/calendar-coverage', methods=['GET'])
@require_auth
@with_user_sync
def team_calendar_coverage(user_id, team_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    team = _team_for_member(db, oid, user_id)
    if not team:
        return jsonify({'error': 'Forbidden'}), 403
    members = _resolve_members(db, team.get('memberIds') or [])
    manual_map = team.get('manualAvailability') if isinstance(team.get('manualAvailability'), dict) else {}
    rows = []
    connected_count = 0
    manual_count = 0
    for m in members:
        uid = m.get('userId') or ''
        token_doc = get_google_calendar_token_doc(db, uid) if uid else None
        connected = bool(token_doc and (token_doc.get('accessToken') or token_doc.get('refreshToken')))
        manual_windows = manual_map.get(uid) if isinstance(manual_map, dict) else None
        has_manual = isinstance(manual_windows, list) and len(manual_windows) > 0
        if connected:
            connected_count += 1
        if has_manual:
            manual_count += 1
        rows.append(
            {
                'userId': uid,
                'displayName': m.get('displayName'),
                'email': m.get('email'),
                'connected': connected,
                'manualAvailability': has_manual,
            }
        )
    return jsonify(
        {
            'teamId': team_id,
            'totalMembers': len(rows),
            'connectedMembers': connected_count,
            'manualAvailabilityMembers': manual_count,
            'members': rows,
        }
    ), 200


@bp.route('/teams/<team_id>/availability/me', methods=['PUT'])
@require_auth
@with_user_sync
def set_team_manual_availability(user_id, team_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    team = _team_for_member(db, oid, user_id)
    if not team:
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(silent=True) or {}
    windows = _normalize_manual_windows(data.get('windows') or [])
    budget_min = _normalize_budget(data.get('budgetMin'))
    budget_max = _normalize_budget(data.get('budgetMax'))
    if budget_min is not None and budget_max is not None and budget_min > budget_max:
        return jsonify({'error': 'budgetMin must be <= budgetMax'}), 400
    db.teams.update_one(
        {'_id': oid},
        {
            '$set': {
                f'manualAvailability.{user_id}': windows,
                f'manualBudget.{user_id}': {
                    'min': budget_min,
                    'max': budget_max,
                },
                'updatedAt': datetime.utcnow(),
            }
        },
    )
    return jsonify({'windows': windows, 'budgetMin': budget_min, 'budgetMax': budget_max}), 200


@bp.route('/teams/<team_id>/availability', methods=['GET'])
@require_auth
@with_user_sync
def get_team_manual_availability(user_id, team_id):
    oid = _parse_oid(team_id)
    if not oid:
        return jsonify({'error': 'Invalid team id'}), 400
    db = get_db()
    team = _team_for_member(db, oid, user_id)
    if not team:
        return jsonify({'error': 'Forbidden'}), 403
    members = _resolve_members(db, team.get('memberIds') or [])
    manual_map = team.get('manualAvailability') if isinstance(team.get('manualAvailability'), dict) else {}
    budget_map = team.get('manualBudget') if isinstance(team.get('manualBudget'), dict) else {}
    rows = []
    for m in members:
        uid = m.get('userId') or ''
        windows = manual_map.get(uid) if isinstance(manual_map, dict) else []
        budget = budget_map.get(uid) if isinstance(budget_map, dict) and isinstance(budget_map.get(uid), dict) else {}
        rows.append(
            {
                'userId': uid,
                'displayName': m.get('displayName'),
                'email': m.get('email'),
                'windows': _normalize_manual_windows(windows if isinstance(windows, list) else []),
                'budgetMin': _normalize_budget((budget or {}).get('min')),
                'budgetMax': _normalize_budget((budget or {}).get('max')),
            }
        )
    return jsonify({'teamId': team_id, 'members': rows}), 200


# Team-scoped items surfaced in /return-feed: planning pipeline + finalized trips.
# (Return-stage UI filters client-side so drafts are not mixed into post-trip tools.)
RETURN_FEED_STATUSES = (
    'draft',
    'ready_for_approval',
    'submitted',
    'pending',
    'needs_changes',
    'approved',
    'booked',
    'completed',
)

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

    model = os.getenv('OPENROUTER_CHAT_VISION_MODEL') or DEFAULT_VISION_MODEL
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
