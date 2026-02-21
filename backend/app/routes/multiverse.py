"""
POST /api/multiverse/analyze — image → truth + roast (Confidently Wrong Roast AI).
Local (Ollama) first for both phases; OpenRouter fallback. Returns truth_source, roast_source, latencies.
"""
import base64
import os
import requests
from flask import Blueprint, request, jsonify
from app.services.vision_truth import extract_truth
from app.services.roast import generate_roast
from app.utils.json_repair import JSON_PARSE_FAILED

CONNECTION_ERROR_MSG = (
    "Connection to OpenRouter timed out or failed. "
    "Run Ollama locally (ollama serve, ollama pull llama3.2-vision, ollama pull llama3.2) to use Roast AI without internet, or check your network."
)

bp = Blueprint("multiverse", __name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[-1].lower() in ALLOWED_EXTENSIONS


@bp.route("/analyze", methods=["POST"])
def analyze():
    """Roast AI: local (Ollama) first for Truth + Roast; OpenRouter only as fallback."""
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400
    file = request.files["image"]
    if not file or file.filename == "":
        return jsonify({"error": "No image selected"}), 400
    if not allowed_file(file.filename or ""):
        return jsonify({"error": "Invalid image type. Use png, jpg, jpeg, gif, or webp."}), 400

    try:
        image_bytes = file.read()
    except Exception as e:
        return jsonify({"error": f"Failed to read image: {str(e)}"}), 400
    if not image_bytes:
        return jsonify({"error": "Image file is empty"}), 400
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    # Fase 1: Truth (local first, fallback OpenRouter)
    try:
        truth, truth_source, latency_ms_truth = extract_truth(image_base64)
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
        return jsonify({"error": CONNECTION_ERROR_MSG}), 502
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
    except ValueError as e:
        msg = str(e)
        if msg == JSON_PARSE_FAILED or "Return valid JSON" in msg:
            msg = "The vision model returned invalid data. Please try again or use a different image."
        return jsonify({"error": msg}), 500
    except Exception as e:
        err_msg = str(e)
        if "timed out" in err_msg.lower() or "Connection" in err_msg or "openrouter" in err_msg.lower():
            return jsonify({"error": CONNECTION_ERROR_MSG}), 502
        return jsonify({"error": f"Truth extraction failed: {err_msg}"}), 500

    # Fase 2: Roast (local Ollama first, fallback OpenRouter)
    try:
        roast_data, latency_ms_roast, roast_source = generate_roast(
            truth["truth_caption"],
            truth["truth_objects"],
            truth["scene_type"],
        )
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
        return jsonify({"error": CONNECTION_ERROR_MSG}), 502
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
    except ValueError as e:
        msg = str(e)
        if msg == JSON_PARSE_FAILED or "Return valid JSON" in msg:
            msg = "The roast model returned invalid data. Please try again."
        return jsonify({"error": msg}), 500
    except Exception as e:
        err_msg = str(e)
        if "timed out" in err_msg.lower() or "Connection" in err_msg or "openrouter" in err_msg.lower():
            return jsonify({"error": CONNECTION_ERROR_MSG}), 502
        return jsonify({"error": f"Roast failed: {err_msg}"}), 500

    return jsonify({
        "truth": truth,
        "roast": roast_data.get("roast", ""),
        "truth_source": truth_source,
        "roast_source": roast_source,
        "latency_ms_truth": round(latency_ms_truth, 0),
        "latency_ms_roast": round(latency_ms_roast, 0),
    }), 200
