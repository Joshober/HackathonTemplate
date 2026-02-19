from flask import Blueprint, request, jsonify
from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth
from app.services.audit import log_change, get_audit_trail
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId

bp = Blueprint('okrs', __name__)


def _serialize_doc(doc, date_fields=None):
    """Convert MongoDB doc to JSON-serializable dict (ObjectId and datetime to string)."""
    if doc is None:
        return None
    date_fields = date_fields or ['createdAt', 'updatedAt', 'lastUpdatedAt', 'lastModified', 'targetDate', 'uploadedAt', 'deletedAt', 'timestamp']
    out = dict(doc)
    if '_id' in out:
        out['_id'] = str(out['_id'])
    for k in list(out.keys()):
        if k == 'parentObjectiveId' and out.get(k) is not None:
            out[k] = str(out[k])
        elif k == 'objectiveId' and out.get(k) is not None:
            out[k] = str(out[k])
        elif k == 'entityId' and out.get(k) is not None:
            out[k] = str(out[k])
        elif k in date_fields and out.get(k) is not None and isinstance(out[k], datetime):
            out[k] = out[k].isoformat()
    return out


def _parse_object_id(value, param_name='id'):
    try:
        return ObjectId(value)
    except InvalidId:
        return None


# ---- Objectives ----

