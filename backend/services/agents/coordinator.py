import time
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime

from models import Document, DocumentStatusEnum, ExtractedField, to_uuid
from services.ocr_service import extract_text_from_file
from services.duplicate_service import check_near_duplicate
from services.classification_service import classify_document
from services.extraction_service import extract_information
from services.mapping_service import map_document_to_metrics
from services.rag_service import index_document_for_rag, generate_rag_answer
from services.audit_service import MANDATORY_FIELDS_BY_TYPE
from services.report_service import generate_criterion_report, generate_full_ssr_report

class BaseAgent:
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role

    def log_step(self, status: str, details: Dict[str, Any], elapsed_ms: float) -> Dict[str, Any]:
        return {
            "agent": self.name,
            "role": self.role,
            "status": status,
            "elapsed_ms": round(elapsed_ms, 2),
            "timestamp": datetime.utcnow().isoformat(),
            "details": details
        }

class DocumentProcessingAgent(BaseAgent):
    def __init__(self):
        super().__init__("Document Processing Agent", "OCR & File Ingestion")

    def run(self, doc: Document) -> tuple[str, Dict[str, Any]]:
        t0 = time.time()
        text = extract_text_from_file(doc.file_path, doc.file_type)
        elapsed = (time.time() - t0) * 1000
        return text, self.log_step("success", {"char_count": len(text), "file_type": str(doc.file_type)}, elapsed)

class DuplicateDetectionAgent(BaseAgent):
    def __init__(self):
        super().__init__("Duplicate Detection Agent", "Exact & Semantic Duplicate Screening")

    def run(self, doc: Document, text: str, db: Session) -> tuple[Any, Dict[str, Any]]:
        t0 = time.time()
        dup = check_near_duplicate(doc, text, db)
        elapsed = (time.time() - t0) * 1000
        is_dup = dup is not None or doc.is_duplicate_of is not None
        dup_id = str(dup.id) if dup else (str(doc.is_duplicate_of) if doc.is_duplicate_of else None)
        return dup, self.log_step("success", {"duplicate_detected": is_dup, "duplicate_of": dup_id}, elapsed)

class ClassificationAgent(BaseAgent):
    def __init__(self):
        super().__init__("Classification Agent", "Document-Type Categorization")

    def run(self, text: str) -> tuple[str, float, Dict[str, Any]]:
        t0 = time.time()
        doc_type, confidence = classify_document(text)
        elapsed = (time.time() - t0) * 1000
        return doc_type, confidence, self.log_step("success", {"document_type": doc_type, "confidence": confidence}, elapsed)

class InformationExtractionAgent(BaseAgent):
    def __init__(self):
        super().__init__("Information Extraction Agent", "NER & Key Attribute Extraction")

    def run(self, text: str, doc_type: str) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
        t0 = time.time()
        fields = extract_information(text, doc_type)
        elapsed = (time.time() - t0) * 1000
        return fields, self.log_step("success", {"extracted_field_count": len(fields), "fields": [f["field_name"] for f in fields]}, elapsed)

class AccreditationMappingAgent(BaseAgent):
    def __init__(self):
        super().__init__("Accreditation Mapping Agent", "Criteria & Metric Alignment")

    def run(self, doc_id: str, doc_type: str, text: str, db: Session) -> Dict[str, Any]:
        t0 = time.time()
        map_document_to_metrics(doc_id, doc_type, text, db)
        elapsed = (time.time() - t0) * 1000
        return self.log_step("success", {"document_id": doc_id, "mapped": True}, elapsed)

class EvidenceValidationAgent(BaseAgent):
    def __init__(self):
        super().__init__("Evidence Validation Agent", "Completeness & Integrity Auditing")

    def run(self, doc_type: str, fields: List[Dict[str, Any]]) -> Dict[str, Any]:
        t0 = time.time()
        expected = MANDATORY_FIELDS_BY_TYPE.get(doc_type, [])
        extracted_keys = {f["field_name"] for f in fields}
        missing = [f for f in expected if f not in extracted_keys]
        is_complete = len(missing) == 0
        elapsed = (time.time() - t0) * 1000
        return self.log_step("success", {"is_complete": is_complete, "missing_fields": missing}, elapsed)

