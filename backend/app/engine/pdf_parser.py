import io
import re
from typing import Dict, Optional, Tuple
import pdfplumber
from pypdf import PdfReader

from backend.app.schemas.pdf_parser import MahaRERAPreFillDraft


class MahaRERAPDFParser:
    """
    Parses MahaRERA registration certificates and Form reports to pre-fill
    project setup forms.
    LOCKED RULE: Output is an unconfirmed draft. User must review and confirm.
    """

    @classmethod
    def _run_ocr_fallback(cls, pdf_bytes: bytes) -> str:
        """
        Renders PDF pages to images using pypdfium2 and runs pytesseract OCR.
        OCR libraries are imported lazily inside this method to conserve memory on 512 MB RAM environments.
        """
        try:
            import pypdfium2 as pdfium
            import pytesseract

            pdf = pdfium.PdfDocument(pdf_bytes)
            ocr_text_parts = []
            max_pages = min(len(pdf), 3)
            for i in range(max_pages):
                page = pdf[i]
                bitmap = page.render(scale=1.5)
                pil_image = bitmap.to_pil()
                text = pytesseract.image_to_string(pil_image)
                if text:
                    ocr_text_parts.append(text)
            return "\n".join(ocr_text_parts).strip()
        except Exception:
            return ""

    @classmethod
    def parse_pdf_bytes(cls, pdf_bytes: bytes) -> MahaRERAPreFillDraft:
        extracted_text = ""

        try:
            # 1. Primary extractor: pdfplumber
            try:
                with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                    pages_text = [page.extract_text() or "" for page in pdf.pages]
                    extracted_text = "\n".join(pages_text).strip()
            except Exception:
                extracted_text = ""

            # 2. Fallback text extractor: pypdf if almost no text returned
            if len(extracted_text) < 30:
                try:
                    reader = PdfReader(io.BytesIO(pdf_bytes))
                    pages_text = [p.extract_text() or "" for p in reader.pages]
                    pypdf_text = "\n".join(pages_text).strip()
                    if len(pypdf_text) > len(extracted_text):
                        extracted_text = pypdf_text
                except Exception:
                    pass

            # 3. OCR Fallback: if pdfplumber/pypdf return almost no text (e.g. scanned document)
            if len(extracted_text) < 30:
                ocr_text = cls._run_ocr_fallback(pdf_bytes)
                if len(ocr_text) > len(extracted_text):
                    extracted_text = ocr_text

            if not extracted_text or len(extracted_text.strip()) < 10:
                return MahaRERAPreFillDraft(
                    project_name=None,
                    rera_registration_no=None,
                    promoter_name=None,
                    proposed_completion_date=None,
                    plot_area_sqft=None,
                    built_up_area_sqft=None,
                    carpet_area_sqft=None,
                    number_of_floors=None,
                    number_of_basements=None,
                    total_project_cost=None,
                    confidence_scores={"all": "NOT_FOUND"},
                    raw_text_snippet="Could not extract machine-readable text from uploaded PDF. Please fill the form manually.",
                    requires_user_confirmation=True,
                    is_confirmed=False,
                )

            return cls.extract_from_text(extracted_text)
        except Exception as e:
            # If parsing completely fails (e.g. corrupt file), return empty draft with NOT_FOUND. Never crash.
            return MahaRERAPreFillDraft(
                project_name=None,
                rera_registration_no=None,
                promoter_name=None,
                proposed_completion_date=None,
                plot_area_sqft=None,
                built_up_area_sqft=None,
                carpet_area_sqft=None,
                number_of_floors=None,
                number_of_basements=None,
                total_project_cost=None,
                confidence_scores={"all": "NOT_FOUND"},
                raw_text_snippet=f"Parsing error: {str(e)}. Please fill the form manually.",
                requires_user_confirmation=True,
                is_confirmed=False,
            )

    @classmethod
    def extract_from_text(cls, text: str) -> MahaRERAPreFillDraft:
        confidence: Dict[str, str] = {}

        # 1. RERA Registration / Application Number (e.g. P52100018921 or REA50500000459 or P51800001234)
        rera_match = re.search(r"\b(P5[0-9]{9,10}|REA[0-9]{8,15})\b", text, re.IGNORECASE)
        if not rera_match:
            rera_match = re.search(
                r"(?:Application\s*No\.?|Registration\s*No\.?|Certificate\s*No\.?)\s*[:\-]?\s*([A-Za-z0-9]+)",
                text,
                re.IGNORECASE,
            )
        rera_no = rera_match.group(1).upper() if rera_match else None
        confidence["rera_registration_no"] = "HIGH" if rera_no else "NOT_FOUND"

        # 2. Project Name
        proj_match = re.search(
            r"(?:Project\s+Name|Name\s+of\s+Project)\s*[:\-]?\s*([^\n\r]+?)(?:\s+(?:Project\s+Status|Project\s+Type|Revised|Litigations)|[\n\r]|$)",
            text,
            re.IGNORECASE,
        )
        if proj_match and len(proj_match.group(1).strip()) > 1:
            project_name = proj_match.group(1).strip()
            confidence["project_name"] = "HIGH"
        else:
            # Fallback heuristic: First capitalized title line
            first_lines = [l.strip() for l in text.splitlines() if len(l.strip()) > 5 and not l.strip().startswith("MahaRERA")][:5]
            project_name = first_lines[0] if first_lines else "Untitled RERA Project"
            confidence["project_name"] = "INFERRED"

        # 3. Promoter Name
        promoter_name = None
        prom_match = re.search(
            r"(?:Promoter\s+Name|Developer|Promoter/Developer|Company\s+Name)\s*[:\-]?\s*([^\n\r]+?)(?:\s+(?:PAN\s+Number|PAN\b|Registration\s+No|Certificate\s+No)|[\n\r]|$)",
            text,
            re.IGNORECASE,
        )
        if prom_match and len(prom_match.group(1).strip()) > 2:
            candidate = prom_match.group(1).strip()
            if not re.match(r"^(?:Information|Infrastructure|Details|Status)$", candidate, re.IGNORECASE):
                promoter_name = candidate
        if not promoter_name:
            org_match = re.search(
                r"Organization\s*\n\s*Name\s+([A-Z0-9\s.,&'-]+?)(?:\s+(?:PAN\s+Number|PAN\b|Registration\s+No)|[\n\r]|$)",
                text,
                re.IGNORECASE,
            )
            if org_match and len(org_match.group(1).strip()) > 2:
                promoter_name = org_match.group(1).strip()
                vent_match = re.search(r"PAN Number\s+[A-Z0-9]+\s*\n\s*([A-Za-z0-9\s.,&'-]+?)(?:\s+Organization\s+Type|[\n\r]|$)", text, re.IGNORECASE)
                if vent_match and len(vent_match.group(1).strip()) > 0:
                    promoter_name = f"{promoter_name} {vent_match.group(1).strip()}"
        confidence["promoter_name"] = "HIGH" if promoter_name else "NOT_FOUND"

        # 4. Proposed Handover Date
        date_match = re.search(
            r"(?:Proposed\s+Date\s+of\s+Completion|Revised\s+Proposed\s+Date\s+of\s+Completion|Proposed\s+Date\s+of(?:\s+Completion)?|Handover\s+Date|Completion\s+Date)\s*[:\-]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})",
            text,
            re.IGNORECASE,
        )
        completion_date = date_match.group(1).strip() if date_match else None
        confidence["proposed_completion_date"] = "HIGH" if completion_date else "NOT_FOUND"

        # 5. Built-up Area & Plot Area (handling sq.mt to sq.ft conversion)
        built_up_area, built_up_conf = cls._extract_area(
            text, [
                r"Sanctioned Built-up Area",
                r"Total Built-up Area",
                r"Built-up-Area as per Approved FSI",
                r"Built-up Area",
                r"TotalFSI",
                r"FSI Area",
            ]
        )
        confidence["built_up_area_sqft"] = built_up_conf

        plot_area, plot_conf = cls._extract_area(
            text, [
                r"Plot Area",
                r"Total Area of Land",
                r"Land Area",
                r"Area\(In sqmts\)",
                r"Area \(In sqmts\)",
            ]
        )
        confidence["plot_area_sqft"] = plot_conf

        carpet_area, carpet_conf = cls._extract_area(
            text, [r"Total Carpet Area", r"Carpet Area"]
        )
        confidence["carpet_area_sqft"] = carpet_conf

        # 6. Floors Count & Basements Count
        floors = None
        basements = None
        floors_match = re.search(
            r"(?:Number of Floors|Total Floors|No\. of Floors)\s*[:\-]?\s*([0-9]+)",
            text,
            re.IGNORECASE,
        )
        if floors_match:
            floors = int(floors_match.group(1))
            confidence["number_of_floors"] = "HIGH"
        else:
            # Check building table rows: Sr.No. Project Name ... <basement> <plinth> <podium> <slab> <stilt> <open> <closed>
            slabs = []
            row_basements = []
            for line in text.splitlines():
                m_row = re.search(r"\b(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$", line.strip())
                if m_row and int(m_row.group(4)) < 150:
                    row_basements.append(int(m_row.group(1)))
                    slabs.append(int(m_row.group(4)))
            if slabs:
                floors = max(slabs)
                confidence["number_of_floors"] = "HIGH"
            else:
                # Check G+N pattern
                g_plus = re.search(r"G\s*\+\s*([0-9]+)", text, re.IGNORECASE)
                if g_plus:
                    floors = 1 + int(g_plus.group(1))
                    confidence["number_of_floors"] = "HIGH"
                else:
                    confidence["number_of_floors"] = "NOT_FOUND"

            if row_basements:
                basements = max(row_basements)
                confidence["number_of_basements"] = "HIGH"

        # 7. Basements Count (if not found in rows)
        if basements is None:
            base_match = re.search(
                r"(?:Number of Basements|Basements|Number of Basement's)\s*[:\-]?\s*([0-9]+)",
                text,
                re.IGNORECASE,
            )
            if base_match:
                basements = int(base_match.group(1))
                confidence["number_of_basements"] = "HIGH"
            else:
                confidence["number_of_basements"] = "NOT_FOUND"

        # 8. Project Cost
        cost_match = re.search(
            r"(?:Total Estimated Cost of Project|Total Estimated Cost|Estimated Cost of Project|Project Cost|Total Amount Paid by User)\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]+)?)",
            text,
            re.IGNORECASE,
        )
        cost = None
        if cost_match:
            try:
                raw_num = cost_match.group(1).replace(",", "")
                cost = float(raw_num)
                confidence["total_project_cost"] = "HIGH"
            except ValueError:
                confidence["total_project_cost"] = "NOT_FOUND"
        else:
            confidence["total_project_cost"] = "NOT_FOUND"

        snippet = text[:400].replace("\n", " ").strip()

        return MahaRERAPreFillDraft(
            project_name=project_name,
            rera_registration_no=rera_no,
            promoter_name=promoter_name,
            proposed_completion_date=completion_date,
            plot_area_sqft=plot_area,
            built_up_area_sqft=built_up_area,
            carpet_area_sqft=carpet_area,
            number_of_floors=floors,
            number_of_basements=basements,
            total_project_cost=cost,
            confidence_scores=confidence,
            raw_text_snippet=snippet,
            requires_user_confirmation=True,
            is_confirmed=False,
        )

    @staticmethod
    def _extract_area(text: str, label_patterns: list) -> Tuple[Optional[float], str]:
        for lbl in label_patterns:
            pattern = (
                rf"{lbl}\s*(?:\(In sqmts\))?\s*[:\-]?\s*([0-9,]+(?:\.[0-9]+)?)(?:\s*(sq\.?\s*m(?:tr)?|sqm|sq\.?\s*ft|sqft))?"
            )
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                val_str = match.group(1).replace(",", "")
                unit = match.group(2) or ""
                try:
                    num = float(val_str)
                    if num <= 0:
                        continue
                    # Convert square meters to square feet if unit indicates meters or label implies meters
                    if "m" in unit.lower() or "sqmts" in lbl.lower() or "fsi" in lbl.lower():
                        sqft = round(num * 10.7639, 2)
                    else:
                        sqft = round(num, 2)
                    return sqft, "HIGH"
                except ValueError:
                    continue
        return None, "NOT_FOUND"
