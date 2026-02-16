# Legacy auth functions - now using auth_backend.py
# This file is kept for backward compatibility
from app.routes.auth_backend import (
    require_auth,
    get_user_id_from_request as get_user_id_from_token,
    get_user_info_from_request as get_user_info_from_token
)