class RagIndexingAgent(BaseAgent):
    def __init__(self):
        super().__init__("RAG Indexing Agent", "Vector Embedding & ChromaDB Indexing")

    def run(self, doc: Document, db: Session) -> tuple[int, Dict[str, Any]]:
        t0 = time.time()
        chunks_count = index_document_for_rag(doc, db)
        elapsed = (time.time() - t0) * 1000
        return chunks_count, self.log_step("success", {"chunks_indexed": chunks_count}, elapsed)

class CoordinatorAgent:
    """
    Coordinator Agent that directs the multi-agent pipeline:
    Orchestrates OCR, duplication detection, classification, extraction,
    accreditation mapping, validation, and RAG indexing.
    """
    def __init__(self):
        self.doc_processor = DocumentProcessingAgent()
        self.dup_detector = DuplicateDetectionAgent()
        self.classifier = ClassificationAgent()
        self.extractor = InformationExtractionAgent()
        self.mapper = AccreditationMappingAgent()
        self.validator = EvidenceValidationAgent()
        self.rag_indexer = RagIndexingAgent()

    def process_document(self, document_id: str, db: Session) -> List[Dict[str, Any]]:
        traces = []
        doc = db.query(Document).filter(Document.id == to_uuid(document_id)).first()
        if not doc:
            return traces

        try:
            # Step 1: Document Processing Agent (OCR)
            ocr_text, trace_1 = self.doc_processor.run(doc)
            traces.append(trace_1)
            doc.ocr_text = ocr_text
            doc.status = DocumentStatusEnum.ocr_complete
            db.commit()

            # Step 2: Duplicate Detection Agent
            if not doc.is_duplicate_of:
                dup, trace_2 = self.dup_detector.run(doc, ocr_text, db)
                traces.append(trace_2)
                if dup:
                    doc.is_duplicate_of = dup.id
                    db.commit()

            # Step 3: Classification Agent
            doc_type, conf, trace_3 = self.classifier.run(ocr_text)
            traces.append(trace_3)
            doc.document_type = doc_type
            doc.classification_confidence = conf
            db.commit()

            # Step 4: Information Extraction Agent
            fields, trace_4 = self.extractor.run(ocr_text, doc_type)
            traces.append(trace_4)
            for f in fields:
                ef = ExtractedField(
                    document_id=doc.id,
                    field_name=f["field_name"],
                    field_value=f["field_value"],
                    confidence=f["confidence"]
                )
                db.add(ef)
                # Auto-populate academic year or department if discovered
                if f["field_name"] == "academic_year" and not doc.academic_year:
                    doc.academic_year = f["field_value"]
                if f["field_name"] == "department" and not doc.department:
                    doc.department = f["field_value"]
            db.commit()

            # Step 5: Accreditation Mapping Agent
            trace_5 = self.mapper.run(str(doc.id), doc_type, ocr_text, db)
            traces.append(trace_5)

            # Step 6: Evidence Validation Agent
            trace_6 = self.validator.run(doc_type, fields)
            traces.append(trace_6)

            # Step 7: RAG Indexing Agent
            chunks_count, trace_7 = self.rag_indexer.run(doc, db)
            traces.append(trace_7)

            doc.status = DocumentStatusEnum.pending_review
            db.commit()

        except Exception as e:
            traces.append({
                "agent": "Coordinator Agent",
                "role": "Pipeline Supervisor",
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            doc.status = DocumentStatusEnum.ocr_failed
            db.commit()

        return traces

    def search_rag(self, query: str, db: Session, n_results: int = 5) -> Dict[str, Any]:
        """Evidence Retrieval Agent entry point."""
        return generate_rag_answer(query, db, n_results=n_results)

    def generate_report(self, criterion_id: str, db: Session) -> Dict[str, Any]:
        """Report Generation Agent entry point."""
        return generate_criterion_report(criterion_id, db)
