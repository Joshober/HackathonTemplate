from flask import Blueprint, request, jsonify
from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId

bp = Blueprint('realtime', __name__)


def _parse_object_id(value, param_name='id'):
    try:
        return ObjectId(value)
    except InvalidId:
        return None


@bp.route('/objectives/<objective_id>/updates', methods=['GET'])
@require_auth
def get_objective_updates(objective_id, user_id):
    """
    Get updates for an objective since a given timestamp (polling endpoint).
    Query param: since (ISO timestamp)
    """
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        
        since_str = request.args.get('since')
        since = None
        if since_str:
            try:
                since = datetime.fromisoformat(since_str.replace('Z', '+00:00'))
            except:
                return jsonify({'error': 'Invalid since timestamp format'}), 400
        
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        # Check if objective was modified since the given timestamp
        last_modified = objective.get('lastModified')
        if isinstance(last_modified, str):
            last_modified = datetime.fromisoformat(last_modified.replace('Z', '+00:00'))
        
        has_updates = False
        if since and last_modified:
            has_updates = last_modified > since
        elif not since:
            has_updates = True
        
        # Get key results updates
        kr_updates = []
        if since:
            kr_cursor = db.key_results.find({
                'objectiveId': oid,
                'lastModified': {'$gt': since}
            })
        else:
            kr_cursor = db.key_results.find({'objectiveId': oid})
        
        for kr in kr_cursor:
            kr_updates.append({
                '_id': str(kr['_id']),
                'title': kr.get('title'),
                'lastModified': kr.get('lastModified').isoformat() if isinstance(kr.get('lastModified'), datetime) else kr.get('lastModified'),
                'score': kr.get('score'),
                'currentValue': kr.get('currentValue'),
            })
        
        return jsonify({
            'hasUpdates': has_updates,
            'lastModified': last_modified.isoformat() if isinstance(last_modified, datetime) else last_modified,
            'objectiveUpdates': {
                'workflowState': objective.get('workflowState'),
                'title': objective.get('title'),
                'updatedAt': objective.get('updatedAt').isoformat() if isinstance(objective.get('updatedAt'), datetime) else objective.get('updatedAt'),
            },
            'keyResultUpdates': kr_updates
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
