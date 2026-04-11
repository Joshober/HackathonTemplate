from flask import Blueprint, jsonify
from app.db.mongodb import get_db
from app.db import mongodb

bp = Blueprint('health', __name__)

@bp.route('/healthz', methods=['GET'])
def liveness():
    """Liveness for Docker/K8s (no DB required)."""
    return jsonify({'status': 'ok'}), 200

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        db = get_db()
        # Test MongoDB connection using the client
        if mongodb.client:
            mongodb.client.admin.command('ping')
            return jsonify({
                'status': 'healthy',
                'database': 'connected'
            }), 200
        else:
            return jsonify({
                'status': 'unhealthy',
                'database': 'disconnected',
                'error': 'MongoDB client not initialized'
            }), 503
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'database': 'disconnected',
            'error': str(e)
        }), 503
