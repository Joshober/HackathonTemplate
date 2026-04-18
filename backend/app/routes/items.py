import json
from flask import Blueprint, request, jsonify
from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth
from app.config.cloudinary_config import upload_image, upload_video
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId

from app.services.team_items_access import (
    format_item_document,
    item_access_level,
    parse_team_oid,
    user_member_of_team,
)

bp = Blueprint('items', __name__)

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'webm', 'ogg', 'mov', 'avi'}

_items_indexes_ensured = False


def _ensure_item_indexes(db):
    global _items_indexes_ensured
    if _items_indexes_ensured:
        return
    try:
        db.items.create_index([('teamId', 1), ('updatedAt', -1)], sparse=True)
    except Exception as e:
        print(f'Warning: items teamId index: {e}', flush=True)
    _items_indexes_ensured = True


def allowed_image_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


def allowed_video_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_VIDEO_EXTENSIONS


# Live pricing quote cache (per trip) can include many flight/hotel rows; keep a generous cap.
MAX_TRAVEL_JSON_BYTES = 131072


def _sanitize_travel(raw):
    """Allow a small JSON-serializable dict for travel metadata (client-defined shape)."""
    if raw is None:
        return None
    if not isinstance(raw, dict):
        return None
    try:
        s = json.dumps(raw, default=str)
    except (TypeError, ValueError):
        return None
    if len(s) > MAX_TRAVEL_JSON_BYTES:
        return None
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return None


def _extract_team_id_string():
    if request.is_json:
        data = request.get_json(silent=True) or {}
        tid = data.get('teamId')
        return (tid or '').strip() if isinstance(tid, str) else ''
    return (request.form.get('teamId') or '').strip()


def _resolve_team_id_for_create(db, user_id):
    raw = _extract_team_id_string()
    if not raw:
        return None
    oid = parse_team_oid(raw)
    if not oid or not user_member_of_team(db, user_id, oid):
        return 'forbidden'
    return oid


@bp.route('/items', methods=['GET'])
@require_auth
def get_items(user_id):
    """Get all items owned by the authenticated user."""
    try:
        db = get_db()
        _ensure_item_indexes(db)
        items_collection = db.items

        items = list(items_collection.find({'userId': user_id}))

        result = []
        for item in items:
            result.append(format_item_document(item))

        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/items/<item_id>', methods=['GET'])
