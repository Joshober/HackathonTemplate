from flask import Blueprint, request, jsonify
import os
import io
import base64
import json
import re
import requests
from openai import OpenAI
from app.prompts.roast import ROAST_CHAT_SYSTEM
from app.prompts.support import SUPPORT_SYSTEM
from app.prompts.assistant_web import ASSISTANT_WEB_SYSTEM
from app.prompts.voice_assistant import VOICE_ASSISTANT_SYSTEM
from app.prompts.bullshit_detect import BULLSHIT_DETECT_SYSTEM
from app.services.web_search import search_web
from app.services.weather import get_weather as fetch_weather
from app.services.crypto import get_crypto_price as fetch_crypto_price, buy_crypto as do_buy_crypto, sell_crypto as do_sell_crypto, get_portfolio_summary as fetch_portfolio_summary
from app.services.library import get_library_count as _get_library_count

bp = Blueprint('chat', __name__)


def _pdf_first_page_to_base64(pdf_bytes: bytes):
    """Convert first page of PDF to JPEG base64 for vision API. Returns None on failure."""
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if len(doc) == 0:
            doc.close()
            return None
        page = doc[0]
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        doc.close()
        return base64.b64encode(img_bytes).decode("utf-8")
    except Exception:
        return None

# Tool definition for web search (OpenRouter/OpenAI-style)
def _normalize_text(s: str) -> str:
    """Collapse whitespace to single space and strip."""
    return re.sub(r'\s+', ' ', (s or '').strip())


def _remove_echo_sentences(user_content: str, last_assistant_content: str) -> str:
    """
    Remove from user_content any sentence that appears in the last assistant message.
    Avoids sending back the AI's previous output (e.g. TTS echo or copy-paste) as part of the prompt.
    """
    if not user_content or not last_assistant_content:
        return user_content
    last_plain = (last_assistant_content or '').strip()
    if not last_plain:
        return user_content
    last_norm = _normalize_text(last_plain).lower()
    # Split into sentences: period, !, ? followed by space or end
    parts = re.split(r'(?<=[.!?])\s+', (user_content or '').strip())
    sentences = [p.strip() for p in parts if p.strip()]
    kept = []
    for s in sentences:
        snorm = _normalize_text(s).lower()
        if not snorm:
            kept.append(s)
            continue
        if snorm in last_norm:
            continue
        kept.append(s)
    if not kept:
        return user_content
    return ' '.join(kept)


ASSISTANT_TOOLS = [
    {
        'type': 'function',
        'function': {
            'name': 'get_weather',
            'description': 'Get current weather for a location. ALWAYS use this for any weather question (e.g. "weather in X", "temperature in Lamoni"). Pass the location as a string: city name, or "city state", or "city country".',
            'parameters': {
                'type': 'object',
                'properties': {
                    'location': {
                        'type': 'string',
                        'description': 'Location: city name, or "city state" (e.g. "Lamoni Iowa"), or "city country"',
                    },
                },
                'required': ['location'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'search_web',
            'description': 'Search the web for current information. Use for news, general facts, or when you need up-to-date information. Do NOT use for weather—use get_weather instead.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'query': {
                        'type': 'string',
                        'description': 'Search query (a few clear keywords)',
                    },
                },
                'required': ['query'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_library_count',
            'description': 'Get the current number of people in the library. This calls a sensor API that returns the count—you do not compute anything. ALWAYS use this when the user asks how many people are in the library, how busy the library is, or library occupancy. Never refuse or say you cannot do it.',
            'parameters': {'type': 'object', 'properties': {}},
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_crypto_price',
            'description': 'Get the current price and 24h change for a cryptocurrency. ALWAYS use this for any crypto price question (e.g. "price of Bitcoin", "how much is ETH", "doge price"). Pass symbol_or_id: btc, bitcoin, eth, ethereum, sol, solana, doge, ada, xrp, link, avax, matic, shib, etc.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'symbol_or_id': {
                        'type': 'string',
                        'description': 'Coin symbol or id: e.g. btc, bitcoin, eth, sol, doge, ada, xrp, link, shib',
                    },
                },
                'required': ['symbol_or_id'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'buy_crypto',
            'description': 'Execute a simulated BUY of cryptocurrency. Use when the user wants to buy crypto or says "buy", "buy btc", "put 500 in eth". Be aggressive: if they ask about buying or the price is dipping, suggest and call this. amount_usd is how much USD to spend (simulated).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'symbol': {'type': 'string', 'description': 'Coin symbol: btc, eth, sol, doge, etc.'},
                    'amount_usd': {'type': 'number', 'description': 'Amount in USD to spend (e.g. 100, 500)'},
                },
                'required': ['symbol', 'amount_usd'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'sell_crypto',
            'description': 'Execute a simulated SELL of cryptocurrency. Use when the user wants to sell or says "sell", "sell all", "dump btc". Be aggressive: if price is up or they seem nervous, suggest selling. amount_usd_or_all: number (USD to sell) or "all" to sell entire position.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'symbol': {'type': 'string', 'description': 'Coin symbol: btc, eth, sol, doge, etc.'},
                    'amount_usd_or_all': {'type': 'string', 'description': 'USD amount to sell (e.g. "100") or "all" to sell entire position'},
                },
                'required': ['symbol', 'amount_usd_or_all'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_portfolio_summary',
            'description': 'Get the user\'s current simulated crypto positions and recent trades. Use when they ask "what do I have", "my portfolio", "my positions", "what did I buy".',
            'parameters': {'type': 'object', 'properties': {}},
        },
    },
]


