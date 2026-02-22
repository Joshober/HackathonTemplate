from flask import Blueprint, request, jsonify
import os
import io
from openai import OpenAI

bp = Blueprint('transcription', __name__)

ALLOWED_EXTENSIONS = {'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB - limite da API Whisper


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route('/transcribe', methods=['POST'])
def transcribe():
    """Transcreve áudio para texto usando a API Whisper da OpenAI"""
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return jsonify({
                'error': 'OPENAI_API_KEY não configurada. Defina a variável no .env'
            }), 500

        if 'file' not in request.files and 'audio' not in request.files:
            return jsonify({'error': 'Nenhum arquivo enviado. Use o campo "file" ou "audio"'}), 400

        file = request.files.get('file') or request.files.get('audio')
        if not file or file.filename == '':
            return jsonify({'error': 'Nenhum arquivo selecionado'}), 400

        if not allowed_file(file.filename):
            return jsonify({
                'error': f'Formato não suportado. Use: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400

        # Verifica tamanho (25MB max)
        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        if size > MAX_FILE_SIZE:
            return jsonify({'error': 'Arquivo muito grande. Máximo: 25MB'}), 400

        model = request.form.get('model', 'whisper-1')
        response_format = request.form.get('response_format', 'text')
        language = request.form.get('language') or None
        prompt = request.form.get('prompt') or None

        # Convert FileStorage to bytes for OpenAI SDK (expects io.IOBase, bytes or tuple)
        file_bytes = file.read()
        file_like = io.BytesIO(file_bytes)

        client = OpenAI(api_key=api_key)

        kwargs = {
            'model': model,
            'file': (file.filename, file_like),
            'response_format': response_format,
        }
        if language:
            kwargs['language'] = language
        if prompt:
            kwargs['prompt'] = prompt

        transcription = client.audio.transcriptions.create(**kwargs)

        # When response_format="text", API returns string directly; otherwise returns object with .text
        if response_format == 'text':
            text = transcription if isinstance(transcription, str) else transcription.text
            return jsonify({'text': text}), 200

        # Para json/verbose_json/diarized_json, converter para dict
        result = transcription.model_dump() if hasattr(transcription, 'model_dump') else vars(transcription)
        return jsonify(result), 200

    except Exception as e:
        error_msg = str(e)
        if 'api_key' in error_msg.lower() or 'invalid' in error_msg.lower():
            return jsonify({'error': 'Chave de API inválida ou expirada'}), 401
        return jsonify({'error': f'Erro na transcrição: {error_msg}'}), 500
