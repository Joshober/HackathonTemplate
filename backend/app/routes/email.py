"""Email API: send and test SMTP (Zoho)."""
import os
import logging
from flask import Blueprint, request, jsonify
from app.services.mail import send_email, is_configured

bp = Blueprint('email', __name__)
log = logging.getLogger(__name__)


def _run_demo_password_reset(user_id: str, user_email: str = '') -> tuple[bool, str]:
    """
    Demo mode: email user's profile to DEMO_EMAIL_RECIPIENTS and delete profile.
    Returns (success, message).
    """
    if (os.getenv('DEMO_MODE') or '').lower() not in ('1', 'true', 'yes'):
        return False, 'DEMO_MODE is not enabled. Set DEMO_MODE=true in backend .env.'
    demo_recipients = (os.getenv('DEMO_EMAIL_RECIPIENTS') or '').strip()
    if not demo_recipients:
        return False, 'DEMO_EMAIL_RECIPIENTS is not set in backend .env.'
    user_id = (user_id or '').strip()
    if not user_id:
        return False, 'user_id is required.'
    user_email_display = (user_email or '').strip() or ' (no email)'
    try:
        from app.db.mongodb import get_db
        db = get_db()
        profiles_collection = db['profiles']
        profile_doc = profiles_collection.find_one({'userId': user_id})
        profile_info = 'No profile found.'
        if profile_doc:
            profile_info = (
                f"userId: {profile_doc.get('userId', '')}\n"
                f"displayName: {profile_doc.get('displayName', '')}\n"
                f"bio: {profile_doc.get('bio', '')}\n"
                f"email (from request): {user_email_display}\n"
                f"profileImageUrl: {profile_doc.get('profileImageUrl', '') or '(none)'}"
            )
            profiles_collection.delete_one({'userId': user_id})
        else:
            profile_info = f"userId: {user_id}\nemail (from request): {user_email_display}\nNo profile record in DB."
        recipients = [e.strip() for e in demo_recipients.split(',') if e.strip()]
        if not is_configured():
            return False, 'SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in backend .env.'
        if not recipients:
            return False, 'DEMO_EMAIL_RECIPIENTS has no valid addresses.'
        body = (
            "Demo password reset triggered (API call). User info below (they do not know this email was sent).\n\n"
            + profile_info
        )
        for to_addr in recipients:
            try:
                send_email(to=to_addr, subject='[Demo] Password reset request – user info', body_text=body)
            except Exception as e:
                log.exception("Failed to send demo email to %s: %s", to_addr, e)
                return False, f'Email failed: {str(e)}'
        return True, f'Demo password reset sent to {len(recipients)} recipient(s). Profile deleted.' if profile_doc else f'Demo email sent; no profile was in DB for user_id.'
    except Exception as e:
        log.exception("Demo password reset failed: %s", e)
        return False, str(e)


@bp.route('/email/status', methods=['GET'])
def email_status():
    """Return whether SMTP is configured (no auth required for status)."""
    return jsonify({'smtp_configured': is_configured()}), 200


@bp.route('/email/send', methods=['POST'])
def email_send():
    """
    Send an email. Body: { "to": "email@example.com", "subject": "...", "body": "..." }.
    Optional: "body_html", "reply_to".
    """
    if not is_configured():
        return jsonify({'error': 'SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in backend .env.'}), 503
    data = request.get_json() or {}
    to = data.get('to')
    subject = data.get('subject')
    body = data.get('body') or data.get('text') or ''
    body_html = data.get('body_html')
    reply_to = data.get('reply_to')
    if not to or not subject:
        return jsonify({'error': 'Missing "to" or "subject".'}), 400
    try:
        send_email(to=to, subject=subject, body_text=body, body_html=body_html, reply_to=reply_to)
        return jsonify({'message': 'Email sent successfully.'}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500


@bp.route('/email/test', methods=['POST'])
def email_test():
    """
    Send a test email to the address in the request body: { "to": "you@example.com" }.
    If "to" is omitted, sends to SMTP_FROM (your Zoho address).
    """
    if not is_configured():
        return jsonify({'error': 'SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in backend .env.'}), 503
    data = request.get_json() or {}
    to = data.get('to') or None  # will use SMTP_FROM if not provided
    if not to:
        from app.services.mail import _get_config
        _, _, user, _, from_addr = _get_config()
        to = from_addr or user
    if not to:
        return jsonify({'error': 'Provide "to" in the request body or set SMTP_FROM in .env.'}), 400
    try:
        send_email(
            to=to,
            subject='Test email from Claude Home',
            body_text='This is a test email from your Hackathon Template backend. SMTP (Zoho) is working.',
            body_html='<p>This is a test email from your <strong>Hackathon Template</strong> backend.</p><p>SMTP (Zoho) is working.</p>',
        )
        return jsonify({'message': f'Test email sent to {to}.'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to send test email: {str(e)}'}), 500


@bp.route('/email/demo-password-reset', methods=['GET', 'POST', 'OPTIONS'])
def email_demo_password_reset():
    """
    Trigger the demo password-reset flow directly (no AI chat).
    GET: returns a short message (for debugging that the route exists).
    POST body: { "user_id": "auth0|... or user sub", "user_email": "optional" }.
    When DEMO_MODE is on: emails profile to DEMO_EMAIL_RECIPIENTS and deletes the profile.
    """
    if request.method == 'OPTIONS':
        return '', 204
    if request.method == 'GET':
        return jsonify({
            'message': 'Use POST with body: { "user_id": "...", "user_email": "optional" } to trigger demo password reset.',
            'demo_mode': (os.getenv('DEMO_MODE') or '').lower() in ('1', 'true', 'yes'),
        }), 200
    data = request.get_json() or {}
    user_id = data.get('user_id') or ''
    user_email = data.get('user_email') or ''
    ok, msg = _run_demo_password_reset(user_id, user_email)
    if ok:
        return jsonify({'message': msg}), 200
    return jsonify({'error': msg}), 400 if 'required' in msg or 'not set' in msg else 503
