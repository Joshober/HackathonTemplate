from flask import Blueprint, request, Response, jsonify
import os
from openai import OpenAI

bp = Blueprint('speech', __name__)

MAX_TEXT_LENGTH = 4096

# Same as chat.py: OpenAI for these voices, Magic Hour for the rest (celebrity voices)
OPENAI_VOICES = {'alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'fable', 'marin', 'nova', 'onyx', 'sage', 'shimmer', 'verse'}


@bp.route('/speech', methods=['POST'])
def text_to_speech():
    """Converts text to speech. OpenAI TTS for standard voices, Magic Hour API for celebrity voices."""
    try:
        data = request.get_json() or {}
        text = data.get('text', '').strip()
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        if len(text) > MAX_TEXT_LENGTH:
            return jsonify({'error': f'Text too long. Maximum: {MAX_TEXT_LENGTH} characters'}), 400

        voice = (data.get('voice') or 'coral').strip()
        model = data.get('model', 'tts-1-hd')
        response_format = data.get('response_format', 'mp3')

        if voice in OPENAI_VOICES:
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                return jsonify({'error': 'OPENAI_API_KEY not configured'}), 500
            client = OpenAI(api_key=api_key)
            response = client.audio.speech.create(
                model=model,
                voice=voice,
                input=text,
                response_format=response_format,
            )
            audio_bytes = response.content
            mimetype = 'audio/mpeg' if response_format == 'mp3' else f'audio/{response_format}'
            return Response(audio_bytes, mimetype=mimetype)

        # Magic Hour (celebrity voices) — same behaviour as chat pipeline TTS
        from app.routes.voice import _generate_magic_hour
        api_key = os.getenv('MAGICHOUR_API_KEY')
        if not api_key:
            return jsonify({'error': 'MAGICHOUR_API_KEY not configured for Magic Hour voices'}), 500
        body, code = _generate_magic_hour(
            text,
            voice_name=voice,
            name='Chat TTS',
            api_key=api_key,
        )
        if code != 200:
            return body, code
        return body

    except Exception as e:
        error_msg = str(e)
        if 'api_key' in error_msg.lower() or 'invalid' in error_msg.lower():
            return jsonify({'error': 'Invalid or expired API key'}), 401
        return jsonify({'error': f'Text-to-speech error: {error_msg}'}), 500
