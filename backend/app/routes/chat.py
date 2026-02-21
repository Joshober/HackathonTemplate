from flask import Blueprint, request, jsonify
import os
import requests
from app.prompts.roast import ROAST_CHAT_SYSTEM

bp = Blueprint('chat', __name__)

def _build_messages_with_images(messages, images_b64):
    """Inject images into the last user message as OpenRouter multimodal content."""
    if not messages or not images_b64:
        return messages
    built = list(messages[:-1])
    last = messages[-1]
    if last.get('role') != 'user':
        return messages
    text = last.get('content') or ''
    if isinstance(text, list):
        text = next((p.get('text', '') for p in text if p.get('type') == 'text'), '')
    content = [{'type': 'text', 'text': text or '(Image attached)'}]
    for b64 in images_b64:
        content.append({
            'type': 'image_url',
            'image_url': {'url': f'data:image/jpeg;base64,{b64}'}
        })
    built.append({'role': 'user', 'content': content})
    return built

def _build_roast_messages(images_b64, user_text=None):
    """Single turn for Roast mode: system roast + user with image(s)."""
    text = (user_text or 'Roast this image.').strip()
    content = [{'type': 'text', 'text': text}]
    for b64 in images_b64:
        content.append({
            'type': 'image_url',
            'image_url': {'url': f'data:image/jpeg;base64,{b64}'}
        })
    return [
        {'role': 'system', 'content': ROAST_CHAT_SYSTEM},
        {'role': 'user', 'content': content},
    ]

@bp.route('/chat', methods=['POST'])
def chat():
    """AI Assistant: OpenRouter only. Supports text + optional images (vision model)."""
    try:
        data = request.get_json()
        
        if not data or 'messages' not in data:
            return jsonify({'error': 'Messages are required'}), 400
        
        messages = data['messages']
        images_b64 = data.get('images') or []
        has_images = isinstance(images_b64, list) and len(images_b64) > 0
        mode = data.get('mode') or 'assistant'

        if mode == 'roast' and has_images:
            last_user = next((m for m in reversed(messages) if m.get('role') == 'user'), None)
            user_text = last_user.get('content', '') if isinstance(last_user, dict) else ''
            if not user_text or (isinstance(user_text, str) and user_text.strip() in ('(See image)', '(Image attached)', '')):
                user_text = None
            else:
                user_text = user_text.strip() if isinstance(user_text, str) else None
            messages = _build_roast_messages(images_b64, user_text)
            model = os.getenv('OPENROUTER_CHAT_VISION_MODEL') or 'openai/gpt-4o-mini'
        elif has_images:
            messages = _build_messages_with_images(messages, images_b64)
            model = os.getenv('OPENROUTER_CHAT_VISION_MODEL') or 'openai/gpt-4o-mini'
        else:
            model = data.get('model', 'openai/gpt-3.5-turbo')
        
        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({
                'error': 'OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in your environment variables.'
            }), 500
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'HTTP-Referer': request.headers.get('Origin', ''),
            'X-Title': 'Hackathon Template Chatbot',
        }
        
        payload = {
            'model': model,
            'messages': messages,
        }
        
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers=headers,
            json=payload,
            timeout=60
        )
        
        if not response.ok:
            try:
                error_data = response.json() if response.content else {}
                error_message = error_data.get('error', {})
                if isinstance(error_message, dict):
                    error_msg = error_message.get('message', f'OpenRouter API error: {response.reason}')
                else:
                    error_msg = str(error_message) if error_message else f'OpenRouter API error: {response.reason}'
            except Exception:
                error_msg = f'OpenRouter API error: {response.reason}'
            
            return jsonify({
                'error': error_msg,
                'status_code': response.status_code
            }), response.status_code
        
        result = response.json()
        
        # Extract the assistant's message
        if 'choices' in result and len(result['choices']) > 0:
            assistant_message = result['choices'][0].get('message', {}).get('content', '')
            return jsonify({
                'message': assistant_message,
                'usage': result.get('usage', {})
            }), 200
        else:
            return jsonify({
                'error': 'No response from OpenRouter'
            }), 500
            
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': f'Network error: {str(e)}'
        }), 500
    except Exception as e:
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500
