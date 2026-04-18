"""Default model IDs for OpenRouter. Override with OPENROUTER_CHAT_MODEL, OPENROUTER_CHAT_VISION_MODEL, OPENROUTER_VIDEO_MODEL, etc."""

# Gemini via OpenRouter — same slug works for text, vision, and video in this app
GEMINI_25_FLASH = "google/gemini-2.5-flash"

DEFAULT_CHAT_MODEL = GEMINI_25_FLASH
DEFAULT_VISION_MODEL = GEMINI_25_FLASH
DEFAULT_VIDEO_MODEL = GEMINI_25_FLASH
