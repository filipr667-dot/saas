"""
Training certificate PDF generator using ReportLab.
Generates a professional A4 certificate for a completed training record.
"""
import io
from datetime import datetime, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.pdfgen import canvas as pdfcanvas


# ── Colour palette matching the app's teal/slate theme ──
TEAL       = colors.HexColor("#0F766E")   # teal-700
SLATE_900  = colors.HexColor("#0F172A")
SLATE_700  = colors.HexColor("#334155")
SLATE_400  = colors.HexColor("#94A3B8")
SLATE_100  = colors.HexColor("#F1F5F9")
WHITE      = colors.white


def _fmt_dt(iso: str) -> str:
    """Format ISO timestamp to readable string."""
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d %b %Y  %H:%M:%S UTC")
    except Exception:
        return iso


def generate_training_certificate(record: dict) -> bytes:
    """Return raw PDF bytes for a completed training record."""
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Training Certificate — {record.get('document_number', '')}",
    )

    W = A4[0] - 40 * mm   # usable width
    story = []

    # ── Header bar (teal background) ──────────────────────
    header_data = [[
        Paragraph(
            '<font color="white" size="18"><b>Training Certificate</b></font>',
            ParagraphStyle("hdr", fontName="Helvetica-Bold", fontSize=18,
                           textColor=WHITE, alignment=TA_LEFT),
        ),
        Paragraph(
            '<font color="white" size="9">Document Control Management System</font>',
            ParagraphStyle("sub", fontName="Helvetica", fontSize=9,
                           textColor=WHITE, alignment=TA_LEFT),
        ),
    ]]
    header_table = Table(header_data, colWidths=[W * 0.6, W * 0.4])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING",   (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 14),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8 * mm))

    # ── Logo placeholder ──────────────────────────────────
    logo_data = [[
        Paragraph(
            '<font color="#94A3B8" size="9">[ Company Logo ]</font>',
            ParagraphStyle("logo", fontName="Helvetica", fontSize=9,
                           textColor=SLATE_400, alignment=TA_CENTER),
        )
    ]]
    logo_table = Table(logo_data, colWidths=[W])
    logo_table.setStyle(TableStyle([
        ("BOX",        (0, 0), (-1, -1), 1, SLATE_400),
        ("BACKGROUND", (0, 0), (-1, -1), SLATE_100),
        ("TOPPADDING",    (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(logo_table)
    story.append(Spacer(1, 8 * mm))

    # ── Certify statement ─────────────────────────────────
    styles = getSampleStyleSheet()

    story.append(Paragraph(
        "This is to certify that",
        ParagraphStyle("cert_lbl", fontName="Helvetica", fontSize=11,
                       textColor=SLATE_700, alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph(
        f'<b>{record.get("user_name", "Unknown")}</b>',
        ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=22,
                       textColor=SLATE_900, alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph(
        "has successfully completed training and sign-off on the following document:",
        ParagraphStyle("cert_body", fontName="Helvetica", fontSize=11,
                       textColor=SLATE_700, alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 8 * mm))

    # ── Document details table ────────────────────────────
    doc_rows = [
        ["Document Number", record.get("document_number", "—")],
        ["Document Title",  record.get("document_title", "—")],
        ["Document Type",   record.get("doc_type", "—")],
        ["Revision",        str(record.get("document_rev", "—"))],
    ]

    label_style = ParagraphStyle("lbl", fontName="Helvetica-Bold", fontSize=10,
                                  textColor=SLATE_700)
    value_style = ParagraphStyle("val", fontName="Helvetica", fontSize=10,
                                  textColor=SLATE_900)

    table_data = [
        [Paragraph(row[0], label_style), Paragraph(row[1], value_style)]
        for row in doc_rows
    ]

    doc_table = Table(table_data, colWidths=[W * 0.35, W * 0.65])
    doc_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), SLATE_100),
        ("BACKGROUND", (1, 0), (1, -1), WHITE),
        ("BOX",        (0, 0), (-1, -1), 0.5, SLATE_400),
        ("INNERGRID",  (0, 0), (-1, -1), 0.5, SLATE_400),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING",   (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 7),
    ]))
    story.append(doc_table)
    story.append(Spacer(1, 8 * mm))

    # ── Divider ───────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceAfter=6 * mm))

    # ── Signature block ───────────────────────────────────
    sig = record.get("signature", {}) or {}
    completed_at = record.get("completed_at", "")

    sig_rows = [
        ["Signed off by",   sig.get("user_name", record.get("user_name", "—"))],
        ["Date & Time",     _fmt_dt(completed_at)],
        ["IP Address",      sig.get("ip_address", "—")],
    ]
    if sig.get("comments"):
        sig_rows.append(["Comments", sig["comments"]])

    sig_data = [
        [Paragraph(row[0], label_style), Paragraph(row[1], value_style)]
        for row in sig_rows
    ]

    sig_table = Table(sig_data, colWidths=[W * 0.35, W * 0.65])
    sig_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), SLATE_100),
        ("BACKGROUND", (1, 0), (1, -1), WHITE),
        ("BOX",        (0, 0), (-1, -1), 0.5, SLATE_400),
        ("INNERGRID",  (0, 0), (-1, -1), 0.5, SLATE_400),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING",   (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 7),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 10 * mm))

    # ── Footer ────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=SLATE_400, spaceAfter=4 * mm))
    story.append(Paragraph(
        "This certificate was generated automatically by the Document Control Management System. "
        "This is an official electronic training record.",
        ParagraphStyle("footer", fontName="Helvetica", fontSize=8,
                       textColor=SLATE_400, alignment=TA_CENTER),
    ))

    doc.build(story)
    return buf.getvalue()