def _is_library_occupancy_question(messages: list) -> bool:
    """True if the last user message is asking about people in the library / library occupancy."""
    for m in reversed(messages or []):
        if m.get('role') != 'user':
            continue
        content = m.get('content') or ''
        if isinstance(content, list):
            text = ' '.join(
                p.get('text', '') for p in content
                if isinstance(p, dict) and p.get('type') == 'text'
            )
        else:
            text = str(content)
        lower = text.lower().strip()
        if not lower:
            continue
        if 'library' not in lower:
            return False
        if any(k in lower for k in ('people', 'how many', 'count', 'occupancy', 'busy', 'crowd', 'crowded')):
            return True
        if re.search(r'how\s+many|number\s+of|how\s+busy', lower):
            return True
        return False
    return False


def _reverse_geocode(lat: float, lon: float) -> str | None:
    """Convert lat/lon to a place name (e.g. 'Lamoni, Iowa, United States') using Nominatim. Returns None on failure."""
    try:
        r = requests.get(
            'https://nominatim.openstreetmap.org/reverse',
            params={'lat': lat, 'lon': lon, 'format': 'json'},
            headers={'User-Agent': 'HackathonVoiceAssistant/1.0'},
            timeout=5,
        )
        r.raise_for_status()
        data = r.json()
        return (data.get('display_name') or '').strip() or None
    except Exception:
        return None


