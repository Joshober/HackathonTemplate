from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from app.db.mongodb import get_db
from app.models.profile import Profile
from app.routes.auth_backend import require_auth, get_user_info_from_request as get_user_info_from_token
from app.config.cloudinary_config import upload_image, delete_image
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
import os

bp = Blueprint('profiles', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@bp.route('/profiles', methods=['GET'])
@require_auth
def get_profile(user_id):
    """Get profile for the authenticated user, auto-create if doesn't exist"""
    try:
        db = get_db()
        profiles_collection = db.profiles
        
        # Find profile for this user
        profile = profiles_collection.find_one({'userId': user_id})
        
        # If profile doesn't exist, auto-create it from Auth0 user data
        if not profile:
            now = datetime.utcnow()
            display_name = 'User'
            profile_image_url = None
            
            # Try to get user info from token
            try:
                user_info = get_user_info_from_token()
                display_name = (
                    user_info.get('name') or 
                    user_info.get('nickname') or 
                    (user_info.get('email', '').split('@')[0] if user_info.get('email') else None) or
                    'User'
                )
                profile_image_url = user_info.get('picture') or None
            except Exception as e:
                # If we can't get user info, use defaults
                print(f"Warning: Could not get user info from token: {str(e)}")
                # Extract username from user_id if it's in email format
                if '@' in user_id:
                    display_name = user_id.split('@')[0]
                elif '|' in user_id:
                    # Auth0 user ID format: auth0|123456 or google-oauth2|123456
                    display_name = user_id.split('|')[-1][:10]  # Use last part of ID
            
            # Create profile with available info
            new_profile = {
                'userId': user_id,
                'displayName': display_name,
                'bio': '',  # Empty bio, user can fill it later
                'profileImageUrl': profile_image_url,
                'createdAt': now,
                'updatedAt': now
            }
            
            try:
                result = profiles_collection.insert_one(new_profile)
                profile = profiles_collection.find_one({'_id': result.inserted_id})
            except Exception as e:
                return jsonify({'error': f'Failed to create profile: {str(e)}'}), 500
        
        # Convert ObjectId to string and format dates
        profile['_id'] = str(profile['_id'])
        if 'createdAt' in profile and isinstance(profile['createdAt'], datetime):
            profile['createdAt'] = profile['createdAt'].isoformat()
        if 'updatedAt' in profile and isinstance(profile['updatedAt'], datetime):
            profile['updatedAt'] = profile['updatedAt'].isoformat()
        
        return jsonify(profile), 200
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_profile: {str(e)}")
        print(error_details)
        return jsonify({'error': str(e), 'details': error_details if os.getenv('FLASK_ENV') == 'development' else None}), 500

@bp.route('/profiles', methods=['POST'])
@require_auth
def create_profile(user_id):
    """Create a new profile"""
    try:
        db = get_db()
        profiles_collection = db.profiles
        
        # Check if profile already exists
        existing = profiles_collection.find_one({'userId': user_id})
        if existing:
            return jsonify({'error': 'Profile already exists. Use PUT to update.'}), 400
        
        data = request.form
        display_name = data.get('displayName')
        
        if not display_name:
            return jsonify({'error': 'Display name is required'}), 400
        
        bio = data.get('bio', '')
        profile_image_url = None
        
        # Handle image upload
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename and allowed_file(file.filename):
                try:
                    profile_image_url = upload_image(file, folder='profiles')
                except Exception as e:
                    return jsonify({'error': str(e)}), 500
        
        # Create new profile
        now = datetime.utcnow()
        new_profile = {
            'userId': user_id,
            'displayName': display_name,
            'bio': bio,
            'profileImageUrl': profile_image_url,
            'createdAt': now,
            'updatedAt': now
        }
        
        result = profiles_collection.insert_one(new_profile)
        new_profile['_id'] = str(result.inserted_id)
        new_profile['createdAt'] = new_profile['createdAt'].isoformat()
        new_profile['updatedAt'] = new_profile['updatedAt'].isoformat()
        
        return jsonify(new_profile), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/profiles', methods=['PUT'])
@require_auth
def update_profile(user_id):
    """Update an existing profile"""
    try:
        db = get_db()
        profiles_collection = db.profiles
        
        # Find existing profile
        existing_profile = profiles_collection.find_one({'userId': user_id})
        if not existing_profile:
            return jsonify({'error': 'Profile not found'}), 404
        
        data = request.form
        update_data = {'updatedAt': datetime.utcnow()}
        
        if 'displayName' in data:
            update_data['displayName'] = data['displayName']
        if 'bio' in data:
            update_data['bio'] = data['bio']
        
        # Handle image upload
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename and allowed_file(file.filename):
                try:
                    # Delete old image if exists
                    if existing_profile.get('profileImageUrl'):
                        # Extract public_id from URL if possible
                        old_url = existing_profile['profileImageUrl']
                        # Cloudinary URLs contain public_id in the path
                        try:
                            # Try to extract and delete old image
                            pass  # Optional: implement deletion of old image
                        except:
                            pass
                    
                    # Upload new image
                    profile_image_url = upload_image(file, folder='profiles')
                    update_data['profileImageUrl'] = profile_image_url
                except Exception as e:
                    return jsonify({'error': str(e)}), 500
        
        # Update profile
        profiles_collection.update_one(
            {'userId': user_id},
            {'$set': update_data}
        )
        
        # Fetch updated profile
        updated_profile = profiles_collection.find_one({'userId': user_id})
        updated_profile['_id'] = str(updated_profile['_id'])
        if 'createdAt' in updated_profile and isinstance(updated_profile['createdAt'], datetime):
            updated_profile['createdAt'] = updated_profile['createdAt'].isoformat()
        if 'updatedAt' in updated_profile and isinstance(updated_profile['updatedAt'], datetime):
            updated_profile['updatedAt'] = updated_profile['updatedAt'].isoformat()
        
        return jsonify(updated_profile), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/profiles/image', methods=['POST'])
@require_auth
def upload_profile_image(user_id):
    """Upload profile image only"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if not file or not file.filename:
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}), 400
        
        try:
            image_url = upload_image(file, folder='profiles')
            return jsonify({'imageUrl': image_url}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500
