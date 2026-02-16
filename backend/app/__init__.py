from flask import Flask
from flask_cors import CORS
from app.db.mongodb import init_db
from app.config.cloudinary_config import init_cloudinary
import os

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours
    
    # CORS configuration
    cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
    CORS(app, origins=cors_origins, supports_credentials=True)
    
    # Initialize MongoDB (non-blocking - will connect on first request)
    try:
        init_db()
    except Exception as e:
        print(f"Warning: MongoDB connection failed: {e}")
        print("Backend will start but database operations will fail until MongoDB is available.")
    
    # Initialize Cloudinary
    init_cloudinary()
    
    # Register blueprints
    from app.routes import items, health, profiles, chat, auth_backend
    app.register_blueprint(items.bp, url_prefix='/api')
    app.register_blueprint(profiles.bp, url_prefix='/api')
    app.register_blueprint(chat.bp, url_prefix='/api')
    app.register_blueprint(auth_backend.bp, url_prefix='/api')
    app.register_blueprint(health.bp)
    
    return app
