from datetime import datetime
from typing import Optional, Dict, Any

ROLE_ADMIN = 'admin'
ROLE_LEADER = 'leader'
ROLE_STANDARD = 'standard'
ROLE_VIEW_ONLY = 'view_only'


class UserRole:
    def __init__(
        self,
        user_id: str,
        role: str,
        _id: Optional[str] = None,
        department: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        self._id = _id
        self.user_id = user_id  # Auth0 sub
        self.role = role  # 'admin' | 'leader' | 'standard' | 'view_only'
        self.department = department
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'userId': self.user_id,
            'role': self.role,
            'department': self.department,
            'createdAt': self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            'updatedAt': self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else self.updated_at,
        }
        if self._id:
            result['_id'] = str(self._id)
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'UserRole':
        role = UserRole(
            user_id=data.get('userId', data.get('user_id', '')),
            role=data.get('role', ROLE_STANDARD),
            _id=str(data['_id']) if '_id' in data else None,
            department=data.get('department'),
        )
        if 'createdAt' in data:
            val = data['createdAt']
            role.created_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        elif 'created_at' in data:
            val = data['created_at']
            role.created_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        if 'updatedAt' in data:
            val = data['updatedAt']
            role.updated_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        elif 'updated_at' in data:
            val = data['updated_at']
            role.updated_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        return role