def _chat_with_web_search(messages, model, headers, timeout_sec=60, personality_override=None, user_location=None, library_count=None, system_prompt_base=None):
    """Run chat with web search tool; returns (assistant_message, usage).
    personality_override: optional string appended to the system prompt.
    user_location: optional place name string (e.g. from reverse geocode); when set, model knows user's location for 'near me' queries.
    library_count: optional int from page load (sensor count); when set, injected into prompt so model reports it for library questions.
    system_prompt_base: optional system prompt string; when 'voice_assistant' or the voice-assistant constant, use Voice Assistant prompt (for /voice-assistant page). Otherwise use ASSISTANT_WEB_SYSTEM.
    """
    if system_prompt_base is not None:
        system_content = system_prompt_base
    else:
        system_content = ASSISTANT_WEB_SYSTEM
    if user_location and str(user_location).strip():
        system_content = system_content + "\n\nThe user's current location is: " + str(user_location).strip() + ". When they ask for 'restaurants near me', 'nearby', or similar, use this location (e.g. search 'restaurants in [this area]')."
    if personality_override and str(personality_override).strip():
        system_content = system_content + "\n\nAdditional personality / instructions (follow these when replying):\n" + str(personality_override).strip()
    # Library count: use value from page load if provided, else call API when user asks about library
    if library_count is not None and isinstance(library_count, int) and library_count >= 0:
        n = library_count
        system_content = system_content + f"\n\n**FACT — you must use it:** The number of people currently in the library is {n}. This is the real head count from the library sensor (people in the building). The same number ({n} people in the library) is shown on the user's page. When the user asks how many people are in the library, how busy it is, or library occupancy, you MUST say there are {n} people in the library. Then say whether that's a lot or a little, then add a line like \"That's a lot of people—I'll turn off the internet!\" Do not say you don't know or suggest they look themselves—you know: {n} people in the library."
    elif _is_library_occupancy_question(messages):
        try:
            raw = _get_library_count()
            data = json.loads(raw)
            if 'count' in data and 'error' not in data:
                n = data['count']
                system_content = system_content + f"\n\n**FACT — you must use it:** The number of people currently in the library is {n}. This is the real head count from the library sensor (people in the building). You MUST tell the user there are {n} people in the library. Then say whether that's a lot or a little, then add a line like \"That's a lot of people—I'll turn off the internet!\" Do not say you don't know or suggest they look themselves—you know: {n} people in the library."
        except (json.JSONDecodeError, TypeError):
            pass
    if not messages or messages[0].get('role') != 'system':
        messages = [{'role': 'system', 'content': system_content}] + list(messages)
    payload = {'model': model, 'messages': messages, 'tools': ASSISTANT_TOOLS, 'tool_choice': 'auto'}
    max_turns = 5
    usage_merged = {}
    content = ''
    for _ in range(max_turns):
        resp = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers=headers,
            json=payload,
            timeout=timeout_sec,
        )
        if not resp.ok:
            err = resp.json() if resp.content else {}
            msg = err.get('error', resp.reason)
            if isinstance(msg, dict):
                msg = msg.get('message', str(msg))
            raise ValueError(str(msg))
        result = resp.json()
        choice = (result.get('choices') or [{}])[0]
        msg = choice.get('message') or {}
        content = (msg.get('content') or '').strip()
        tool_calls = msg.get('tool_calls') or []
        if result.get('usage'):
            for k, v in result['usage'].items():
                if isinstance(v, (int, float)):
                    usage_merged[k] = usage_merged.get(k, 0) + v
                elif isinstance(v, dict) and k not in usage_merged:
                    usage_merged[k] = v
        if not tool_calls:
            return (content or "I couldn't generate a response."), usage_merged
        messages = list(messages)
        messages.append({
            'role': 'assistant',
            'content': content or None,
            'tool_calls': [{'id': tc.get('id'), 'type': 'function', 'function': tc.get('function', {})} for tc in tool_calls],
        })
        for tc in tool_calls:
            tid = tc.get('id') or ''
            fn = tc.get('function') or {}
            name = fn.get('name') or ''
            args_str = fn.get('arguments') or '{}'
            try:
                args = json.loads(args_str)
            except json.JSONDecodeError:
                args = {}
            if name == 'get_weather':
                tool_result = fetch_weather(args.get('location', ''))
            elif name == 'search_web':
                tool_result = search_web(args.get('query', ''))
            elif name == 'get_library_count':
                tool_result = _get_library_count()
            elif name == 'get_crypto_price':
                tool_result = fetch_crypto_price(args.get('symbol_or_id', ''))
            elif name == 'buy_crypto':
                tool_result = do_buy_crypto(
                    args.get('symbol', ''),
                    args.get('amount_usd', 0),
                )
            elif name == 'sell_crypto':
                tool_result = do_sell_crypto(
                    args.get('symbol', ''),
                    args.get('amount_usd_or_all', 'all'),
                )
            elif name == 'get_portfolio_summary':
                tool_result = fetch_portfolio_summary()
            else:
                tool_result = f'Unknown tool: {name}'
            messages.append({'role': 'tool', 'tool_call_id': tid, 'content': tool_result})
        payload['messages'] = messages
        payload['tool_choice'] = 'auto'  # after first turn, let model choose tools
    return (content or 'I hit the search limit. Please try a shorter question.'), usage_merged


