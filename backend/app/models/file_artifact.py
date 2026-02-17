from datetime import datetime
from typing import Optional, Dict, Any


class FileArtifact:
    def __init__(
        self,
        name: str,
        url: str,
        size: int,
        mime_type: str,
        uploaded_by: str,
        objective_id: str,
        _id: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        associated_with: Optional[str] = None,
        key_result_id: Optional[str] = None,
        uploaded_at: Optional[datetime] = None,
        deleted_at: Optional[datetime] = None,
        deleted_by: Optional[str] = None,
    ):
        self._id = _id
        self.name = name
        self.url = url  # Cloudinary URL
        self.size = size  # bytes
        self.mime_type = mime_type
        self.thumbnail_url = thumbnail_url
        self.uploaded_by = uploaded_by  # userId
        self.uploaded_at = uploaded_at or datetime.utcnow()
        self.associated_with = associated_with or 'objective'  # 'objective' | 'key_result'
        self.objective_id = objective_id
        self.key_result_id = key_result_id  # if associated_with === 'key_result'
        self.deleted_at = deleted_at  # soft delete
        self.deleted_by = deleted_by  # userId who deleted

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'name': self.name,
            'url': self.url,
            'size': self.size,
            'mimeType': self.mime_type,
            'thumbnailUrl': self.thumbnail_url,
            'uploadedBy': self.uploaded_by,
            'uploadedAt': self.uploaded_at.isoformat() if isinstance(self.uploaded_at, datetime) else self.uploaded_at,
            'associatedWith': self.associated_with,
            'objectiveId': str(self.objective_id),
            'keyResultId': str(self.key_result_id) if self.key_result_id else None,
            'deletedAt': self.deleted_at.isoformat() if isinstance(self.deleted_at, datetime) else self.deleted_at,
            'deletedBy': self.deleted_by,
        }
        if self._id:
            result['_id'] = str(self._id)
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'FileArtifact':
        artifact = FileArtifact(
            name=data.get('name', ''),
            url=data.get('url', ''),
            size=data.get('size', 0),
            mime_type=data.get('mimeType', data.get('mime_type', '')),
            uploaded_by=data.get('uploadedBy', data.get('uploaded_by', '')),
            objective_id=str(data.get('objectiveId', data.get('objective_id', ''))),
            _id=str(data['_id']) if '_id' in data else None,
            thumbnail_url=data.get('thumbnailUrl', data.get('thumbnail_url')),
            associated_with=data.get('associatedWith', data.get('associated_with', 'objective')),
            key_result_id=str(data.get('keyResultId', data.get('key_result_id'))) if data.get('keyResultId') or data.get('key_result_id') else None,
        )
        if 'uploadedAt' in data:
            val = data['uploadedAt']
            artifact.uploaded_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        if 'deletedAt' in data:
            val = data['deletedAt']
            artifact.deleted_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) and val else None
        artifact.deleted_by = data.get('deletedBy', data.get('deleted_by'))
        return artifact
