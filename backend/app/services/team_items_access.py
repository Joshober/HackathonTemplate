"""Team membership checks for team-scoped items (Return feed, shared uploads)."""
from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId


def parse_team_oid(team_id: str) -> ObjectId | None:
    if not team_id or not isinstance(team_id, str):
        return None
    try:
        return ObjectId(team_id)
    except (InvalidId, TypeError):
        return None


def user_member_of_team(db, user_id: str, team_oid: ObjectId) -> bool:
    return db.teams.find_one({'_id': team_oid, 'memberIds': user_id}) is not None


def item_access_level(db, item: dict, user_id: str) -> str | None:
    """
    Returns 'owner' if user owns the item, 'team_member' if item has teamId and user is in that team,
    else None.
    """
    if item.get('userId') == user_id:
        return 'owner'
    tid = item.get('teamId')
    if tid and isinstance(tid, ObjectId) and user_member_of_team(db, user_id, tid):
        return 'team_member'
    return None


def format_item_document(item: dict) -> dict:
    """Match items route JSON shape: string ids and ISO dates."""
    out = dict(item)
    out['_id'] = str(out['_id'])
    tid = out.get('teamId')
    if tid is not None:
        out['teamId'] = str(tid) if tid else None
    for key in ('createdAt', 'updatedAt'):
        if key in out and isinstance(out[key], datetime):
            out[key] = out[key].isoformat()
    return out