def _process_support_actions(message: str) -> str:
    """
    Find [SEND_EMAIL]...[/SEND_EMAIL] and [CREATE_TICKET]...[/CREATE_TICKET] in the assistant message.
    Execute them (send email, create ticket), then remove the blocks and return the cleaned message.
    Inner format: to=...|subject=...|body=... (body is last and may contain | and newlines; use \\n for newlines).
    """
    if not message or not isinstance(message, str):
        return message

    cleaned = message

    # SEND_EMAIL: to=...|subject=...|body=... (body can contain | and newlines)
    for m in re.finditer(r'\[SEND_EMAIL\](.*?)\[/SEND_EMAIL\]', message, re.DOTALL):
        block = m.group(0)
        inner = m.group(1).strip()
        to_addr = subject = body = ''
        if '|' in inner:
            parts = inner.split('|')
            for p in parts[:2]:
                if '=' in p:
                    k, _, v = p.partition('=')
                    k, v = k.strip().lower(), v.strip()
                    if k == 'to':
                        to_addr = v
                    elif k == 'subject':
                        subject = v
            if len(parts) >= 3:
                rest = '|'.join(parts[2:]).strip()
                if rest.lower().startswith('body='):
                    body = rest[5:].strip()
                body = body.replace('\\n', '\n')
        if to_addr and subject:
            try:
                from app.services.mail import send_email, is_configured
                if is_configured():
                    send_email(to=to_addr, subject=subject, body_text=body or '')
            except Exception:
                pass
        cleaned = cleaned.replace(block, '')

    # CREATE_TICKET: title=...|description=... (description may contain | and newlines)
    for m in re.finditer(r'\[CREATE_TICKET\](.*?)\[/CREATE_TICKET\]', message, re.DOTALL):
        block = m.group(0)
        inner = m.group(1).strip()
        title = desc = ''
        if '|' in inner:
            parts = inner.split('|')
            for p in parts[:1]:
                if '=' in p:
                    k, _, v = p.partition('=')
                    k, v = k.strip().lower(), v.strip()
                    if k == 'title':
                        title = v
            if len(parts) >= 2:
                rest = '|'.join(parts[1:]).strip()
                if rest.lower().startswith('description='):
                    desc = rest[12:].strip()
                desc = desc.replace('\\n', '\n')
        if title and desc:
            try:
                from app.db.mongodb import get_db
                from datetime import datetime
                db = get_db()
                col = db['tickets']
                now = datetime.utcnow()
                col.insert_one({
                    'title': title,
                    'description': desc,
                    'status': 'open',
                    'createdAt': now,
                    'updatedAt': now,
                })
            except Exception:
                pass
        cleaned = cleaned.replace(block, '')

    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned).strip()
    return cleaned

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


def _video_data_url(b64: str, mime: str) -> str:
    """Build data URL for video. OpenRouter accepts video/mp4, video/webm, video/mov, video/mpeg."""
    normalized = (mime or 'video/mp4').strip().lower()
    if normalized not in ('video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'):
        normalized = 'video/mp4'
    if normalized == 'video/quicktime':
        normalized = 'video/mp4'  # mov as mp4 for compatibility
    return f'data:{normalized};base64,{b64}'


def _build_roast_messages_video(video_b64: str, video_mime: str, user_text=None):
    """Single turn for Roast mode: system roast + user with one video (video_url)."""
    text = (user_text or 'Roast this video.').strip()
    content = [
        {'type': 'text', 'text': text},
        {'type': 'video_url', 'video_url': {'url': _video_data_url(video_b64, video_mime)}},
    ]
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
        video_b64 = data.get('video_b64') or ''
        video_mime = (data.get('video_mime') or 'video/mp4').strip()
        has_video = isinstance(video_b64, str) and len(video_b64) > 0
        mode = data.get('mode') or 'assistant'

        if mode == 'roast' and has_video:
            last_user = next((m for m in reversed(messages) if m.get('role') == 'user'), None)
            user_text = last_user.get('content', '') if isinstance(last_user, dict) else ''
            if not user_text or (isinstance(user_text, str) and user_text.strip() in ('(See video)', '(Video attached)', '(See image)', '(Image attached)', '')):
                user_text = None
            else:
                user_text = user_text.strip() if isinstance(user_text, str) else None
            messages = _build_roast_messages_video(video_b64, video_mime, user_text)
            model = os.getenv('OPENROUTER_VIDEO_MODEL') or os.getenv('OPENROUTER_CHAT_VISION_MODEL') or 'google/gemini-2.5-flash'
        elif mode == 'roast' and has_images:
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

        if mode == 'support':
            messages = [{'role': 'system', 'content': SUPPORT_SYSTEM}] + messages

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
        
        timeout_sec = 120 if has_video else 60
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers=headers,
            json=payload,
            timeout=timeout_sec
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
            if mode == 'support':
                assistant_message = _process_support_actions(assistant_message)
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


def _run_bullshit_detect(messages, model, headers, timeout_sec=90):
    """Call OpenRouter with bullshit-detect system; return (data, usage).
    data has 'read_aloud' (short sarcastic summary for TTS) and 'analysis' (full written commentary).
    """
    payload = {
        'model': model,
        'messages': messages,
        'response_format': {'type': 'json_object'},
    }
    response = requests.post(
        'https://openrouter.ai/api/v1/chat/completions',
        headers=headers,
        json=payload,
        timeout=timeout_sec,
    )
    if not response.ok:
        err = response.json() if response.content else {}
        msg = err.get('error', response.reason)
        if isinstance(msg, dict):
            msg = msg.get('message', str(msg))
        raise ValueError(str(msg))
    result = response.json()
    if not result.get('choices'):
        raise ValueError('No response from model')
    content = (result['choices'][0].get('message') or {}).get('content') or ''
    content_clean = content.strip()
    for prefix in ('```json', '```'):
        if content_clean.startswith(prefix):
            content_clean = content_clean[len(prefix):].strip()
        if content_clean.endswith('```'):
            content_clean = content_clean[:-3].strip()
    try:
        parsed = json.loads(content_clean)
        read_aloud = (parsed.get('read_aloud') or '').strip()
        analysis = (parsed.get('analysis') or '').strip() or content
        if not read_aloud and analysis:
            read_aloud = analysis[:300] if len(analysis) > 300 else analysis
        data = {'read_aloud': read_aloud, 'analysis': analysis}
    except json.JSONDecodeError:
        data = {'read_aloud': content[:300] if len(content) > 300 else content, 'analysis': content}
    return data, result.get('usage', {})