@require_auth
def get_item(item_id, user_id):
    """Get a single item if owner or member of the item's team."""
    try:
        db = get_db()
        _ensure_item_indexes(db)
        items_collection = db.items

        try:
            object_id = ObjectId(item_id)
        except InvalidId:
            return jsonify({'error': 'Invalid item ID'}), 400

        item = items_collection.find_one({'_id': object_id})
        if not item:
            return jsonify({'error': 'Item not found'}), 404

        if item_access_level(db, item, user_id) is None:
            return jsonify({'error': 'Item not found'}), 404

        return jsonify(format_item_document(item)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/items', methods=['POST'])
@require_auth
def create_item(user_id):
    """Create a new item with optional images and videos"""
    try:
        db = get_db()
        _ensure_item_indexes(db)
        items_collection = db.items

        team_res = _resolve_team_id_for_create(db, user_id)
        if team_res == 'forbidden':
            return jsonify({'error': 'Invalid teamId or you are not a member of that team'}), 403

        if request.is_json:
            data = request.get_json(silent=True) or {}
            title = data.get('title')
            description = data.get('description')
            imageUrls = list(data.get('imageUrls') or [])
            videoUrls = list(data.get('videoUrls') or [])
        else:
            data = request.form
            title = data.get('title')
            description = data.get('description')
            imageUrls = []
            videoUrls = []

        if not title or not description:
            return jsonify({'error': 'Title and description are required'}), 400

        if 'images' in request.files:
            files = request.files.getlist('images')
            for file in files:
                if file and file.filename and allowed_image_file(file.filename):
                    try:
                        image_url = upload_image(file, folder='items')
                        imageUrls.append(image_url)
                    except Exception as e:
                        return jsonify({'error': f'Failed to upload image: {str(e)}'}), 500

        if 'videos' in request.files:
            files = request.files.getlist('videos')
            for file in files:
                if file and file.filename and allowed_video_file(file.filename):
                    try:
                        video_url = upload_video(file, folder='items')
                        videoUrls.append(video_url)
                    except Exception as e:
                        return jsonify({'error': f'Failed to upload video: {str(e)}'}), 500

        now = datetime.utcnow()
        new_item = {
            'userId': user_id,
            'title': title,
            'description': description,
            'imageUrls': imageUrls,
            'videoUrls': videoUrls,
            'createdAt': now,
            'updatedAt': now,
        }
        if isinstance(team_res, ObjectId):
            new_item['teamId'] = team_res

        if request.is_json:
            data = request.get_json(silent=True) or {}
            travel = _sanitize_travel(data.get('travel'))
            if travel is not None:
                new_item['travel'] = travel
        else:
            raw_travel = request.form.get('travel')
            if raw_travel:
                try:
                    travel = _sanitize_travel(json.loads(raw_travel))
                    if travel is not None:
                        new_item['travel'] = travel
                except (json.JSONDecodeError, TypeError, ValueError):
                    pass

        result = items_collection.insert_one(new_item)
        new_item['_id'] = result.inserted_id
        return jsonify(format_item_document(new_item)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/items/<item_id>', methods=['PUT'])
@require_auth
def update_item(item_id, user_id):
    """Update an existing item; team members may append media and merge travel on team-scoped items."""
    try:
        db = get_db()
        _ensure_item_indexes(db)
        items_collection = db.items

        try:
            object_id = ObjectId(item_id)
        except InvalidId:
            return jsonify({'error': 'Invalid item ID'}), 400

        existing_item = items_collection.find_one({'_id': object_id})
        if not existing_item:
            return jsonify({'error': 'Item not found'}), 404

        access = item_access_level(db, existing_item, user_id)
        if access is None:
            return jsonify({'error': 'Item not found'}), 404

        if request.is_json:
            data = request.get_json(silent=True) or {}
        else:
            data = request.form

        has_files = 'images' in request.files or 'videos' in request.files
        if not has_files:
            if request.is_json:
                if not data:
                    return jsonify({'error': 'No data provided'}), 400
            elif not data or not any((request.form.get(k) or '').strip() for k in request.form):
                return jsonify({'error': 'No data provided'}), 400

        if access == 'team_member':
            if request.is_json and isinstance(data, dict):
                disallowed = set(data.keys()) - {'travel'}
                if disallowed:
                    return jsonify({'error': 'Team members may only update travel on this item'}), 403
            elif not request.is_json:
                if (data.get('title') or '').strip() or (data.get('description') or '').strip():
                    return jsonify({'error': 'Team members may not change title or description'}), 403

        update_data = {'updatedAt': datetime.utcnow()}

        if access == 'owner':
            if request.is_json and isinstance(data, dict) and 'teamId' in data:
                tid_raw = data.get('teamId')
                if existing_item.get('teamId'):
                    if tid_raw is not None and tid_raw != '':
                        want = tid_raw.strip() if isinstance(tid_raw, str) else str(tid_raw)
                        if want and want != str(existing_item['teamId']):
                            return jsonify({'error': 'teamId is already set for this item'}), 400
                else:
                    if tid_raw is None:
                        pass
                    elif isinstance(tid_raw, str) and tid_raw.strip():
                        oid = parse_team_oid(tid_raw.strip())
                        if not oid or not user_member_of_team(db, user_id, oid):
                            return jsonify({'error': 'Invalid teamId or not a team member'}), 403
                        update_data['teamId'] = oid

            if 'title' in data:
                update_data['title'] = data['title']
            if 'description' in data:
                update_data['description'] = data['description']
        else:
            if request.is_json and isinstance(data, dict) and 'teamId' in data:
                return jsonify({'error': 'Forbidden'}), 403

        image_urls = list(existing_item.get('imageUrls') or [])
        if 'images' in request.files:
            files = request.files.getlist('images')
            for file in files:
                if file and file.filename and allowed_image_file(file.filename):
                    try:
                        image_url = upload_image(file, folder='items')
                        image_urls.append(image_url)
                    except Exception as e:
                        return jsonify({'error': f'Failed to upload image: {str(e)}'}), 500
        elif access == 'owner' and request.is_json and isinstance(data, dict) and 'imageUrls' in data:
            image_urls = data.get('imageUrls', [])

        update_data['imageUrls'] = image_urls

        video_urls = list(existing_item.get('videoUrls') or [])
        if 'videos' in request.files:
            files = request.files.getlist('videos')
            for file in files:
                if file and file.filename and allowed_video_file(file.filename):
                    try:
                        video_url = upload_video(file, folder='items')
                        video_urls.append(video_url)
                    except Exception as e:
                        return jsonify({'error': f'Failed to upload video: {str(e)}'}), 500
        elif access == 'owner' and request.is_json and isinstance(data, dict) and 'videoUrls' in data:
            video_urls = data.get('videoUrls', [])

        update_data['videoUrls'] = video_urls

        if request.is_json and isinstance(data, dict) and 'travel' in data:
            travel = _sanitize_travel(data.get('travel'))
            if travel is not None:
                if access == 'team_member':
                    base = existing_item.get('travel') or {}
                    if not isinstance(base, dict):
                        base = {}
                    merged = dict(base)
                    merged.update(travel)
                    merged = _sanitize_travel(merged)
                    if merged is not None:
                        update_data['travel'] = merged
                else:
                    update_data['travel'] = travel
        elif not request.is_json and request.form.get('travel'):
            try:
                travel = _sanitize_travel(json.loads(request.form.get('travel')))
                if travel is not None:
                    if access == 'team_member':
                        base = existing_item.get('travel') or {}
                        if not isinstance(base, dict):
                            base = {}
                        merged = dict(base)
                        merged.update(travel)
                        merged = _sanitize_travel(merged)
                        if merged is not None:
                            update_data['travel'] = merged
                    else:
                        update_data['travel'] = travel
            except (json.JSONDecodeError, TypeError, ValueError):
                pass

        items_collection.update_one({'_id': object_id}, {'$set': update_data})

        updated_item = items_collection.find_one({'_id': object_id})
        return jsonify(format_item_document(updated_item)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/items/<item_id>', methods=['DELETE'])
@require_auth
def delete_item(item_id, user_id):
    """Delete an item (owner only)."""
    try:
        db = get_db()
        items_collection = db.items

        try:
            object_id = ObjectId(item_id)
        except InvalidId:
            return jsonify({'error': 'Invalid item ID'}), 400

        item = items_collection.find_one({'_id': object_id, 'userId': user_id})
        if not item:
            return jsonify({'error': 'Item not found'}), 404

        items_collection.delete_one({'_id': object_id, 'userId': user_id})

        return jsonify({'message': 'Item deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
