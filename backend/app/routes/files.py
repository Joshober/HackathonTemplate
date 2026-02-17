from flask import Blueprint, request, jsonify, send_file
from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth
from app.config.cloudinary_config import upload_image, upload_video, delete_image
from app.services.audit import log_change
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
from werkzeug.utils import secure_filename
import requests
import os

bp = Blueprint('files', __name__)

ALLOWED_EXTENSIONS = {
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'png', 'jpg', 'jpeg', 'gif', 'webp',
    'txt', 'csv', 'json'
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _parse_object_id(value, param_name='id'):
    try:
        return ObjectId(value)
    except InvalidId:
        return None


def _get_file_type(mime_type, filename):
    """Determine file type category."""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    
    if mime_type.startswith('image/'):
        return 'image'
    elif mime_type == 'application/pdf':
        return 'pdf'
    elif mime_type in ('application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'):
        return 'document'
    elif mime_type in ('application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'):
        return 'spreadsheet'
    elif mime_type in ('application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'):
        return 'presentation'
    elif ext in ('txt', 'csv', 'json'):
        return 'text'
    else:
        return 'other'


@bp.route('/objectives/<objective_id>/files', methods=['POST'])
@require_auth
def upload_file(objective_id, user_id):
    """Upload a file and associate it with an objective or key result."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': f'File size exceeds maximum of {MAX_FILE_SIZE / (1024*1024)}MB'}), 400
        
        associated_with = request.form.get('associatedWith', 'objective')
        key_result_id = request.form.get('keyResultId')
        
        if associated_with == 'key_result' and not key_result_id:
            return jsonify({'error': 'keyResultId required when associatedWith is key_result'}), 400
        
        if associated_with == 'key_result':
            kr_oid = _parse_object_id(key_result_id)
            if kr_oid is None:
                return jsonify({'error': 'Invalid key result ID'}), 400
            kr = db.key_results.find_one({'_id': kr_oid, 'objectiveId': oid})
            if not kr:
                return jsonify({'error': 'Key result not found'}), 404
        
        # Upload to Cloudinary
        try:
            mime_type = file.content_type or 'application/octet-stream'
            file_type = _get_file_type(mime_type, file.filename)
            
            if file_type == 'image':
                url = upload_image(file, folder=f'okrs/{objective_id}')
            elif file_type in ('pdf', 'document', 'spreadsheet', 'presentation'):
                # For non-image files, we'll need to handle them differently
                # For now, use a generic upload approach
                url = upload_image(file, folder=f'okrs/{objective_id}')  # Cloudinary can handle PDFs
            else:
                # For other files, store metadata and use Cloudinary or alternative storage
                url = upload_image(file, folder=f'okrs/{objective_id}')
            
            # Generate thumbnail for images and PDFs
            thumbnail_url = None
            if file_type in ('image', 'pdf'):
                thumbnail_url = url.replace('/upload/', '/upload/w_200,h_200,c_fill/')
            
        except Exception as e:
            return jsonify({'error': f'Failed to upload file: {str(e)}'}), 500
        
        # Create file artifact record
        now = datetime.utcnow()
        file_doc = {
            'name': secure_filename(file.filename),
            'url': url,
            'size': file_size,
            'mimeType': mime_type,
            'thumbnailUrl': thumbnail_url,
            'uploadedBy': user_id,
            'uploadedAt': now,
            'associatedWith': associated_with,
            'objectiveId': oid,
            'keyResultId': ObjectId(key_result_id) if key_result_id else None,
        }
        
        result = db.file_artifacts.insert_one(file_doc)
        file_doc['_id'] = result.inserted_id
        
        # Add file reference to objective
        files = objective.get('files', [])
        files.append({
            'fileId': str(file_doc['_id']),
            'name': file_doc['name'],
            'url': url,
            'size': file_size,
            'mimeType': mime_type,
            'uploadedBy': user_id,
            'uploadedAt': now,
            'associatedWith': associated_with,
            'keyResultId': key_result_id if key_result_id else None
        })
        
        db.objectives.update_one(
            {'_id': oid},
            {'$set': {
                'files': files,
                'updatedAt': now,
                'lastModified': now
            }}
        )
        
        # Log to audit trail
        log_change(
            'objective',
            objective_id,
            user_id,
            'file_uploaded',
            changes=[{
                'field': 'files',
                'oldValue': len(files) - 1,
                'newValue': len(files)
            }],
            reason=f'File uploaded: {file_doc["name"]}'
        )
        
        return jsonify({
            '_id': str(file_doc['_id']),
            'name': file_doc['name'],
            'url': url,
            'size': file_size,
            'mimeType': mime_type,
            'thumbnailUrl': thumbnail_url,
            'uploadedBy': user_id,
            'uploadedAt': now.isoformat(),
            'associatedWith': associated_with,
            'objectiveId': str(oid),
            'keyResultId': key_result_id
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/files', methods=['GET'])
@require_auth
def list_files(objective_id, user_id):
    """List files for an objective and its key results."""
    try:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        
        db = get_db()
        objective = db.objectives.find_one({'_id': oid})
        if not objective:
            return jsonify({'error': 'Objective not found'}), 404
        
        # Get files from file_artifacts collection
        cursor = db.file_artifacts.find({
            'objectiveId': oid,
            'deletedAt': {'$exists': False}
        }).sort('uploadedAt', -1)
        
        files = []
        for doc in cursor:
            file_info = {
                '_id': str(doc['_id']),
                'name': doc.get('name'),
                'url': doc.get('url'),
                'size': doc.get('size'),
                'mimeType': doc.get('mimeType'),
                'thumbnailUrl': doc.get('thumbnailUrl'),
                'uploadedBy': doc.get('uploadedBy'),
                'uploadedAt': doc.get('uploadedAt').isoformat() if isinstance(doc.get('uploadedAt'), datetime) else doc.get('uploadedAt'),
                'associatedWith': doc.get('associatedWith', 'objective'),
                'keyResultId': str(doc.get('keyResultId')) if doc.get('keyResultId') else None,
            }
            files.append(file_info)
        
        return jsonify(files), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/files/<file_id>', methods=['GET'])
@require_auth
def get_file_metadata(file_id, user_id):
    """Get file metadata."""
    try:
        fid = _parse_object_id(file_id)
        if fid is None:
            return jsonify({'error': 'Invalid file ID'}), 400
        
        db = get_db()
        file_doc = db.file_artifacts.find_one({'_id': fid})
        if not file_doc:
            return jsonify({'error': 'File not found'}), 404
        
        return jsonify({
            '_id': str(file_doc['_id']),
            'name': file_doc.get('name'),
            'url': file_doc.get('url'),
            'size': file_doc.get('size'),
            'mimeType': file_doc.get('mimeType'),
            'thumbnailUrl': file_doc.get('thumbnailUrl'),
            'uploadedBy': file_doc.get('uploadedBy'),
            'uploadedAt': file_doc.get('uploadedAt').isoformat() if isinstance(file_doc.get('uploadedAt'), datetime) else file_doc.get('uploadedAt'),
            'associatedWith': file_doc.get('associatedWith'),
            'objectiveId': str(file_doc.get('objectiveId')),
            'keyResultId': str(file_doc.get('keyResultId')) if file_doc.get('keyResultId') else None,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/files/<file_id>/download', methods=['GET'])
@require_auth
def download_file(file_id, user_id):
    """Secure download endpoint for files."""
    try:
        fid = _parse_object_id(file_id)
        if fid is None:
            return jsonify({'error': 'Invalid file ID'}), 400
        
        db = get_db()
        file_doc = db.file_artifacts.find_one({'_id': fid})
        if not file_doc:
            return jsonify({'error': 'File not found'}), 404
        
        if file_doc.get('deletedAt'):
            return jsonify({'error': 'File has been deleted'}), 404
        
        # Return the Cloudinary URL (or redirect to it)
        # In production, you might want to proxy the file through your server
        return jsonify({
            'downloadUrl': file_doc.get('url'),
            'filename': file_doc.get('name')
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/files/<file_id>/preview', methods=['GET'])
@require_auth
def get_file_preview(file_id, user_id):
    """Get preview URL for a file (if supported)."""
    try:
        fid = _parse_object_id(file_id)
        if fid is None:
            return jsonify({'error': 'Invalid file ID'}), 400
        
        db = get_db()
        file_doc = db.file_artifacts.find_one({'_id': fid})
        if not file_doc:
            return jsonify({'error': 'File not found'}), 404
        
        url = file_doc.get('url')
        mime_type = file_doc.get('mimeType', '')
        
        # For images and PDFs, return preview URL
        if mime_type.startswith('image/') or mime_type == 'application/pdf':
            preview_url = url
            if mime_type == 'application/pdf':
                # Cloudinary can generate PDF previews
                preview_url = url.replace('/upload/', '/upload/fl_attachment/')
            return jsonify({'previewUrl': preview_url}), 200
        
        return jsonify({'error': 'Preview not available for this file type'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/files/<file_id>', methods=['DELETE'])
@require_auth
def delete_file(file_id, user_id):
    """Delete a file (soft delete with audit trail)."""
    try:
        fid = _parse_object_id(file_id)
        if fid is None:
            return jsonify({'error': 'Invalid file ID'}), 400
        
        db = get_db()
        file_doc = db.file_artifacts.find_one({'_id': fid})
        if not file_doc:
            return jsonify({'error': 'File not found'}), 404
        
        if file_doc.get('deletedAt'):
            return jsonify({'error': 'File already deleted'}), 400
        
        objective_id = str(file_doc.get('objectiveId'))
        
        # Soft delete
        now = datetime.utcnow()
        db.file_artifacts.update_one(
            {'_id': fid},
            {'$set': {
                'deletedAt': now,
                'deletedBy': user_id
            }}
        )
        
        # Remove from objective's files array
        objective = db.objectives.find_one({'_id': file_doc.get('objectiveId')})
        if objective:
            files = objective.get('files', [])
            files = [f for f in files if f.get('fileId') != file_id]
            db.objectives.update_one(
                {'_id': file_doc.get('objectiveId')},
                {'$set': {
                    'files': files,
                    'updatedAt': now,
                    'lastModified': now
                }}
            )
        
        # Log to audit trail
        log_change(
            'objective',
            objective_id,
            user_id,
            'file_deleted',
            changes=[{
                'field': 'files',
                'oldValue': file_doc.get('name'),
                'newValue': None
            }],
            reason=f'File deleted: {file_doc.get("name")}'
        )
        
        return jsonify({'message': 'File deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