# --- Bullshit Detect (JP/BSfilter): separate feature, does not replace main chat or pipeline ---
@bp.route('/chat/bullshit-detect', methods=['POST'])
def bullshit_detect():
    """
    Bullshit detection (text only). Body: { "document": "text" }. Returns { "read_aloud": "...", "analysis": "..." }.
    """
    try:
        data = request.get_json()
        if not data or 'document' not in data:
            return jsonify({'error': 'document is required'}), 400
        document = (data.get('document') or '').strip()
        if not document:
            return jsonify({'error': 'document cannot be empty'}), 400

        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({'error': 'OPENROUTER_API_KEY is not configured'}), 500

        messages = [
            {'role': 'system', 'content': BULLSHIT_DETECT_SYSTEM},
            {'role': 'user', 'content': f'Analyze this document and respond with the required JSON.\n\n{document}'},
        ]
        model = data.get('model') or os.getenv('OPENROUTER_CHAT_MODEL') or 'openai/gpt-4o-mini'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'HTTP-Referer': request.headers.get('Origin', ''),
            'X-Title': 'Reality Check',
        }
        data, usage = _run_bullshit_detect(messages, model, headers)
        return jsonify({'read_aloud': data['read_aloud'], 'analysis': data['analysis'], 'usage': usage}), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Network error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Internal error: {str(e)}'}), 500


