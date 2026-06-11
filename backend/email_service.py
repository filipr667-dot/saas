import os
import asyncio
import logging
import resend

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str):
    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key or api_key.startswith("re_placeholder"):
        logger.info(f"Email skipped (no valid API key): {subject} → {to}")
        return
    try:
        resend.api_key = api_key
        sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        params = {"from": sender, "to": [to], "subject": subject, "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent: {subject} → {to}")
        return result
    except Exception as e:
        logger.error(f"Email error: {e}")


def build_training_email(doc_number: str, title: str, doc_type: str, user_name: str, link: str) -> str:
    return f"""
    <div style="font-family:'IBM Plex Sans',Arial,sans-serif;max-width:600px;margin:0 auto;color:#09090b;">
      <div style="background:#18181b;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fafafa;margin:0;font-size:18px;font-weight:600;">Training Required</h2>
      </div>
      <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <p style="font-size:13px;color:#52525b;margin:0 0 16px;">Hi {user_name}, a new document requires your sign-off.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px;background:#f4f4f5;font-size:12px;color:#71717a;width:140px;">Document Number</td>
              <td style="padding:8px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;">{doc_number}</td></tr>
          <tr><td style="padding:8px;background:#f4f4f5;font-size:12px;color:#71717a;">Title</td>
              <td style="padding:8px;font-size:13px;">{title}</td></tr>
          <tr><td style="padding:8px;background:#f4f4f5;font-size:12px;color:#71717a;">Type</td>
              <td style="padding:8px;font-size:13px;">{doc_type}</td></tr>
          <tr><td style="padding:8px;background:#f4f4f5;font-size:12px;color:#71717a;">Action Required</td>
              <td style="padding:8px;font-size:13px;font-weight:600;color:#16a34a;">Sign Off on Training</td></tr>
        </table>
        <a href="{link}" style="display:inline-block;background:#18181b;color:#fafafa;padding:10px 20px;
           text-decoration:none;border-radius:6px;font-size:13px;font-weight:500;">Go to My Training</a>
        <p style="font-size:11px;color:#a1a1aa;margin-top:24px;">
          This is an automated notification from the Document Control Management System.
        </p>
      </div>
    </div>"""


def build_asset_notification_email(asset: dict) -> str:
    rows = [
        ("Asset ID",           asset.get("asset_id", "—")),
        ("Name / Model",       asset.get("name", "—")),
        ("Serial Number",      asset.get("serial_number") or "—"),
        ("Supplier",           asset.get("supplier") or "—"),
        ("Calibration",        "Required" if asset.get("calibration_required") else "Not Required"),
        ("Last Calibration",   asset.get("last_calibration_date") or "—"),
        ("Calibration Due",    asset.get("calibration_due_date") or "—"),
    ]
    rows_html = "".join(
        f'<tr><td style="padding:8px;background:#f4f4f5;font-size:12px;color:#71717a;width:160px;">{k}</td>'
        f'<td style="padding:8px;font-size:13px;">{v}</td></tr>'
        for k, v in rows
    )
    return f"""
    <div style="font-family:'IBM Plex Sans',Arial,sans-serif;max-width:600px;margin:0 auto;color:#09090b;">
      <div style="background:#0f766e;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#ffffff;margin:0;font-size:18px;font-weight:600;">Asset Registered</h2>
        <p style="color:#ccfbf1;margin:4px 0 0;font-size:13px;">Automatic calibration reminder</p>
      </div>
      <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">{rows_html}</table>
        <p style="font-size:13px;color:#52525b;margin:0 0 8px;">
          Please arrange calibration activity as required.
        </p>
        <p style="font-size:12px;color:#a1a1aa;margin-top:16px;font-style:italic;">
          Thank you,<br/>Quality Team
        </p>
        <p style="font-size:11px;color:#a1a1aa;margin-top:24px;">
          This is an automated notification from the Document Control Management System.
        </p>
      </div>
    </div>"""


def build_calibration_reminder_email(asset: dict) -> str:
    rows = [
        ("Asset ID",           asset.get("asset_id", "—")),
        ("Name / Model",       asset.get("name", "—")),
        ("Serial Number",      asset.get("serial_number") or "—"),
        ("Supplier",           asset.get("supplier") or "—"),
        ("Last Calibration",   asset.get("last_calibration_date") or "—"),
        ("Calibration Due",    asset.get("calibration_due_date") or "—"),
    ]
    rows_html = "".join(
        f'<tr><td style="padding:8px;background:#f4f4f5;font-size:12px;color:#71717a;width:160px;">{k}</td>'
        f'<td style="padding:8px;font-size:13px;">{v}</td></tr>'
        for k, v in rows
    )
    return f"""
    <div style="font-family:'IBM Plex Sans',Arial,sans-serif;max-width:600px;margin:0 auto;color:#09090b;">
      <div style="background:#0f766e;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#ffffff;margin:0;font-size:18px;font-weight:600;">Calibration Updated</h2>
        <p style="color:#ccfbf1;margin:4px 0 0;font-size:13px;">Automatic calibration reminder</p>
      </div>
      <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">{rows_html}</table>
        <p style="font-size:13px;color:#52525b;margin:0 0 8px;">
          Please arrange calibration activity as required.
        </p>
        <p style="font-size:12px;color:#a1a1aa;margin-top:16px;font-style:italic;">
          Thank you,<br/>Quality Team
        </p>
        <p style="font-size:11px;color:#a1a1aa;margin-top:24px;">
          This is an automated notification from the Document Control Management System.
        </p>
      </div>
    </div>"""


def build_doc_email(doc_number: str, title: str, status: str, action: str, link: str) -> str:
    return f"""
    <div style="font-family:'IBM Plex Sans',Arial,sans-serif;max-width:600px;margin:0 auto;color:#09090b;">
      <div style="background:#18181b;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fafafa;margin:0;font-size:18px;font-weight:600;">Document Control System</h2>
      </div>
      <div style="border:1px solid #e4e4e7;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <p style="font-size:13px;color:#52525b;margin:0 0 16px;">Action required on a document assigned to you.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px;background:#f4f4f5;font-size:12px;color:#71717a;width:140px;">Document Number</td>
              <td style="padding:8px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;">{doc_number}</td></tr>
          <tr><td style="padding:8px;background:#f4f4f5;font-size:12px;color:#71717a;">Title</td>
              <td style="padding:8px;font-size:13px;">{title}</td></tr>
          <tr><td style="padding:8px;background:#f4f4f5;font-size:12px;color:#71717a;">Status</td>
              <td style="padding:8px;font-size:13px;">{status}</td></tr>
          <tr><td style="padding:8px;background:#f4f4f5;font-size:12px;color:#71717a;">Action Required</td>
              <td style="padding:8px;font-size:13px;font-weight:600;">{action}</td></tr>
        </table>
        <a href="{link}" style="display:inline-block;background:#18181b;color:#fafafa;padding:10px 20px;
           text-decoration:none;border-radius:6px;font-size:13px;font-weight:500;">View Document</a>
        <p style="font-size:11px;color:#a1a1aa;margin-top:24px;">
          This is an automated notification from the Document Control Management System.
        </p>
      </div>
    </div>"""
