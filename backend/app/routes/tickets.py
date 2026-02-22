"""Support tickets API: create and list (MongoDB)."""
from datetime import datetime
from flask import Blueprint, request, jsonify
from app.db.mongodb import get_db

bp = Blueprint('tickets', __name__)
COLLECTION = 'tickets'


@bp.route('/tickets', methods=['GET'])
def list_tickets():
    """List tickets, newest first. Query: limit (default 50)."""
    try:
        db = get_db()
        col = db[COLLECTION]
        limit = min(int(request.args.get('limit', 50)), 100)
        cursor = col.find().sort('createdAt', -1).limit(limit)
        tickets = []
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            if isinstance(doc.get('createdAt'), datetime):
                doc['createdAt'] = doc['createdAt'].isoformat()
            tickets.append(doc)
        return jsonify({'tickets': tickets}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/tickets', methods=['POST'])
def create_ticket():
    """
    Create a support ticket.
    Body: { "title": "...", "description": "...", "user_email": "...", "conversation_summary": "..." }.
    title and description required.
    """
    try:
        data = request.get_json() or {}
        title = (data.get('title') or '').strip()
        description = (data.get('description') or '').strip()
        if not title:
            return jsonify({'error': 'Missing or empty "title".'}), 400
        if not description:
            return jsonify({'error': 'Missing or empty "description".'}), 400
        user_email = (data.get('user_email') or '').strip() or None
        conversation_summary = (data.get('conversation_summary') or '').strip() or None
        status = (data.get('status') or 'open').strip() or 'open'

        db = get_db()
        col = db[COLLECTION]
        now = datetime.utcnow()
        doc = {
            'title': title,
            'description': description,
            'status': status,
            'createdAt': now,
            'updatedAt': now,
        }
        if user_email:
            doc['user_email'] = user_email
        if conversation_summary:
            doc['conversation_summary'] = conversation_summary

        result = col.insert_one(doc)
        doc['_id'] = str(result.inserted_id)
        doc['createdAt'] = now.isoformat()
        doc['updatedAt'] = now.isoformat()
        return jsonify(doc), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