@bp.route('/objectives', methods=['GET'])
@require_auth
def list_objectives(user_id):
    """List objectives with optional filters: fiscalYear, level, division, parentObjectiveId."""
    try:
        db = get_db()
        coll = db.objectives
        q = {}
        fiscal_year = request.args.get('fiscalYear', type=int)
        if fiscal_year is not None:
            q['fiscalYear'] = fiscal_year
        level = request.args.get('level')
        if level:
            q['level'] = level
        division = request.args.get('division')
        if division:
            q['division'] = division
        parent_id = request.args.get('parentObjectiveId')
        if parent_id:
            oid = _parse_object_id(parent_id)
            if oid is None:
                return jsonify({'error': 'Invalid parentObjectiveId'}), 400
            q['parentObjectiveId'] = oid
        elif parent_id is not None and parent_id == '':
            q['$or'] = [{'parentObjectiveId': None}, {'parentObjectiveId': {'$exists': False}}]

        cursor = coll.find(q).sort('createdAt', -1)
        items = [_serialize_doc(d) for d in cursor]
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>', methods=['GET'])
@require_auth
def get_objective(objective_id, user_id):
    """Get a single objective by ID."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        doc = db.objectives.find_one({'_id': oid})
        if not doc:
            return jsonify({'error': 'Objective not found'}), 404
        return jsonify(_serialize_doc(doc)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives', methods=['POST'])
@require_auth
def create_objective(user_id):
    """Create a new objective."""
    try:
        data = request.get_json() or {}
        title = data.get('title')
        if not title:
            return jsonify({'error': 'Title is required'}), 400
        level = data.get('level', 'strategic')
        timeline = data.get('timeline', 'annual')
        fiscal_year = data.get('fiscalYear')
        if fiscal_year is None:
            return jsonify({'error': 'fiscalYear is required'}), 400

        parent_id = data.get('parentObjectiveId')
        parent_oid = None
        if parent_id:
            parent_oid = _parse_object_id(parent_id)
            if parent_oid is None:
                return jsonify({'error': 'Invalid parentObjectiveId'}), 400

        now = datetime.utcnow()
        doc = {
            'title': title,
            'description': data.get('description', ''),
            'ownerId': data.get('ownerId', user_id),
            'level': level,
            'timeline': timeline,
            'fiscalYear': fiscal_year,
            'quarter': data.get('quarter'),
            'parentObjectiveId': parent_oid,
            'division': data.get('division'),
            'workflowState': data.get('workflowState', 'active'),
            'workflowHistory': data.get('workflowHistory', []),
            'permissions': data.get('permissions', {
                'viewOnly': [],
                'editKeyResults': [],
                'editObjective': [],
                'fullControl': []
            }),
            'riskFlag': data.get('riskFlag', False),
            'milestones': data.get('milestones', []),
            'dependencies': data.get('dependencies', []),
            'files': data.get('files', []),
            'pinnedFields': data.get('pinnedFields', {}),
            'createdAt': now,
            'updatedAt': now,
            'lastModified': now,
        }
        db = get_db()
        result = db.objectives.insert_one(doc)
        doc['_id'] = result.inserted_id
        
        # Log creation to audit trail
        log_change('objective', str(doc['_id']), user_id, 'created', reason='Objective created')
        
        return jsonify(_serialize_doc(doc)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>', methods=['PUT'])
@require_auth
def update_objective(objective_id, user_id):
    """Update an existing objective."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        data = request.get_json() or {}
        db = get_db()
        existing = db.objectives.find_one({'_id': oid})
        if not existing:
            return jsonify({'error': 'Objective not found'}), 404

        now = datetime.utcnow()
        update = {'updatedAt': now, 'lastModified': now}
        for key in ('title', 'description', 'ownerId', 'level', 'timeline', 'fiscalYear', 'quarter', 'division',
                    'workflowState', 'workflowHistory', 'permissions', 'riskFlag', 'milestones', 'dependencies',
                    'files', 'pinnedFields'):
            if key in data:
                update[key] = data[key]
        if 'parentObjectiveId' in data:
            if data['parentObjectiveId'] is None or data['parentObjectiveId'] == '':
                update['parentObjectiveId'] = None
            else:
                poid = _parse_object_id(data['parentObjectiveId'])
                if poid is None:
                    return jsonify({'error': 'Invalid parentObjectiveId'}), 400
                update['parentObjectiveId'] = poid

        # Track changes for audit trail
        changes = []
        for key in update:
            if key not in ('updatedAt', 'lastModified'):
                old_value = existing.get(key)
                new_value = update[key]
                if old_value != new_value:
                    changes.append({
                        'field': key,
                        'oldValue': old_value,
                        'newValue': new_value
                    })
        
        db.objectives.update_one({'_id': oid}, {'$set': update})
        updated = db.objectives.find_one({'_id': oid})
        
        # Log update to audit trail
        if changes:
            log_change('objective', objective_id, user_id, 'updated', changes=changes)
        
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>', methods=['DELETE'])
@require_auth
def delete_objective(objective_id, user_id):
    """Delete an objective and its key results."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        existing = db.objectives.find_one({'_id': oid})
        if not existing:
            return jsonify({'error': 'Objective not found'}), 404
        # Log deletion to audit trail
        log_change('objective', objective_id, user_id, 'deleted', reason='Objective deleted')
        
        db.key_results.delete_many({'objectiveId': oid})
        db.objectives.delete_one({'_id': oid})
        return jsonify({'message': 'Objective deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/tree', methods=['GET'])
@require_auth
def get_objective_tree(objective_id, user_id):
    """Get objective with full tree of children (recursive) and key results. Roll-up view."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        root = db.objectives.find_one({'_id': oid})
        if not root:
            return jsonify({'error': 'Objective not found'}), 404

        def build_node(obj_doc):
            node = _serialize_doc(obj_doc)
            node_id = obj_doc['_id']
            children = list(db.objectives.find({'parentObjectiveId': node_id}))
            node['children'] = [build_node(c) for c in children]
            krs = list(db.key_results.find({'objectiveId': node_id}))
            node['keyResults'] = [_serialize_doc(kr) for kr in krs]
            scores = [kr.get('score') for kr in krs if kr.get('score') is not None]
            node['averageScore'] = round(sum(scores) / len(scores), 1) if scores else None
            return node

        tree = build_node(root)
        return jsonify(tree), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Key Results ----

