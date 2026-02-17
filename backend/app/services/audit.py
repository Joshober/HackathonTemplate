from datetime import datetime
from typing import List, Dict, Any, Optional
from app.db.mongodb import get_db
from bson import ObjectId


def log_change(
    entity_type: str,
    entity_id: str,
    user_id: str,
    action: str,
    changes: Optional[List[Dict[str, Any]]] = None,
    reason: Optional[str] = None
) -> None:
    """
    Log a change to the audit trail.
    
    Args:
        entity_type: 'objective' | 'key_result'
        entity_id: ID of the entity
        user_id: ID of the user making the change
        action: Action type (e.g., 'created', 'updated', 'workflow_transition')
        changes: List of field changes [{ "field": str, "oldValue": any, "newValue": any }]
        reason: Optional reason for the change
    """
    db = get_db()
    
    # Convert entity_id to ObjectId if it's a string
    if isinstance(entity_id, str):
        try:
            entity_oid = ObjectId(entity_id)
        except:
            entity_oid = entity_id
    else:
        entity_oid = entity_id
    
    audit_entry = {
        'entityType': entity_type,
        'entityId': entity_oid,
        'action': action,
        'userId': user_id,
        'timestamp': datetime.utcnow(),
        'changes': changes or [],
        'reason': reason or ''
    }
    
    db.audit_logs.insert_one(audit_entry)


def get_audit_trail(entity_type: str, entity_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve the complete audit trail for an entity.
    
    Returns:
        List of audit log entries
    """
    db = get_db()
    
    # Convert entity_id to ObjectId if it's a string
    if isinstance(entity_id, str):
        try:
            entity_oid = ObjectId(entity_id)
        except:
            entity_oid = entity_id
    else:
        entity_oid = entity_id
    
    cursor = db.audit_logs.find({
        'entityType': entity_type,
        'entityId': entity_oid
    }).sort('timestamp', -1)
    
    logs = []
    for doc in cursor:
        log = dict(doc)
        log['_id'] = str(log['_id'])
        log['entityId'] = str(log['entityId'])
        if isinstance(log.get('timestamp'), datetime):
            log['timestamp'] = log['timestamp'].isoformat()
        logs.append(log)
    
    return logs