@bp.route('/chat/bullshit-detect-pipeline', methods=['POST'])
def bullshit_detect_pipeline():
    """
    Full pipeline: STT (optional) -> bullshit detection (text + images + video) -> TTS (optional).
    Multipart: audio (optional), text (optional), images[] (optional), video (optional), tts (bool), voice (str).
    Returns { "read_aloud": "...", "analysis": "...", "transcribed_text"?: "...", "audio_base64"?: "...", "audio_format"?: "mp3"|"wav", "usage": {} }.
    """
    try:
        text = (request.form.get('text') or '').strip()
        tts = request.form.get('tts', 'false').lower() in ('true', '1', 'yes')
        voice = request.form.get('voice') or 'coral'
        tts_provider = request.form.get('tts_provider') or None  # 'openai' | 'magic_hour' | None

        # Step 1: Transcribe audio if present
        audio_file = request.files.get('audio') or request.files.get('file')
        transcribed_text = None
        if audio_file and audio_file.filename:
            transcribed = _transcribe_audio(audio_file)
            transcribed_text = transcribed
            text = f'{text} {transcribed}'.strip() if text else transcribed

        # Step 2: Get images (and PDF: first page converted to image)
        images_b64 = []
        for key in request.files:
            if key.startswith('images') or key == 'image':
                f = request.files[key]
                if not f or not f.filename:
                    continue
                ct = (f.content_type or '').strip().lower()
                fn = (f.filename or '').lower()
                if 'image' in ct:
                    images_b64.append(base64.b64encode(f.read()).decode('utf-8'))
                elif ct == 'application/pdf' or fn.endswith('.pdf'):
                    pdf_b64 = _pdf_first_page_to_base64(f.read())
                    if pdf_b64:
                        images_b64.append(pdf_b64)

        # Step 3: Get video
        video_b64 = ''
        video_mime = 'video/mp4'
        video_file = request.files.get('video')
        if video_file and video_file.filename:
            ct = (video_file.content_type or '').strip().lower()
            fn = (video_file.filename or '').lower()
            is_video = 'video' in ct or fn.endswith(('.mov', '.mp4', '.webm', '.mpeg', '.mpeg4'))
            if is_video:
                video_b64 = base64.b64encode(video_file.read()).decode('utf-8')
                video_mime = ct if ct and 'video' in ct else ('video/quicktime' if fn.endswith('.mov') else 'video/mp4')

        has_video = bool(video_b64)
        has_images = len(images_b64) > 0
        if not text and not has_images and not has_video:
            return jsonify({'error': 'Provide audio, text, at least one image, or a video'}), 400

        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({'error': 'OPENROUTER_API_KEY is not configured'}), 500

        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'HTTP-Referer': request.headers.get('Origin', ''),
            'X-Title': 'Reality Check',
        }

        user_content = text or ('(See video)' if has_video else '(See image)')
        if has_video:
            content = [
                {'type': 'text', 'text': f'Analyze this video for bullshit. Respond with JSON: {{"read_aloud": "...", "analysis": "..."}}\n\n{user_content}'},
                {'type': 'video_url', 'video_url': {'url': _video_data_url(video_b64, video_mime)}},
            ]
            messages = [{'role': 'system', 'content': BULLSHIT_DETECT_SYSTEM}, {'role': 'user', 'content': content}]
            model = os.getenv('OPENROUTER_VIDEO_MODEL') or os.getenv('OPENROUTER_CHAT_VISION_MODEL') or 'google/gemini-2.5-flash'
            timeout_sec = 120
        elif has_images:
            content = [{'type': 'text', 'text': f'Analyze this image for bullshit. Respond with JSON: {{"read_aloud": "...", "analysis": "..."}}\n\n{user_content}'}]
            for b64 in images_b64:
                content.append({'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{b64}'}})
            messages = [{'role': 'system', 'content': BULLSHIT_DETECT_SYSTEM}, {'role': 'user', 'content': content}]
            model = os.getenv('OPENROUTER_CHAT_VISION_MODEL') or 'openai/gpt-4o-mini'
            timeout_sec = 60
        else:
            messages = [
                {'role': 'system', 'content': BULLSHIT_DETECT_SYSTEM},
                {'role': 'user', 'content': f'Analyze this document and respond with the required JSON.\n\n{user_content}'},
            ]
            model = request.form.get('model') or os.getenv('OPENROUTER_CHAT_MODEL') or 'openai/gpt-4o-mini'
            timeout_sec = 90

        data, usage = _run_bullshit_detect(messages, model, headers, timeout_sec)
        read_aloud, analysis = data['read_aloud'], data['analysis']

        out = {'read_aloud': read_aloud, 'analysis': analysis, 'usage': usage}
        if transcribed_text is not None:
            out['transcribed_text'] = transcribed_text

        if tts and (read_aloud or analysis):
            try:
                tts_provider = request.form.get('tts_provider') or None
                # Use short sarcastic summary for TTS when available
                tts_text = read_aloud if read_aloud else (analysis[:1000] if len(analysis) > 1000 else analysis)
                if len(tts_text) > 1000:
                    tts_text = tts_text[:tts_text.rfind(' ')].strip() if tts_text.rfind(' ') > 500 else tts_text[:1000]
                audio_bytes, audio_fmt = _text_to_speech(tts_text, voice, provider=tts_provider)
                out['audio_base64'] = base64.b64encode(audio_bytes).decode('utf-8')
                out['audio_format'] = audio_fmt
            except Exception as e:
                out['tts_error'] = str(e)

        return jsonify(out), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Network error: {str(e)}'}), 502
    except Exception as e:
        return jsonify({'error': f'Pipeline error: {str(e)}'}), 500


def _transcribe_audio(file_storage) -> str:
    """Transcribe audio file to text using Whisper."""
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError('OPENAI_API_KEY not configured')
    file_bytes = file_storage.read()
    file_like = io.BytesIO(file_bytes)
    client = OpenAI(api_key=api_key)
    transcription = client.audio.transcriptions.create(
        model='whisper-1',
        file=(file_storage.filename, file_like),
        response_format='text',
    )
    return transcription if isinstance(transcription, str) else transcription.text


