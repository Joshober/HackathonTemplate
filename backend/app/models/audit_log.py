from datetime import datetime
from typing import Optional, Dict, Any, List


class AuditLog:
    def __init__(
        self,
        entity_type: str,
        entity_id: str,
        action: str,
        user_id: str,
        _id: Optional[str] = None,
        changes: Optional[List[Dict[str, Any]]] = None,
        reason: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ):
        self._id = _id
        self.entity_type = entity_type  # 'objective' | 'key_result'
        self.entity_id = entity_id
        self.action = action  # 'created', 'updated', 'workflow_transition', etc.
        self.user_id = user_id
        self.changes = changes or []  # [{ "field": str, "oldValue": any, "newValue": any }]
        self.reason = reason or ''
        self.timestamp = timestamp or datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'entityType': self.entity_type,
            'entityId': str(self.entity_id),
            'action': self.action,
            'userId': self.user_id,
            'changes': self.changes,
            'reason': self.reason,
            'timestamp': self.timestamp.isoformat() if isinstance(self.timestamp, datetime) else self.timestamp,
        }
        if self._id:
            result['_id'] = str(self._id)
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'AuditLog':
        log = AuditLog(
            entity_type=data.get('entityType', data.get('entity_type', '')),
            entity_id=str(data.get('entityId', data.get('entity_id', ''))),
            action=data.get('action', ''),
            user_id=data.get('userId', data.get('user_id', '')),
            _id=str(data['_id']) if '_id' in data else None,
            changes=data.get('changes', []),
            reason=data.get('reason', ''),
        )
        if 'timestamp' in data:
            val = data['timestamp']
            log.timestamp = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        return log
