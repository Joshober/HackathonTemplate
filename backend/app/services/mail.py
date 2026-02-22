"""
SMTP mail service configured for Zoho Mail.
Uses env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM (optional).
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional


def _get_config():
    host = os.getenv('SMTP_HOST', 'smtp.zoho.com')
    port = int(os.getenv('SMTP_PORT', '587'))
    user = os.getenv('SMTP_USER')
    password = os.getenv('SMTP_PASSWORD')
    from_addr = os.getenv('SMTP_FROM') or user
    return host, port, user, password, from_addr


def is_configured() -> bool:
    """Return True if SMTP is configured (user and password set)."""
    _, _, user, password, _ = _get_config()
    return bool(user and password)


def send_email(
    to: str | List[str],
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> None:
    """
    Send an email via Zoho SMTP.
    :param to: Recipient email or list of recipients
    :param subject: Subject line
    :param body_text: Plain text body
    :param body_html: Optional HTML body
    :param reply_to: Optional Reply-To header
    :raises ValueError: If SMTP is not configured or missing params
    :raises smtplib.SMTPException: On send failure
    """
    host, port, user, password, from_addr = _get_config()
    if not user or not password:
        raise ValueError('SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in .env.')
    to_list = [to] if isinstance(to, str) else to
    if not to_list:
        raise ValueError('At least one recipient is required.')

    use_ssl = port == 465
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = from_addr
    msg['To'] = ', '.join(to_list)
    if reply_to:
        msg['Reply-To'] = reply_to

    msg.attach(MIMEText(body_text, 'plain'))
    if body_html:
        msg.attach(MIMEText(body_html, 'html'))

    if use_ssl:
        with smtplib.SMTP_SSL(host, port) as server:
            server.login(user, password)
            server.sendmail(from_addr, to_list, msg.as_string())
    else:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_addr, to_list, msg.as_string())
