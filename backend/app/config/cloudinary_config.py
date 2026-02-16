import cloudinary
import cloudinary.uploader
import cloudinary.api
import os

def init_cloudinary():
    """Initialize Cloudinary configuration"""
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
    api_key = os.getenv('CLOUDINARY_API_KEY')
    api_secret = os.getenv('CLOUDINARY_API_SECRET')
    
    # Only initialize if all credentials are provided
    if cloud_name and api_key and api_secret:
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
    else:
        print("Warning: Cloudinary credentials not set. Image uploads will not work.")

def upload_image(file, folder='profiles'):
    """Upload an image to Cloudinary"""
    try:
        result = cloudinary.uploader.upload(
            file,
            folder=folder,
            resource_type='image',
            transformation=[
                {'width': 500, 'height': 500, 'crop': 'fill', 'gravity': 'face'},
                {'quality': 'auto'},
                {'fetch_format': 'auto'}
            ]
        )
        return result.get('secure_url')
    except Exception as e:
        raise Exception(f"Failed to upload image: {str(e)}")

def upload_video(file, folder='items'):
    """Upload a video to Cloudinary"""
    try:
        result = cloudinary.uploader.upload(
            file,
            folder=folder,
            resource_type='video',
            transformation=[
                {'quality': 'auto'},
                {'fetch_format': 'auto'}
            ]
        )
        return result.get('secure_url')
    except Exception as e:
        raise Exception(f"Failed to upload video: {str(e)}")

def delete_image(public_id):
    """Delete an image from Cloudinary"""
    try:
        result = cloudinary.uploader.destroy(public_id)
        return result.get('result') == 'ok'
    except Exception as e:
        raise Exception(f"Failed to delete image: {str(e)}")