@bp.route('/key-results', methods=['GET'])
@require_auth
def list_key_results(user_id):
    """List key results, optionally filtered by objectiveId."""
    try:
        objective_id = request.args.get('objectiveId')
        if not objective_id:
            return jsonify({'error': 'objectiveId query param is required'}), 400
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objectiveId'}), 400
        db = get_db()
        cursor = db.key_results.find({'objectiveId': oid})
        items = [_serialize_doc(d) for d in cursor]
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/key-results/<kr_id>', methods=['GET'])
@require_auth
def get_key_result(kr_id, user_id):
    """Get a single key result by ID."""
    try:
        kid = _parse_object_id(kr_id)
        if kid is None:
            return jsonify({'error': 'Invalid key result ID'}), 400
        db = get_db()
        doc = db.key_results.find_one({'_id': kid})
        if not doc:
            return jsonify({'error': 'Key result not found'}), 404
        return jsonify(_serialize_doc(doc)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/key-results', methods=['POST'])
@require_auth
def create_key_result(user_id):
    """Create a new key result."""
    try:
        data = request.get_json() or {}
        objective_id = data.get('objectiveId')
        title = data.get('title')
        if not objective_id or not title:
            return jsonify({'error': 'objectiveId and title are required'}), 400
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objectiveId'}), 400
        db = get_db()
        if not db.objectives.find_one({'_id': oid}):
            return jsonify({'error': 'Objective not found'}), 404
        now = datetime.utcnow()
        doc = {
            'objectiveId': oid,
            'title': title,
            'target': data.get('target'),
            'currentValue': data.get('currentValue'),
            'unit': data.get('unit', ''),
            'score': data.get('score'),
            'notes': data.get('notes', []),
            'ownerId': data.get('ownerId'),
            'partnerId': data.get('partnerId'),
            'expectedEoQScore': data.get('expectedEoQScore'),
            'scoreHistory': data.get('scoreHistory', []),
            'targetDate': data.get('targetDate'),
            'velocity': data.get('velocity'),
            'createdAt': now,
            'lastUpdatedAt': now,
            'lastModified': now,
        }
        result = db.key_results.insert_one(doc)
        doc['_id'] = result.inserted_id
        
        # Log creation to audit trail
        log_change('key_result', str(doc['_id']), user_id, 'created', reason='Key result created')
        
        return jsonify(_serialize_doc(doc)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/key-results/<kr_id>', methods=['PUT'])
@require_auth
def update_key_result(kr_id, user_id):
    """Update a key result (including progress: currentValue, score, notes)."""
    try:
        kid = _parse_object_id(kr_id)
        if kid is None:
            return jsonify({'error': 'Invalid key result ID'}), 400
        data = request.get_json() or {}
        db = get_db()
        existing = db.key_results.find_one({'_id': kid})
        if not existing:
            return jsonify({'error': 'Key result not found'}), 404
        now = datetime.utcnow()
        update = {'lastUpdatedAt': now, 'lastModified': now}
        for key in ('title', 'target', 'currentValue', 'unit', 'score', 'notes', 'ownerId', 'partnerId',
                    'expectedEoQScore', 'scoreHistory', 'targetDate', 'velocity'):
            if key in data:
                update[key] = data[key]
        # Handle targetDate conversion if provided as string
        if 'targetDate' in update and isinstance(update['targetDate'], str):
            try:
                update['targetDate'] = datetime.fromisoformat(update['targetDate'].replace('Z', '+00:00'))
            except:
                pass
        # Track changes for audit trail
        changes = []
        for key in update:
            if key not in ('lastUpdatedAt', 'lastModified'):
                old_value = existing.get(key)
                new_value = update[key]
                if old_value != new_value:
                    changes.append({
                        'field': key,
                        'oldValue': old_value,
                        'newValue': new_value
                    })
        
        db.key_results.update_one({'_id': kid}, {'$set': update})
        updated = db.key_results.find_one({'_id': kid})
        
        # Log update to audit trail
        if changes:
            log_change('key_result', kr_id, user_id, 'updated', changes=changes)
        
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/key-results/<kr_id>', methods=['DELETE'])
@require_auth
def delete_key_result(kr_id, user_id):
    """Delete a key result."""
    try:
        kid = _parse_object_id(kr_id)
        if kid is None:
            return jsonify({'error': 'Invalid key result ID'}), 400
        db = get_db()
        existing = db.key_results.find_one({'_id': kid})
        if not existing:
            return jsonify({'error': 'Key result not found'}), 404
        
        # Log deletion to audit trail
        log_change('key_result', kr_id, user_id, 'deleted', reason='Key result deleted')
        
        db.key_results.delete_one({'_id': kid})
        return jsonify({'message': 'Key result deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Workflow Endpoints ----

@bp.route('/objectives/<objective_id>/workflow/submit', methods=['POST'])
@require_auth
def submit_objective(objective_id, user_id):
    """Submit objective for approval."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        data = request.get_json() or {}
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        if objective.get('workflowState') != 'draft':
            return jsonify({'error': 'Only draft objectives can be submitted'}), 400
        
        now = datetime.utcnow()
        workflow_entry = {
            'state': 'submitted',
            'userId': user_id,
            'timestamp': now,
            'reason': data.get('reason', ''),
            'comment': data.get('comment', '')
        }
        
        workflow_history = objective.get('workflowHistory', [])
        workflow_history.append(workflow_entry)
        
        db.objectives.update_one(
            {'_id': oid},
            {'$set': {
                'workflowState': 'submitted',
                'workflowHistory': workflow_history,
                'updatedAt': now,
                'lastModified': now
            }}
        )
        
        # Log workflow transition to audit trail
        log_change(
            'objective',
            objective_id,
            user_id,
            'workflow_transition',
            changes=[{
                'field': 'workflowState',
                'oldValue': 'draft',
                'newValue': 'submitted'
            }],
            reason=data.get('reason', '')
        )
        
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/workflow/approve', methods=['POST'])
@require_auth
def approve_objective(objective_id, user_id):
    """Approve objective."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        data = request.get_json() or {}
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        current_state = objective.get('workflowState')
        if current_state not in ('submitted', 'under_review'):
            return jsonify({'error': 'Objective must be submitted or under review to approve'}), 400
        
        now = datetime.utcnow()
        workflow_entry = {
            'state': 'approved',
            'userId': user_id,
            'timestamp': now,
            'reason': data.get('reason', ''),
            'comment': data.get('comment', '')
        }
        
        workflow_history = objective.get('workflowHistory', [])
        workflow_history.append(workflow_entry)
        
        old_state = current_state
        db.objectives.update_one(
            {'_id': oid},
            {'$set': {
                'workflowState': 'approved',
                'workflowHistory': workflow_history,
                'updatedAt': now,
                'lastModified': now
            }}
        )
        
        # Log workflow transition to audit trail
        log_change(
            'objective',
            objective_id,
            user_id,
            'workflow_transition',
            changes=[{
                'field': 'workflowState',
                'oldValue': old_state,
                'newValue': 'approved'
            }],
            reason=data.get('reason', '')
        )
        
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/workflow/reject', methods=['POST'])
@require_auth
def reject_objective(objective_id, user_id):
    """Reject objective."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        data = request.get_json() or {}
        reason = data.get('reason')
        if not reason:
            return jsonify({'error': 'Reason is required for rejection'}), 400
        
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        current_state = objective.get('workflowState')
        if current_state not in ('submitted', 'under_review'):
            return jsonify({'error': 'Objective must be submitted or under review to reject'}), 400
        
        now = datetime.utcnow()
        workflow_entry = {
            'state': 'draft',
            'userId': user_id,
            'timestamp': now,
            'reason': reason,
            'comment': data.get('comment', '')
        }
        
        workflow_history = objective.get('workflowHistory', [])
        workflow_history.append(workflow_entry)
        
        old_state = current_state
        db.objectives.update_one(
            {'_id': oid},
            {'$set': {
                'workflowState': 'draft',
                'workflowHistory': workflow_history,
                'updatedAt': now,
                'lastModified': now
            }}
        )
        
        # Log workflow transition to audit trail
        log_change(
            'objective',
            objective_id,
            user_id,
            'workflow_transition',
            changes=[{
                'field': 'workflowState',
                'oldValue': old_state,
                'newValue': 'draft'
            }],
            reason=reason
        )
        
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/workflow/request-changes', methods=['POST'])
@require_auth
def request_changes(objective_id, user_id):
    """Request changes to objective."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        data = request.get_json() or {}
        reason = data.get('reason')
        if not reason:
            return jsonify({'error': 'Reason is required for requesting changes'}), 400
        
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        current_state = objective.get('workflowState')
        if current_state not in ('submitted', 'under_review'):
            return jsonify({'error': 'Objective must be submitted or under review to request changes'}), 400
        
        now = datetime.utcnow()
        workflow_entry = {
            'state': 'draft',
            'userId': user_id,
            'timestamp': now,
            'reason': reason,
            'comment': data.get('comment', '')
        }
        
        workflow_history = objective.get('workflowHistory', [])
        workflow_history.append(workflow_entry)
        
        old_state = current_state
        db.objectives.update_one(
            {'_id': oid},
            {'$set': {
                'workflowState': 'draft',
                'workflowHistory': workflow_history,
                'updatedAt': now,
                'lastModified': now
            }}
        )
        
        # Log workflow transition to audit trail
        log_change(
            'objective',
            objective_id,
            user_id,
            'workflow_transition',
            changes=[{
                'field': 'workflowState',
                'oldValue': old_state,
                'newValue': 'draft'
            }],
            reason=reason
        )
        
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/workflow/history', methods=['GET'])
@require_auth
def get_workflow_history(objective_id, user_id):
    """Get workflow transition history."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        history = objective.get('workflowHistory', [])
        # Serialize each entry so timestamp (datetime) is JSON-serializable
        serialized = []
        for entry in history:
            e = dict(entry)
            if isinstance(e.get('timestamp'), datetime):
                e['timestamp'] = e['timestamp'].isoformat()
            serialized.append(e)
        return jsonify(serialized), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/audit', methods=['GET'])
@require_auth
def get_objective_audit(objective_id, user_id):
    """Get audit trail for an objective."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        if not db.objectives.find_one({'_id': oid}):
            return jsonify({'error': 'Objective not found'}), 404
        trail = get_audit_trail('objective', objective_id)
        return jsonify(trail), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Dependency Endpoints ----

@bp.route('/objectives/<objective_id>/dependencies', methods=['GET'])
@require_auth
def get_dependencies(objective_id, user_id):
    """Get upstream and downstream dependencies for an objective."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        dependencies = objective.get('dependencies', [])
        
        # Separate upstream and downstream
        upstream = []
        downstream = []
        
        for dep in dependencies:
            dep_obj_id = dep.get('objectiveId')
            if dep_obj_id:
                dep_obj = db.objectives.find_one({'_id': dep_obj_id})
                if dep_obj:
                    dep_info = {
                        '_id': str(dep_obj_id),
                        'title': dep_obj.get('title'),
                        'ownerId': dep_obj.get('ownerId'),
                        'division': dep_obj.get('division'),
                        'workflowState': dep_obj.get('workflowState'),
                        'type': dep.get('type'),
                        'impact': dep.get('impact'),
                        'progress': dep.get('progress'),
                        'isAtRisk': dep.get('isAtRisk', False),
                    }
                    if dep.get('type') in ('upstream', 'depends_on', 'blocks'):
                        upstream.append(dep_info)
                    elif dep.get('type') in ('downstream', 'related'):
                        downstream.append(dep_info)
        
        return jsonify({
            'upstream': upstream,
            'downstream': downstream
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/dependencies', methods=['POST'])
@require_auth
def add_dependency(objective_id, user_id):
    """Add a dependency link to an objective."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        data = request.get_json() or {}
        dep_objective_id = data.get('objectiveId')
        dep_type = data.get('type', 'related')
        impact = data.get('impact', 'medium')
        
        if not dep_objective_id:
            return jsonify({'error': 'objectiveId is required'}), 400
        
        dep_oid = _parse_object_id(dep_objective_id)
        if dep_oid is None:
            return jsonify({'error': 'Invalid dependency objective ID'}), 400
        
        if dep_oid == oid:
            return jsonify({'error': 'Objective cannot depend on itself'}), 400
        
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        dep_obj = db.objectives.find_one({'_id': dep_oid})
        if not dep_obj:
            return jsonify({'error': 'Dependency objective not found'}), 404
        
        dependencies = objective.get('dependencies', [])
        
        # Check if dependency already exists
        for dep in dependencies:
            if dep.get('objectiveId') == dep_oid:
                return jsonify({'error': 'Dependency already exists'}), 400
        
        now = datetime.utcnow()
        new_dep = {
            'objectiveId': dep_oid,
            'type': dep_type,
            'impact': impact,
            'progress': data.get('progress', 0.0),
            'isAtRisk': data.get('isAtRisk', False),
            'linkedAt': now,
            'linkedBy': user_id
        }
        
        dependencies.append(new_dep)
        
        db.objectives.update_one(
            {'_id': oid},
            {'$set': {
                'dependencies': dependencies,
                'updatedAt': now,
                'lastModified': now
            }}
        )
        
        # Log to audit trail
        log_change(
            'objective',
            objective_id,
            user_id,
            'dependency_added',
            changes=[{
                'field': 'dependencies',
                'oldValue': len(dependencies) - 1,
                'newValue': len(dependencies)
            }],
            reason=f'Added {dep_type} dependency'
        )
        
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/dependencies/<dep_id>', methods=['PUT'])
@require_auth
def update_dependency(objective_id, user_id, dep_id):
    """Update a dependency (progress, risk flag, etc.)."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        dep_oid = _parse_object_id(dep_id)
        if dep_oid is None:
            return jsonify({'error': 'Invalid dependency ID'}), 400
        
        data = request.get_json() or {}
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        dependencies = objective.get('dependencies', [])
        dep_index = None
        for i, dep in enumerate(dependencies):
            if dep.get('objectiveId') == dep_oid:
                dep_index = i
                break
        
        if dep_index is None:
            return jsonify({'error': 'Dependency not found'}), 404
        
        old_dep = dependencies[dep_index].copy()
        
        # Update dependency fields
        if 'progress' in data:
            dependencies[dep_index]['progress'] = data['progress']
        if 'isAtRisk' in data:
            dependencies[dep_index]['isAtRisk'] = data['isAtRisk']
        if 'impact' in data:
            dependencies[dep_index]['impact'] = data['impact']
        if 'type' in data:
            dependencies[dep_index]['type'] = data['type']
        
        now = datetime.utcnow()
        db.objectives.update_one(
            {'_id': oid},
            {'$set': {
                'dependencies': dependencies,
                'updatedAt': now,
                'lastModified': now
            }}
        )
        
        # Log to audit trail
        changes = []
        for key in ('progress', 'isAtRisk', 'impact', 'type'):
            if key in data and old_dep.get(key) != data[key]:
                changes.append({
                    'field': f'dependency.{key}',
                    'oldValue': old_dep.get(key),
                    'newValue': data[key]
                })
        
        if changes:
            log_change('objective', objective_id, user_id, 'dependency_updated', changes=changes)
        
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/dependencies/<dep_id>', methods=['DELETE'])
@require_auth
def remove_dependency(objective_id, user_id, dep_id):
    """Remove a dependency link."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        dep_oid = _parse_object_id(dep_id)
        if dep_oid is None:
            return jsonify({'error': 'Invalid dependency ID'}), 400
        
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        dependencies = objective.get('dependencies', [])
        original_count = len(dependencies)
        dependencies = [dep for dep in dependencies if dep.get('objectiveId') != dep_oid]
        
        if len(dependencies) == original_count:
            return jsonify({'error': 'Dependency not found'}), 404
        
        now = datetime.utcnow()
        db.objectives.update_one(
            {'_id': oid},
            {'$set': {
                'dependencies': dependencies,
                'updatedAt': now,
                'lastModified': now
            }}
        )
        
        # Log to audit trail
        log_change(
            'objective',
            objective_id,
            user_id,
            'dependency_removed',
            reason='Dependency removed'
        )
        
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/search', methods=['GET'])
@require_auth
def search_objectives(user_id):
    """Search objectives for linking as dependencies."""
    try:
        query = request.args.get('q', '')
        department = request.args.get('department')
        level = request.args.get('level')
        fiscal_year = request.args.get('fiscalYear', type=int)
        
        db = get_db()
        search_filter = {}
        
        if query:
            search_filter['$or'] = [
                {'title': {'$regex': query, '$options': 'i'}},
                {'description': {'$regex': query, '$options': 'i'}}
            ]
        
        if department:
            search_filter['division'] = department
        
        if level:
            search_filter['level'] = level
        
        if fiscal_year:
            search_filter['fiscalYear'] = fiscal_year
        
        cursor = db.objectives.find(search_filter).limit(50)
        results = []
        for obj in cursor:
            results.append({
                '_id': str(obj['_id']),
                'title': obj.get('title'),
                'description': obj.get('description', ''),
                'ownerId': obj.get('ownerId'),
                'division': obj.get('division'),
                'level': obj.get('level'),
                'fiscalYear': obj.get('fiscalYear'),
                'workflowState': obj.get('workflowState', 'active')
            })
        
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Pinned Fields Endpoints ----

@bp.route('/objectives/<objective_id>/pinned-fields', methods=['PUT'])
@require_auth
def update_pinned_fields(objective_id, user_id):
    """Update pinned fields for an objective."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        data = request.get_json() or {}
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        pinned_fields = objective.get('pinnedFields', {})
        old_pinned_fields = pinned_fields.copy()
        
        # Update pinned fields
        allowed_fields = ['theme', 'roadmap', 'customerSegments', 'value', 'documents', 'overallNecessity', 'deliveryProgress']
        for field in allowed_fields:
            if field in data:
                pinned_fields[field] = data[field]
        
        now = datetime.utcnow()
        db.objectives.update_one(
            {'_id': oid},
            {'$set': {
                'pinnedFields': pinned_fields,
                'updatedAt': now,
                'lastModified': now
            }}
        )
        
        # Log to audit trail
        changes = []
        for field in allowed_fields:
            if field in data and old_pinned_fields.get(field) != data[field]:
                changes.append({
                    'field': f'pinnedFields.{field}',
                    'oldValue': old_pinned_fields.get(field),
                    'newValue': data[field]
                })
        
        if changes:
            log_change('objective', objective_id, user_id, 'pinned_fields_updated', changes=changes)
        
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Permissions Endpoints ----

@bp.route('/objectives/<objective_id>/permissions', methods=['GET'])
@require_auth
def get_permissions(objective_id, user_id):
    """Get user's permission level for an objective."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        # Get user role
        user_role_doc = db.user_roles.find_one({'userId': user_id})
        user_role = user_role_doc.get('role', 'standard') if user_role_doc else 'standard'
        
        permissions = objective.get('permissions', {})
        owner_id = objective.get('ownerId')
        
        # Determine permission level
        permission_level = 'viewOnly'
        
        # Check for full control
        if user_role == 'admin' or user_id in permissions.get('fullControl', []):
            permission_level = 'fullControl'
        elif user_id == owner_id and user_role == 'leader':
            permission_level = 'fullControl'
        # Check for edit objective
        elif user_id == owner_id or user_id in permissions.get('editObjective', []):
            permission_level = 'editObjective'
        elif user_role == 'leader' and user_role_doc and user_role_doc.get('department') == objective.get('division'):
            permission_level = 'editObjective'
        # Check for edit key results
        elif user_id in permissions.get('editKeyResults', []):
            permission_level = 'editKeyResults'
        else:
            # Check if user owns any key results
            krs = list(db.key_results.find({'objectiveId': oid, 'ownerId': user_id}))
            if krs:
                permission_level = 'editKeyResults'
        
        return jsonify({
            'permissionLevel': permission_level,
            'canView': True,
            'canEditKR': permission_level in ('editKeyResults', 'editObjective', 'fullControl'),
            'canEditObjective': permission_level in ('editObjective', 'fullControl'),
            'canDelete': permission_level == 'fullControl',
            'canChangeWorkflow': permission_level in ('editObjective', 'fullControl')
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/permissions', methods=['POST'])
@require_auth
def update_permissions(objective_id, user_id):
    """Update permissions for an objective (admin only)."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        data = request.get_json() or {}
        db = get_db()
        
        # Check if user is admin
        user_role_doc = db.user_roles.find_one({'userId': user_id})
        user_role = user_role_doc.get('role', 'standard') if user_role_doc else 'standard'
        if user_role != 'admin':
            return jsonify({'error': 'Only admins can update permissions'}), 403
        
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        now = datetime.utcnow()
        permissions = data.get('permissions', {})
        
        db.objectives.update_one(
            {'_id': oid},
            {'$set': {
                'permissions': permissions,
                'updatedAt': now,
                'lastModified': now
            }}
        )
        
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
