import io
import pytest
from starlette.testclient import TestClient
from backend.app.engine.pdf_parser import MahaRERAPDFParser
from backend.app.main import app

client = TestClient(app)

SAMPLE_RERA_TEXT = """
MAHARASHTRA REAL ESTATE REGULATORY AUTHORITY
REGISTRATION CERTIFICATE OF PROJECT
This registration is granted under section 5 of the Real Estate (Regulation and Development) Act, 2016.
Project Registration Number: P52100018921
Project Name: Emerald Heights Phase 1
Promoter Name: Solitaire Infra Projects Private Limited
Proposed Date of Completion: 31/12/2027
Total Area of Land: 4500.0 sq.mtr
Sanctioned Built-up Area: 12500.0 sq.mtr
Total Carpet Area: 8500.0 sq.mtr
Total Floors: 15
Total Estimated Cost of Project: Rs. 42,50,00,000
"""

SAMPLE_LAYOUT_TEXT = """
Registration Number | P12345678901
Name of the Project
Riverstone Towers
Name of Promoter - Riverstone Builders Pvt Ltd
Revised Proposed Date of Completion
30 June 2027
Plot Area | 1,000 sq.m
FSI\t2,500 sq.ft
Carpet Area: 800 sq.ft
Number of Floors: G+10
Number of Basements | 2
Total Cost: INR 1,23,45,678
"""


def test_extract_from_rera_text():
    """Validates regex extraction from standard MahaRERA registration text."""
    draft = MahaRERAPDFParser.extract_from_text(SAMPLE_RERA_TEXT)

    assert draft.rera_registration_no == "P52100018921"
    assert draft.project_name == "Emerald Heights Phase 1"
    assert draft.promoter_name == "Solitaire Infra Projects Private Limited"
    assert draft.proposed_completion_date == "31/12/2027"
    assert draft.number_of_floors == 15
    assert draft.total_project_cost == 425000000.0

    # Locked Rule: Must require user review and confirmation
    assert draft.requires_user_confirmation is True
    assert draft.is_confirmed is False

    # Check sq.mt to sq.ft conversion: 12500 * 10.7639 = 134548.75 sqft
    assert draft.built_up_area_sqft is not None
    assert abs(draft.built_up_area_sqft - 134548.75) < 1.0


def test_area_unit_conversion():
    """Validates that square meters are properly converted to square feet, and sqft remains sqft."""
    text_sqm = "Sanctioned Built-up Area: 1000 sqm"
    draft_sqm = MahaRERAPDFParser.extract_from_text(text_sqm)
    assert abs(draft_sqm.built_up_area_sqft - 10763.9) < 1.0

    text_sqft = "Sanctioned Built-up Area: 50000 sqft"
    draft_sqft = MahaRERAPDFParser.extract_from_text(text_sqft)
    assert draft_sqft.built_up_area_sqft == 50000.0


def test_extracts_values_from_wrapped_and_table_layout_labels():
    draft = MahaRERAPDFParser.extract_from_text(SAMPLE_LAYOUT_TEXT)

    assert draft.rera_registration_no == "P12345678901"
    assert draft.project_name == "Riverstone Towers"
    assert draft.promoter_name == "Riverstone Builders Pvt Ltd"
    assert draft.proposed_completion_date == "30 June 2027"
    assert draft.plot_area_sqft == 10763.9
    assert draft.built_up_area_sqft == 2500.0
    assert draft.carpet_area_sqft == 800.0
    assert draft.number_of_floors == 11
    assert draft.number_of_basements == 2
    assert draft.total_project_cost == 12345678.0


def test_extracts_fields_from_muhurera_application_layout_fixture():
    text = """
    Project Name Paranjape Abhiruchi Parisar - T1, T2, M1A
    Project Status On-Going Project
    Organization Name Example Schemes PAN Number XXXXX0000X
    (Construction) Ltd Organization Type Company
    Proposed Date of Completion 31/12/2020
    Area(In sqmts) 26905.15
    TotalFSI 45734.82
    Number of Basement's 1
    Number of Slab of Super Structure 15
    3 Total Estimated Cost of the Real Estate Project 3555764622
    """

    draft = MahaRERAPDFParser.extract_from_text(text)

    assert draft.project_name == "Paranjape Abhiruchi Parisar - T1, T2, M1A"
    assert draft.promoter_name == "Example Schemes (Construction) Ltd"
    assert draft.proposed_completion_date == "31/12/2020"
    assert draft.plot_area_sqft == 289604.34
    assert draft.built_up_area_sqft == 492285.03
    assert draft.number_of_floors == 15
    assert draft.number_of_basements == 1
    assert draft.total_project_cost == 3555764622.0
    assert draft.requires_user_confirmation is True
    assert draft.is_confirmed is False


def test_generic_registration_title_is_not_project_name():
    draft = MahaRERAPDFParser.extract_from_text(
        "MahaRERA Application\nRegistration Certificate\nRegistration Number: P12345678901"
    )

    assert draft.project_name is None
    assert draft.confidence_scores["project_name"] == "NOT_FOUND"


