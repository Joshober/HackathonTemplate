"""
Test SMTP (Zoho) configuration by sending a test email.

Run from backend (PowerShell):
  cd backend; $env:PYTHONPATH = (Get-Location).Path; python scripts/test_smtp.py

Optional: pass recipient as first arg:
  python scripts/test_smtp.py you@example.com
"""
import os
import sys
from pathlib import Path

# Load .env from backend directory
backend_dir = Path(__file__).resolve().parent.parent
env_path = backend_dir / '.env'
if not env_path.exists():
    print(f"ERROR: .env not found at {env_path}")
    sys.exit(1)

import dotenv
dotenv.load_dotenv(env_path)

# Import after env is loaded
from app.services.mail import is_configured, send_email, _get_config


def main():
    print("SMTP test")
    print("-" * 40)

    if not is_configured():
        print("FAIL: SMTP is not configured.")
        print("Set SMTP_USER and SMTP_PASSWORD in backend/.env")
        sys.exit(1)

    host, port, user, _, from_addr = _get_config()
    print(f"Host: {host}:{port}")
    print(f"From: {from_addr or user}")
    print()

    default_to = "Jobersteadt@outlook.com"
    to = (sys.argv[1] if len(sys.argv) > 1 else None) or default_to or from_addr or user
    if not to:
        print("FAIL: No recipient. Set SMTP_FROM in .env or pass: python scripts/test_smtp.py you@example.com")
        sys.exit(1)

    print(f"Sending test email to: {to}")
    try:
        send_email(
            to=to,
            subject="SMTP test – Hackathon Template",
            body_text="This is a test email. Your SMTP (Zoho) configuration is working.",
            body_html="<p>This is a test email.</p><p>Your SMTP (Zoho) configuration is working.</p>",
        )
        print("OK: Test email sent successfully. Check the inbox (and spam) for", to)
    except Exception as e:
        print(f"FAIL: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
