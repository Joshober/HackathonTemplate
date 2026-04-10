from flask import Flask, jsonify
from flask_cors import CORS
from app.db.mongodb import init_db
from app.config.cloudinary_config import init_cloudinary
import os

def create_app():
    app = Flask(__name__)

    # Library count first so it's always available
    try:
        from app.routes.library import _fetch_count, LIBRARY_FALLBACK_COUNT
        def _library_count():
            try:
                return jsonify({'count': _fetch_count()})
            except Exception:
                return jsonify({'count': LIBRARY_FALLBACK_COUNT})
        app.add_url_rule('/api/librarycount', view_func=_library_count, methods=['GET'])
    except Exception as e:
        # If import fails, add a stub that returns 14
        app.add_url_rule('/api/librarycount', view_func=lambda: jsonify({'count': 14}), methods=['GET'])
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB (video roast sends base64 in JSON body)
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours
    
    # CORS configuration
    cors_origins = [o.strip() for o in os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',') if o.strip()]
    CORS(app, origins=cors_origins, supports_credentials=True)
    
    # Initialize MongoDB (non-blocking - will connect on first request)
    try:
        init_db()
    except Exception as e:
        print(f"Warning: MongoDB connection failed: {e}")
        print("Backend will start but database operations will fail until MongoDB is available.")
    
    # Initialize Cloudinary
    init_cloudinary()
    
    # Register blueprints (prioritize JP-Branch, add pipeline APIs)
    from app.routes import items, health, profiles, chat, auth_backend, voice, transcription, speech, multiverse, email, tickets, pose_sessions, admin
    app.register_blueprint(items.bp, url_prefix='/api')
    app.register_blueprint(admin.bp, url_prefix='/api')
    app.register_blueprint(pose_sessions.bp, url_prefix='/api')
    app.register_blueprint(tickets.bp, url_prefix='/api')
    app.register_blueprint(profiles.bp, url_prefix='/api')
    app.register_blueprint(chat.bp, url_prefix='/api')
    app.register_blueprint(voice.bp, url_prefix='/api')
    app.register_blueprint(auth_backend.bp, url_prefix='/api')
    app.register_blueprint(transcription.bp, url_prefix='/api')
    app.register_blueprint(speech.bp, url_prefix='/api')
    app.register_blueprint(multiverse.bp, url_prefix='/api/multiverse')
    app.register_blueprint(email.bp, url_prefix='/api')
    app.register_blueprint(health.bp)
    
    return app
