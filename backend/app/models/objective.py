from datetime import datetime
from typing import Optional, Dict, Any, List

LEVEL_STRATEGIC = 'strategic'
LEVEL_FUNCTIONAL = 'functional'
LEVEL_TACTICAL = 'tactical'
TIMELINE_ANNUAL = 'annual'
TIMELINE_QUARTERLY = 'quarterly'

WORKFLOW_DRAFT = 'draft'
WORKFLOW_SUBMITTED = 'submitted'
WORKFLOW_UNDER_REVIEW = 'under_review'
WORKFLOW_APPROVED = 'approved'
WORKFLOW_ACTIVE = 'active'
WORKFLOW_COMPLETED = 'completed'
WORKFLOW_ARCHIVED = 'archived'


class Objective:
    def __init__(
        self,
        title: str,
        owner_id: str,
        level: str,
        timeline: str,
        fiscal_year: int,
        _id: Optional[str] = None,
        description: Optional[str] = None,
        parent_objective_id: Optional[str] = None,
        division: Optional[str] = None,
        quarter: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        workflow_state: Optional[str] = None,
        workflow_history: Optional[List[Dict[str, Any]]] = None,
        permissions: Optional[Dict[str, List[str]]] = None,
        risk_flag: Optional[bool] = None,
        milestones: Optional[List[Dict[str, Any]]] = None,
        dependencies: Optional[List[Dict[str, Any]]] = None,
        files: Optional[List[Dict[str, Any]]] = None,
        pinned_fields: Optional[Dict[str, Any]] = None,
        last_modified: Optional[datetime] = None,
    ):
        self._id = _id
        self.title = title
        self.description = description or ''
        self.owner_id = owner_id
        self.level = level  # strategic | functional | tactical
        self.timeline = timeline  # annual | quarterly
        self.fiscal_year = fiscal_year
        self.quarter = quarter  # Q1, Q2, Q3, Q4 when timeline is quarterly
        self.parent_objective_id = parent_objective_id
        self.division = division
        self.workflow_state = workflow_state or WORKFLOW_ACTIVE
        self.workflow_history = workflow_history or []
        self.permissions = permissions or {
            'viewOnly': [],
            'editKeyResults': [],
            'editObjective': [],
            'fullControl': []
        }
        self.risk_flag = risk_flag or False
        self.milestones = milestones or []
        self.dependencies = dependencies or []
        self.files = files or []
        self.pinned_fields = pinned_fields or {}
        self.last_modified = last_modified or datetime.utcnow()
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'title': self.title,
            'description': self.description,
            'ownerId': self.owner_id,
            'level': self.level,
            'timeline': self.timeline,
            'fiscalYear': self.fiscal_year,
            'workflowState': self.workflow_state,
            'workflowHistory': self.workflow_history,
            'permissions': self.permissions,
            'riskFlag': self.risk_flag,
            'milestones': self.milestones,
            'dependencies': self.dependencies,
            'files': self.files,
            'pinnedFields': self.pinned_fields,
            'createdAt': self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            'updatedAt': self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else self.updated_at,
            'lastModified': self.last_modified.isoformat() if isinstance(self.last_modified, datetime) else self.last_modified,
        }
        if self._id:
            result['_id'] = str(self._id)
        if self.parent_objective_id is not None:
            result['parentObjectiveId'] = self.parent_objective_id
        if self.division is not None:
            result['division'] = self.division
        if self.quarter is not None:
            result['quarter'] = self.quarter
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Objective':
        obj = Objective(
            title=data['title'],
            owner_id=data.get('ownerId', data.get('owner_id', '')),
            level=data['level'],
            timeline=data['timeline'],
            fiscal_year=data.get('fiscalYear', data.get('fiscal_year', 0)),
            _id=str(data['_id']) if '_id' in data else None,
            description=data.get('description', ''),
            parent_objective_id=data.get('parentObjectiveId') or data.get('parent_objective_id'),
            division=data.get('division'),
            quarter=data.get('quarter'),
            workflow_state=data.get('workflowState', WORKFLOW_ACTIVE),
            workflow_history=data.get('workflowHistory', []),
            permissions=data.get('permissions', {
                'viewOnly': [],
                'editKeyResults': [],
                'editObjective': [],
                'fullControl': []
            }),
            risk_flag=data.get('riskFlag', False),
            milestones=data.get('milestones', []),
            dependencies=data.get('dependencies', []),
            files=data.get('files', []),
            pinned_fields=data.get('pinnedFields', {}),
        )
        if 'createdAt' in data:
            val = data['createdAt']
            obj.created_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        elif 'created_at' in data:
            val = data['created_at']
            obj.created_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        if 'updatedAt' in data:
            val = data['updatedAt']
            obj.updated_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        elif 'updated_at' in data:
            val = data['updated_at']
            obj.updated_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        if 'lastModified' in data:
            val = data['lastModified']
            obj.last_modified = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        elif 'last_modified' in data:
            val = data['last_modified']
            obj.last_modified = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        return obj
