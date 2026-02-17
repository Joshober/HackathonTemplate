from typing import Dict, Any, Optional
from app.db.mongodb import get_db


def evaluate_permission(user_id: str, objective: Dict[str, Any], action: str) -> str:
    """
    Evaluate user's permission level for an objective.
    Returns: 'viewOnly' | 'editKeyResults' | 'editObjective' | 'fullControl'
    """
    db = get_db()
    
    # Get user role
    user_role_doc = db.user_roles.find_one({'userId': user_id})
    user_role = user_role_doc.get('role', 'standard') if user_role_doc else 'standard'
    user_department = user_role_doc.get('department') if user_role_doc else None
    
    permissions = objective.get('permissions', {})
    owner_id = objective.get('ownerId')
    objective_department = objective.get('division')
    
    # Full Control
    if user_role == 'admin':
        return 'fullControl'
    if user_id in permissions.get('fullControl', []):
        return 'fullControl'
    if user_id == owner_id and user_role == 'leader':
        return 'fullControl'
    
    # Edit Objective
    if user_id == owner_id:
        return 'editObjective'
    if user_id in permissions.get('editObjective', []):
        return 'editObjective'
    if user_role == 'leader' and user_department == objective_department:
        return 'editObjective'
    
    # Edit Key Results
    if user_id in permissions.get('editKeyResults', []):
        return 'editKeyResults'
    
    # Check if user owns any key results
    from bson import ObjectId
    objective_id = objective.get('_id')
    if isinstance(objective_id, str):
        objective_id = ObjectId(objective_id)
    elif not isinstance(objective_id, ObjectId):
        objective_id = objective_id
    
    krs = list(db.key_results.find({'objectiveId': objective_id, 'ownerId': user_id}))
    if krs:
        return 'editKeyResults'
    
    # Default: View Only
    return 'viewOnly'


def can_perform_action(user_id: str, objective: Dict[str, Any], action: str) -> bool:
    """
    Check if user can perform a specific action.
    Actions: 'view', 'editKR', 'editObjective', 'delete', 'changeWorkflow'
    """
    permission_level = evaluate_permission(user_id, objective, action)
    
    action_map = {
        'view': ['viewOnly', 'editKeyResults', 'editObjective', 'fullControl'],
        'editKR': ['editKeyResults', 'editObjective', 'fullControl'],
        'editObjective': ['editObjective', 'fullControl'],
        'delete': ['fullControl'],
        'changeWorkflow': ['editObjective', 'fullControl'],
    }
    
    allowed_levels = action_map.get(action, [])
    return permission_level in allowed_levels
