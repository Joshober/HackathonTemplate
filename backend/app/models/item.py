from datetime import datetime
from typing import Optional, Dict, Any
from bson import ObjectId

class Item:
    def __init__(self, title: str, description: str, userId: str, 
                 _id: Optional[str] = None, 
                 createdAt: Optional[datetime] = None,
                 updatedAt: Optional[datetime] = None,
                 imageUrls: Optional[list] = None,
                 videoUrls: Optional[list] = None):
        self._id = _id
        self.userId = userId
        self.title = title
        self.description = description
        self.imageUrls = imageUrls or []
        self.videoUrls = videoUrls or []
        self.createdAt = createdAt or datetime.utcnow()
        self.updatedAt = updatedAt or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert Item to dictionary for JSON serialization"""
        result = {
            'userId': self.userId,
            'title': self.title,
            'description': self.description,
            'imageUrls': self.imageUrls,
            'videoUrls': self.videoUrls,
            'createdAt': self.createdAt.isoformat() if isinstance(self.createdAt, datetime) else self.createdAt,
            'updatedAt': self.updatedAt.isoformat() if isinstance(self.updatedAt, datetime) else self.updatedAt,
        }
        if self._id:
            result['_id'] = str(self._id)
        return result
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Item':
        """Create Item from dictionary"""
        item = Item(
            title=data['title'],
            description=data['description'],
            userId=data['userId'],
            _id=str(data['_id']) if '_id' in data else None,
            imageUrls=data.get('imageUrls', []),
            videoUrls=data.get('videoUrls', [])
        )
        
        if 'createdAt' in data:
            if isinstance(data['createdAt'], datetime):
                item.createdAt = data['createdAt']
            else:
                item.createdAt = datetime.fromisoformat(data['createdAt'].replace('Z', '+00:00'))
        
        if 'updatedAt' in data:
            if isinstance(data['updatedAt'], datetime):
                item.updatedAt = data['updatedAt']
            else:
                item.updatedAt = datetime.fromisoformat(data['updatedAt'].replace('Z', '+00:00'))
        
        return item
