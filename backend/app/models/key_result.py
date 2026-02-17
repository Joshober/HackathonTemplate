from datetime import datetime
from typing import Optional, Dict, Any, List


class KeyResult:
    def __init__(
        self,
        objective_id: str,
        title: str,
        _id: Optional[str] = None,
        target: Optional[str] = None,
        current_value: Optional[str] = None,
        unit: Optional[str] = None,
        score: Optional[float] = None,
        notes: Optional[List[Dict[str, Any]]] = None,
        created_at: Optional[datetime] = None,
        last_updated_at: Optional[datetime] = None,
        owner_id: Optional[str] = None,
        partner_id: Optional[str] = None,
        expected_eoq_score: Optional[float] = None,
        score_history: Optional[List[Dict[str, Any]]] = None,
        target_date: Optional[datetime] = None,
        velocity: Optional[float] = None,
        last_modified: Optional[datetime] = None,
    ):
        self._id = _id
        self.objective_id = objective_id
        self.title = title
        self.target = target
        self.current_value = current_value
        self.unit = unit or ''
        self.score = score  # 0.0-1.0 (changed from 0-100)
        self.notes = notes or []  # [{ "text": "...", "date": "YYYY-MM-DD", "userId": "...", "createdAt": "..." }]
        self.owner_id = owner_id
        self.partner_id = partner_id
        self.expected_eoq_score = expected_eoq_score  # 0.0-1.0
        self.score_history = score_history or []  # [{ "score": float, "timestamp": datetime, "userId": str, "note": str }]
        self.target_date = target_date
        self.velocity = velocity  # calculated field
        self.last_modified = last_modified or datetime.utcnow()
        self.created_at = created_at or datetime.utcnow()
        self.last_updated_at = last_updated_at or datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'objectiveId': self.objective_id,
            'title': self.title,
            'target': self.target,
            'currentValue': self.current_value,
            'unit': self.unit,
            'score': self.score,
            'notes': self.notes,
            'ownerId': self.owner_id,
            'partnerId': self.partner_id,
            'expectedEoQScore': self.expected_eoq_score,
            'scoreHistory': self.score_history,
            'targetDate': self.target_date.isoformat() if isinstance(self.target_date, datetime) else self.target_date,
            'velocity': self.velocity,
            'createdAt': self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            'lastUpdatedAt': self.last_updated_at.isoformat() if isinstance(self.last_updated_at, datetime) else self.last_updated_at,
            'lastModified': self.last_modified.isoformat() if isinstance(self.last_modified, datetime) else self.last_modified,
        }
        if self._id:
            result['_id'] = str(self._id)
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'KeyResult':
        kr = KeyResult(
            objective_id=data.get('objectiveId', data.get('objective_id', '')),
            title=data['title'],
            _id=str(data['_id']) if '_id' in data else None,
            target=data.get('target'),
            current_value=data.get('currentValue', data.get('current_value')),
            unit=data.get('unit', ''),
            score=data.get('score'),
            notes=data.get('notes', []),
            owner_id=data.get('ownerId', data.get('owner_id')),
            partner_id=data.get('partnerId', data.get('partner_id')),
            expected_eoq_score=data.get('expectedEoQScore', data.get('expected_eoq_score')),
            score_history=data.get('scoreHistory', data.get('score_history', [])),
            velocity=data.get('velocity'),
        )
        if 'createdAt' in data:
            val = data['createdAt']
            kr.created_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        if 'lastUpdatedAt' in data:
            val = data['lastUpdatedAt']
            kr.last_updated_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        if 'targetDate' in data:
            val = data['targetDate']
            kr.target_date = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) and val else None
        if 'lastModified' in data:
            val = data['lastModified']
            kr.last_modified = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        elif 'last_modified' in data:
            val = data['last_modified']
            kr.last_modified = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        return kr