def test_text_pdf_tables_are_flattened_for_label_matching():
    table_text = MahaRERAPDFParser._flatten_tables(
        [[
            ["Project Name", "Promoter Name", "Co-Promoter Type"],
            ["Riverstone Towers", "Other Promoter", "Company"],
        ]]
    )
    draft = MahaRERAPDFParser.extract_from_text("\n".join(table_text))

    assert draft.project_name == "Riverstone Towers"
    # Co-promoter table rows must not be treated as the project's promoter.
    assert draft.promoter_name is None


def test_unparseable_text_safe_fallback():
    """Unparseable or corrupted text yields graceful fallback with low confidence."""
    draft = MahaRERAPDFParser.extract_from_text("Corrupted binary data without any RERA tags")
    assert draft.rera_registration_no is None
    assert draft.requires_user_confirmation is True
    assert draft.is_confirmed is False


def test_confirm_rera_draft_endpoint():
    """Verifies that user can review, modify, and confirm pre-filled values."""
    payload = {
        "project_name": "Emerald Heights Phase 1 (Confirmed)",
        "rera_registration_no": "P52100018921",
        "promoter_name": "Solitaire Infra",
        "proposed_completion_date": "31/12/2027",
        "plot_area_sqft": 48437.55,
        "built_up_area_sqft": 134548.75,
        "carpet_area_sqft": 91493.15,
        "number_of_floors": 15,
        "number_of_basements": 1,
        "total_project_cost": 425000000.0,
        "user_notes": "Allottee handover date verified against Annexure B",
    }
    resp = client.post("/api/v1/rera/confirm", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "CONFIRMED"
    assert data["project_name"] == "Emerald Heights Phase 1 (Confirmed)"
    assert data["confirmed_data"]["number_of_floors"] == 15


from unittest.mock import MagicMock, patch


def test_parse_text_pdf_prefills_only():
    """Text PDF extracts fields accurately; strictly PRE-FILLS form without saving to DB."""
    with patch("pdfplumber.open") as mock_plumber:
        mock_pdf = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = SAMPLE_RERA_TEXT
        mock_pdf.pages = [mock_page]
        mock_plumber.return_value.__enter__.return_value = mock_pdf

        draft = MahaRERAPDFParser.parse_pdf_bytes(b"%PDF-1.4 sample valid text pdf content")
        assert draft.rera_registration_no == "P52100018921"
        assert draft.project_name == "Emerald Heights Phase 1"
        assert draft.requires_user_confirmation is True
        assert draft.is_confirmed is False


def test_parse_scanned_pdf_triggers_ocr_fallback():
    """When pdfplumber returns almost no text, OCR fallback renders pages and parses text."""
    with patch("pdfplumber.open") as mock_plumber:
        mock_pdf = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = ""  # Scanned image with no text layer
        mock_pdf.pages = [mock_page]
        mock_plumber.return_value.__enter__.return_value = mock_pdf

        with patch.object(MahaRERAPDFParser, "_run_ocr_fallback", return_value=SAMPLE_RERA_TEXT) as mock_ocr:
            draft = MahaRERAPDFParser.parse_pdf_bytes(b"%PDF-1.4 scanned image pdf bytes")
            mock_ocr.assert_called_once()
            assert draft.rera_registration_no == "P52100018921"
            assert draft.requires_user_confirmation is True
            assert draft.is_confirmed is False


def test_short_text_attempts_ocr_and_returns_manual_entry_when_unavailable():
    with patch("pdfplumber.open") as mock_plumber:
        mock_pdf = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "short text under threshold"
        mock_pdf.pages = [mock_page]
        mock_plumber.return_value.__enter__.return_value = mock_pdf

        with patch("backend.app.engine.pdf_parser.PdfReader", side_effect=Exception("bad PDF")):
            with patch.object(MahaRERAPDFParser, "_run_ocr_fallback", return_value="") as mock_ocr:
                draft = MahaRERAPDFParser.parse_pdf_bytes(b"short-pdf-bytes")

    mock_ocr.assert_called_once()
    assert draft.project_name is None
    assert "enter details manually" in draft.raw_text_snippet.lower()
    assert draft.requires_user_confirmation is True
    assert draft.is_confirmed is False

    # When OCR also fails, returns empty draft with NOT_FOUND confidence without crashing
    with patch("pdfplumber.open") as mock_plumber:
        mock_pdf = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = ""
        mock_pdf.pages = [mock_page]
        mock_plumber.return_value.__enter__.return_value = mock_pdf

        with patch.object(MahaRERAPDFParser, "_run_ocr_fallback", return_value=""):
            draft = MahaRERAPDFParser.parse_pdf_bytes(b"%PDF-1.4 scanned image unreadable")
            assert draft.confidence_scores.get("all") == "NOT_FOUND"
            assert draft.project_name is None
            assert draft.requires_user_confirmation is True
            assert draft.is_confirmed is False


def test_parse_corrupt_file_never_crashes():
    """Corrupt or malformed bytes never crash the parser; returns empty draft with NOT_FOUND."""
    corrupt_bytes = b"CORRUPTED_GARBAGE_BYTES_#$!@#%NOT_A_VALID_PDF_STRUCTURE"
    draft = MahaRERAPDFParser.parse_pdf_bytes(corrupt_bytes)
    assert draft is not None
    assert draft.confidence_scores.get("all") == "NOT_FOUND"
    assert draft.project_name is None
    assert draft.requires_user_confirmation is True
    assert draft.is_confirmed is False