OPENAI_VOICES = {'alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'fable', 'marin', 'nova', 'onyx', 'sage', 'shimmer', 'verse'}


def _text_to_speech(text: str, voice: str = 'coral', provider: str | None = None) -> tuple[bytes, str]:
    """Convert text to speech. Returns (audio_bytes, format). format is 'mp3' or 'wav'."""
    use_openai = (provider == 'openai') or (provider is None and voice in OPENAI_VOICES)
    if use_openai:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError('OPENAI_API_KEY not configured')
        client = OpenAI(api_key=api_key)
        response = client.audio.speech.create(
            model='tts-1-hd',
            voice=voice,
            input=text[:4096],
            response_format='mp3',
        )
        return (response.content, 'mp3')

    # Magic Hour (celebrity voices)
    from app.routes.voice import _generate_magic_hour
    api_key = os.getenv('MAGICHOUR_API_KEY')
    if not api_key:
        raise ValueError('MAGICHOUR_API_KEY not configured for Magic Hour voices')
    body, code = _generate_magic_hour(
        text[:4096],
        voice_name=voice,
        name='Chat Pipeline',
        api_key=api_key,
    )
    if code != 200:
        err = body.get_json() if hasattr(body, 'get_json') else {}
        msg = err.get('error', 'Magic Hour TTS failed')
        raise ValueError(str(msg))
    # Get bytes: use get_data() (Werkzeug) since .data may not be populated for Response(iterable)
    audio_bytes = body.get_data(as_text=False) if hasattr(body, 'get_data') else getattr(body, 'data', b'')
    if not audio_bytes:
        raise ValueError('Magic Hour returned no audio data')
    mimetype = (getattr(body, 'mimetype', None) or '').lower()
    fmt = 'mp3' if 'mpeg' in mimetype or 'mp3' in mimetype else 'wav'
    return (audio_bytes, fmt)


@bp.route('/chat/pipeline', methods=['POST'])
def chat_pipeline():
    """
    Integrated pipeline: Speech-to-Text -> Chat (text + images + video) -> Text-to-Speech.
    Accepts multipart: audio (optional), text (optional), images[] (optional), video (optional, for roast),
    messages (JSON), tts (bool), voice (str), mode ('assistant' | 'roast').
    """
    try:
        # Parse form data
        text = (request.form.get('text') or '').strip()
        messages_json = request.form.get('messages') or '[]'
        tts = request.form.get('tts', 'false').lower() in ('true', '1', 'yes')
        voice = request.form.get('voice') or 'coral'
        mode = request.form.get('mode') or 'assistant'

        # Step 1: Transcribe audio if present
        audio_file = request.files.get('audio') or request.files.get('file')
        transcribed_text = None
        if audio_file and audio_file.filename:
            transcribed = _transcribe_audio(audio_file)
            transcribed_text = transcribed
            text = f'{text} {transcribed}'.strip() if text else transcribed

        # Step 2: Get images (and PDF: first page converted to image)
        images_b64 = []
        for key in request.files:
            if key.startswith('images') or key == 'image':
                f = request.files[key]
                if not f or not f.filename:
                    continue
                ct = (f.content_type or '').strip().lower()
                fn = (f.filename or '').lower()
                if 'image' in ct:
                    images_b64.append(base64.b64encode(f.read()).decode('utf-8'))
                elif ct == 'application/pdf' or fn.endswith('.pdf'):
                    pdf_b64 = _pdf_first_page_to_base64(f.read())
                    if pdf_b64:
                        images_b64.append(pdf_b64)

        # Step 2b: Get video (single file, for roast); accept MOV (video/quicktime) and others
        video_b64 = ''
        video_mime = 'video/mp4'
        video_file = request.files.get('video')
        if video_file and video_file.filename:
            ct = (video_file.content_type or '').strip().lower()
            fn = (video_file.filename or '').lower()
            is_video = 'video' in ct or fn.endswith('.mov') or fn.endswith('.mp4') or fn.endswith('.webm') or fn.endswith('.mpeg') or fn.endswith('.mpeg4')
            if is_video:
                video_b64 = base64.b64encode(video_file.read()).decode('utf-8')
                video_mime = ct if ct and 'video' in ct else ('video/quicktime' if fn.endswith('.mov') else 'video/mp4')

        has_video = bool(video_b64)
        has_images = len(images_b64) > 0

        if not text and not has_images and not has_video:
            return jsonify({'error': 'Provide audio, text, at least one image, or a video'}), 400

        # Step 3: Build messages
        try:
            messages = json.loads(messages_json)
        except json.JSONDecodeError:
            messages = []

        user_content = text or ('(See video)' if has_video else '(See image)')
        # Remove any sentence from the user prompt that appears in the previous AI reply (echo/TTS overlap)
        last_assistant = next((m for m in reversed(messages) if m.get('role') == 'assistant'), None)
        if last_assistant and isinstance(last_assistant.get('content'), str):
            user_content = _remove_echo_sentences(user_content, last_assistant['content']) or user_content
        messages.append({'role': 'user', 'content': user_content})

        # Step 4: Call chat (reuse existing logic; support roast + video like chatbot)
        if mode == 'roast' and has_video:
            user_text = text if text and text not in ('(See video)', '(Video attached)', '(See image)', '(Image attached)') else None
            messages = _build_roast_messages_video(video_b64, video_mime, user_text)
            model = os.getenv('OPENROUTER_VIDEO_MODEL') or os.getenv('OPENROUTER_CHAT_VISION_MODEL') or 'google/gemini-2.5-flash'
        elif mode == 'roast' and has_images:
            user_text = text if text and text not in ('(See image)', '(Image attached)') else None
            messages = _build_roast_messages(images_b64, user_text)
            model = os.getenv('OPENROUTER_CHAT_VISION_MODEL') or 'openai/gpt-4o-mini'
        elif has_images:
            messages = _build_messages_with_images(messages, images_b64)
            model = os.getenv('OPENROUTER_CHAT_VISION_MODEL') or 'openai/gpt-4o-mini'
        else:
            model = request.form.get('model') or os.getenv('OPENROUTER_CHAT_MODEL') or 'openai/gpt-3.5-turbo'

        if mode == 'support':
            messages = [{'role': 'system', 'content': SUPPORT_SYSTEM}] + messages
        elif mode == 'assistant' and (has_images or has_video):
            personality = (request.form.get('personality') or request.form.get('custom_prompt') or '').strip()
            if personality:
                messages = [{'role': 'system', 'content': personality}] + messages

        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({'error': 'OPENROUTER_API_KEY not configured'}), 500

        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'HTTP-Referer': request.headers.get('Origin', ''),
            'X-Title': 'Hackathon Chat Pipeline',
        }

        timeout_sec = 120 if has_video else 60

        if mode == 'assistant' and not has_images and not has_video:
            # Assistant mode: optional user location (lat/lon) and library count (from page load)
            user_location = None
            try:
                lat_s = request.form.get('latitude', '').strip()
                lon_s = request.form.get('longitude', '').strip()
                if lat_s and lon_s:
                    lat, lon = float(lat_s), float(lon_s)
                    if -90 <= lat <= 90 and -180 <= lon <= 180:
                        user_location = _reverse_geocode(lat, lon)
            except (ValueError, TypeError):
                pass
            library_count_param = None
            try:
                lc = request.form.get('library_count', '').strip()
                if lc:
                    library_count_param = int(lc)
                    if library_count_param < 0:
                        library_count_param = None
            except (ValueError, TypeError):
                pass
            personality = (request.form.get('personality') or request.form.get('custom_prompt') or '').strip()
            source = (request.form.get('source') or '').strip().lower()
            system_prompt_base = VOICE_ASSISTANT_SYSTEM if source == 'voice-assistant' else None
            assistant_message, usage_merged = _chat_with_web_search(
                messages, model, headers, timeout_sec,
                personality_override=personality or None,
                user_location=user_location,
                library_count=library_count_param,
                system_prompt_base=system_prompt_base,
            )
            out = {'message': assistant_message, 'usage': usage_merged}
        else:
            response = requests.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers=headers,
                json={'model': model, 'messages': messages},
                timeout=timeout_sec,
            )
            if not response.ok:
                err = response.json() if response.content else {}
                msg = err.get('error', {})
                if isinstance(msg, dict):
                    msg = msg.get('message', response.reason)
                return jsonify({'error': str(msg)}), response.status_code
            result = response.json()
            assistant_message = ''
            if result.get('choices'):
                assistant_message = result['choices'][0].get('message', {}).get('content', '')
            if mode == 'support':
                assistant_message = _process_support_actions(assistant_message)
            out = {'message': assistant_message, 'usage': result.get('usage', {})}
        if transcribed_text is not None:
            out['transcribed_text'] = transcribed_text

        # Step 5: TTS if requested
        if tts and assistant_message:
            try:
                tts_provider = request.form.get('tts_provider') or None
                tts_text = assistant_message
                if tts_provider == 'magic_hour' and len(tts_text) > 1000:
                    tts_text = tts_text[:1000]
                    if tts_text[-1] not in ' .!?':
                        tts_text = (tts_text[:tts_text.rfind(' ')].strip() or tts_text) if ' ' in tts_text else tts_text
                audio_bytes, audio_fmt = _text_to_speech(tts_text, voice, provider=tts_provider)
                out['audio_base64'] = base64.b64encode(audio_bytes).decode('utf-8')
                out['audio_format'] = audio_fmt
            except Exception as e:
                out['tts_error'] = str(e)

        return jsonify(out), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 500
    except requests.RequestException as e:
        return jsonify({'error': f'Network/API error: {str(e)}'}), 502
    except Exception as e:
        return jsonify({'error': f'Pipeline error: {str(e)}'}), 500
