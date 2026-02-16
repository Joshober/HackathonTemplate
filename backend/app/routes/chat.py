from flask import Blueprint, request, jsonify
import os
import requests

bp = Blueprint('chat', __name__)

@bp.route('/chat', methods=['POST'])
def chat():
    """Handle chat messages using OpenRouter API"""
    try:
        data = request.get_json()
        
        if not data or 'messages' not in data:
            return jsonify({'error': 'Messages are required'}), 400
        
        messages = data['messages']
        model = data.get('model', 'openai/gpt-3.5-turbo')
        
        # Get API key from environment
        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({
                'error': 'OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in your environment variables.'
            }), 500
        
        # Prepare request to OpenRouter
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
        
        # Make request to OpenRouter
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if not response.ok:
            try:
                error_data = response.json() if response.content else {}
                error_message = error_data.get('error', {})
                if isinstance(error_message, dict):
                    error_msg = error_message.get('message', f'OpenRouter API error: {response.status_text}')
                else:
                    error_msg = str(error_message) if error_message else f'OpenRouter API error: {response.status_text}'
            except:
                error_msg = f'OpenRouter API error: {response.status_text}'
            
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
