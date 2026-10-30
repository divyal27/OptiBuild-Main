import io
import re
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import pdfplumber
from pypdf import PdfReader

from backend.app.schemas.pdf_parser import MahaRERAPreFillDraft


class MahaRERAPDFParser:
    """Parses MahaRERA PDFs into an unconfirmed project setup draft."""

    MANUAL_ENTRY_MESSAGE = (
        "Could not extract enough text from uploaded PDF. Please enter details manually."
    )

    @classmethod
    def _empty_draft(cls, message: Optional[str] = None) -> MahaRERAPreFillDraft:
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
            raw_text_snippet=message or cls.MANUAL_ENTRY_MESSAGE,
            requires_user_confirmation=True,
            is_confirmed=False,
        )

    @classmethod
    def _run_ocr_fallback(cls, pdf_bytes: bytes) -> str:
        """Load OCR dependencies only when needed; a missing Tesseract is non-fatal."""
        try:
            import pypdfium2 as pdfium
            import pytesseract

            pdf = pdfium.PdfDocument(pdf_bytes)
            parts = []
            try:
                for index in range(min(len(pdf), 3)):
                    page = pdf[index]
                    bitmap = page.render(scale=1.5)
                    try:
                        text = pytesseract.image_to_string(bitmap.to_pil())
                        if text:
                            parts.append(text)
                    finally:
                        bitmap.close()
            finally:
                pdf.close()
            return "\n".join(parts).strip()
        except Exception:
            return ""

    @classmethod
    def _flatten_tables(cls, tables: Iterable[Sequence[Sequence[Optional[str]]]]) -> List[str]:
        """Keep table rows readable and add header/value pairs for labeled columns."""
        flattened: List[str] = []
        for table in tables:
            headers: List[str] = []
            for row in table or []:
                cells = [re.sub(r"\s+", " ", cell or "").strip() for cell in row]
                if not any(cells):
                    continue
                flattened.append(" | ".join(cells))
                is_header = any(
                    re.search(
                        r"project\s+name|promoter\s+name|built.?up|carpet\s+area|plot\s+area|number\s+of\s+(?:floors|basement|slab)|estimated\s+cost|total\s+cost|FSI",
                        cell,
                        re.IGNORECASE,
                    )
                    for cell in cells
                ) and not any(re.fullmatch(r"\d+(?:\.\d+)?", cell) for cell in cells)
                if is_header:
                    headers = cells
                    continue
                if headers and len(headers) == len(cells):
                    for header, value in zip(headers, cells):
                        if not header or not value:
                            continue
                        # MahaRERA promoter columns in these tables describe co-promoters.
                        if re.search(r"co[-\s]?promoter", " ".join(headers), re.IGNORECASE) and re.fullmatch(
                            r"promoter\s+name", header, re.IGNORECASE
                        ):
                            continue
                        flattened.append(f"{header} | {value}")
        return flattened

    @classmethod
    def parse_pdf_bytes(cls, pdf_bytes: bytes) -> MahaRERAPreFillDraft:
        try:
            page_text: List[str] = []
            table_lines: List[str] = []
            try:
                with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                    for page in pdf.pages:
                        page_text.append(page.extract_text() or "")
                        try:
                            table_lines.extend(cls._flatten_tables(page.extract_tables() or []))
                        except Exception:
                            continue
            except Exception:
                page_text = []
                table_lines = []

            extracted_text = "\n".join([*page_text, *table_lines]).strip()
            if len(extracted_text) < 50:
                try:
                    reader = PdfReader(io.BytesIO(pdf_bytes))
                    pypdf_text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
                    if len(pypdf_text) > len(extracted_text):
                        extracted_text = pypdf_text
                except Exception:
                    pass

            if len(extracted_text) < 50:
                ocr_text = cls._run_ocr_fallback(pdf_bytes)
                if len(ocr_text) > len(extracted_text):
                    extracted_text = ocr_text
                if len(extracted_text) < 50:
                    return cls._empty_draft()

            return cls.extract_from_text(extracted_text)
        except Exception:
            # Corrupt input and parser errors return an empty, reviewable draft.
            return cls._empty_draft()

    @staticmethod
    def _label_pattern(label: str) -> str:
        return re.escape(label).replace(r"\ ", r"\s+")

    @classmethod
    def _labeled_values(cls, text: str, labels: Sequence[str]) -> List[str]:
        values: List[str] = []
        lines = text.replace("\u00a0", " ").replace("\u00ad", "-").splitlines()
        ordered_labels = sorted(labels, key=len, reverse=True)
        for index, line in enumerate(lines):
            for label in ordered_labels:
                pattern = rf"(?<![\w/]){cls._label_pattern(label)}(?![\w/])\s*(?::|\||[-–—]\s*|\t+|\s+|$)(.*)$"
                match = re.search(pattern, line, re.IGNORECASE)
                if not match:
                    continue
                value = match.group(1).split("|", 1)[0].strip()
                if not value and index + 1 < len(lines):
                    next_line = index + 1
                    while next_line < len(lines) and not lines[next_line].strip():
                        next_line += 1
                    if next_line < len(lines):
                        value = lines[next_line].strip().split("|", 1)[0].strip()
                value = re.split(
                    r"\s+(?:Project\s+Status|Project\s+Type|Revised\s+Proposed\s+Date|PAN\s+Number|Organization\s+Type)\b",
                    value,
                    maxsplit=1,
                    flags=re.IGNORECASE,
                )[0].strip(" \t:|-–—")
                if label.lower().startswith("area") and re.search(r"Carpet\s+Area", line, re.IGNORECASE):
                    continue
                if value and not re.match(
                    r"(?:Number\s+of\s+(?:Apartments|Buildings|Plinth|Podiums|Stilts)|Type\s+of\s+Project|Project\s+Others?)\b",
                    value,
                    re.IGNORECASE,
                ):
                    values.append(value)
                break
        return values

    @classmethod
    def _first_value(cls, text: str, labels: Sequence[str]) -> Optional[str]:
        for value in cls._labeled_values(text, labels):
            if re.fullmatch(
                r"(?:Project\s+Others?|Project\s+Type|Promoter\s+Name|Co[-\s]?Promoter\s+Type|Type\s+of\s+Agreement(?:/Arrangement)?|VIEW)",
                value,
                re.IGNORECASE,
            ) or re.search(
                r"\b(?:Type\s+of\s+Project|Project\s+Status|Project\s+Others?|Promoter\s+Name|Co[-\s]?Promoter|Land\s+Area|Total\s+Cost|Number\s+of\s+(?:Buildings|Apartments)|Buildings/Plot)\b",
                value,
                re.IGNORECASE,
            ):
                continue
            return value
        return None

    @staticmethod
    def _is_generic_project_title(value: str) -> bool:
        return bool(
            re.search(
                r"\b(?:application|form|certificate|registration|authority|MahaRERA|RERA)\b",
                value,
                re.IGNORECASE,
            )
        )

    @classmethod
    def _extract_area(
        cls, text: str, labels: Sequence[str], *, allow_multiple: bool = False
    ) -> Tuple[Optional[float], str]:
        for label in labels:
            values = cls._labeled_values(text, [label])
            if label.lower().startswith("carpet area") and len(values) > 1:
                # Apartment schedules list per-unit carpet areas, not one project total.
                continue
            for value in values:
                match = re.search(
                    r"([0-9][0-9,]*(?:\.[0-9]+)?)\s*(sq\.?\s*m(?:ts?|tr)?|sqm|sq\.?\s*ft|sqft|sq\.?\s*feet)?",
                    value,
                    re.IGNORECASE,
                )
                if not match:
                    continue
                try:
                    number = float(match.group(1).replace(",", ""))
                except ValueError:
                    continue
                if number <= 0:
                    continue
                unit = (match.group(2) or "").lower()
                label_implies_sqm = bool(
                    re.search(r"sq\s*m|sqmt|sqmts|sq\.m|FSI", label, re.IGNORECASE)
                )
                if ("m" in unit) if unit else label_implies_sqm:
                    number *= 10.7639
                return round(number, 2), "HIGH"
        return None, "NOT_FOUND"

    @classmethod
    def extract_from_text(cls, text: str) -> MahaRERAPreFillDraft:
        text = text.replace("\u00a0", " ").replace("\u00ad", "-")
        confidence: Dict[str, str] = {}

        rera_match = re.search(r"\b(P\d{11}|P5\d{9,10}|REA\d{8,15})\b", text, re.IGNORECASE)
        rera_no = rera_match.group(1).upper() if rera_match else None
        confidence["rera_registration_no"] = "HIGH" if rera_no else "NOT_FOUND"

        project_candidates = cls._labeled_values(
            text, ["Name of the Project", "Project Name", "Name of Project"]
        )
        project_candidates = [
            candidate
            for candidate in project_candidates
            if not re.search(
                r"\b(?:Type\s+of\s+Project|Project\s+Status|Project\s+Others?|Promoter\s+Name|Co[-\s]?Promoter|Land\s+Area|Total\s+Cost|Court\s+Name|Case\s+Number|Petition\s+Year|Number\s+of)\b",
                candidate,
                re.IGNORECASE,
            )
            and not cls._is_generic_project_title(candidate)
        ]
        project_name = max(project_candidates, key=len) if project_candidates else None
        if project_name and cls._is_generic_project_title(project_name):
            project_name = None
        confidence["project_name"] = "HIGH" if project_name else "NOT_FOUND"

        promoter_name = None
        organization = re.search(
            r"Organization\s+Name\s+(.+?)\s+PAN\s+Number\s+[A-Z0-9]+\s+(.+?)\s+Organization\s+Type",
            text,
            re.IGNORECASE,
        )
        if organization:
            promoter_name = " ".join(part.strip() for part in organization.groups() if part.strip())
        if not promoter_name:
            promoter_name = cls._first_value(
                text,
                ["Name of Promoter", "Promoter/Developer", "Promoter Name", "Developer"],
            )
        confidence["promoter_name"] = "HIGH" if promoter_name else "NOT_FOUND"

        date_value = cls._first_value(
            text,
            [
                "Revised Proposed Date of Completion",
                "Proposed Date of Completion",
                "Date of Completion",
                "Handover Date",
                "Completion Date",
            ],
        )
        date_match = re.search(
            r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\b",
            date_value or "",
            re.IGNORECASE,
        )
        completion_date = date_match.group(1) if date_match else None
        confidence["proposed_completion_date"] = "HIGH" if completion_date else "NOT_FOUND"

        plot_area, confidence["plot_area_sqft"] = cls._extract_area(
            text,
            ["Plot Area", "Total Area of Land", "Area (In sqmts)", "Area(In sqmts)", "Area (in sq.m)"],
        )
        built_up_area, confidence["built_up_area_sqft"] = cls._extract_area(
            text,
            [
                "Sanctioned Built-up Area",
                "Total Built-up Area",
                "Sanctioned/Total Built-up Area",
                "Built-up-Area as per Approved FSI (In sqmts)",
                "Built-up Area",
                "Total FSI",
                "TotalFSI",
                "FSI Area",
                "FSI",
            ],
        )
        carpet_area, confidence["carpet_area_sqft"] = cls._extract_area(
            text, ["Total Carpet Area", "Carpet Area (in Sqmts)", "Carpet Area"]
        )

        floors = None
        floor_values = cls._labeled_values(
            text,
            ["Number of Floors", "Total Floors", "No. of Floors", "Number of Slab of Super Structure"],
        )
        floor_counts = []
        for floor_value in floor_values:
            g_plus = re.search(r"\bG\s*\+\s*(\d+)\b", floor_value, re.IGNORECASE)
            number = re.search(r"\d+", floor_value)
            if g_plus:
                floor_counts.append(1 + int(g_plus.group(1)))
                continue
            if number:
                floor_counts.append(int(number.group()))
        if floor_counts:
            floors = max(floor_counts)
        if floors is None:
            g_plus = re.search(r"\bG\s*\+\s*(\d+)\b", text, re.IGNORECASE)
            if g_plus:
                floors = 1 + int(g_plus.group(1))
        confidence["number_of_floors"] = "HIGH" if floors is not None else "NOT_FOUND"

        basement_values = cls._labeled_values(
            text, ["Number of Basements", "Number of Basement's", "Number of Basement", "Basements"]
        )
        basements = None
        for basement_value in basement_values:
            basement_match = re.search(r"\d+", basement_value)
            if basement_match:
                basements = int(basement_match.group())
                break
        confidence["number_of_basements"] = "HIGH" if basements is not None else "NOT_FOUND"

        cost = None
        for cost_label in [
            "Total Estimated Cost of the Real Estate Project",
            "Total Estimated Cost of Project",
            "Estimated Cost",
            "Total Cost",
        ]:
            for cost_value in cls._labeled_values(text, [cost_label]):
                if re.search(r"\b(?:Engineer|Construction|Paid by User)\b", cost_value, re.IGNORECASE):
                    continue
                cost_match = re.search(
                    r"(?:INR|Rs\.?|₹)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)",
                    cost_value,
                    re.IGNORECASE,
                )
                if cost_match:
                    cost = float(cost_match.group(1).replace(",", ""))
                    break
            if cost is not None:
                break
        confidence["total_project_cost"] = "HIGH" if cost is not None else "NOT_FOUND"

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
            raw_text_snippet=text[:400].replace("\n", " ").strip(),
            requires_user_confirmation=True,
            is_confirmed=False,
        )
