import os
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models import Document, DocumentMapping, AccreditationCriterion, ExtractedField, to_uuid
from services.vector_db import add_document_chunks, query_vector_db, delete_document_from_vector_db

def build_document_text_for_indexing(doc: Document, db: Session) -> tuple[str, Dict[str, Any]]:
    """
    Constructs a rich textual representation of the document for semantic embedding,
    incorporating extracted fields and mapped accreditation metrics.
    """
    lines = []
    
    # Header metadata context
    lines.append(f"Document File: {doc.original_filename}")
    if doc.document_type:
        lines.append(f"Document Type: {doc.document_type.replace('_', ' ').title()}")
    if doc.academic_year:
        lines.append(f"Academic Year: {doc.academic_year}")
    if doc.department:
        lines.append(f"Department: {doc.department}")

    # Mapped criteria context
    mapping = db.query(DocumentMapping).filter(DocumentMapping.document_id == doc.id).first()
    criterion_name = ""
    metric_name = ""
    if mapping:
        crit = db.query(AccreditationCriterion).filter(AccreditationCriterion.id == mapping.metric_id).first()
        if crit:
            criterion_name = crit.criterion_name
            metric_name = crit.metric_name
            lines.append(f"Accreditation Criterion: {crit.criterion_name}")
            lines.append(f"Key Indicator: {crit.key_indicator}")
            lines.append(f"Metric: {crit.metric_name}")

    # Extracted fields context
    extracted = db.query(ExtractedField).filter(ExtractedField.document_id == doc.id).all()
    if extracted:
        lines.append("Extracted Evidence Information:")
        for ef in extracted:
            lines.append(f"- {ef.field_name.replace('_', ' ').title()}: {ef.field_value}")

    # Primary OCR content
    if doc.ocr_text:
        lines.append("\nDocument Text Content:")
        lines.append(doc.ocr_text)

    full_text = "\n".join(lines)

    metadata = {
        "filename": doc.original_filename or "",
        "document_type": doc.document_type or "unknown",
        "academic_year": doc.academic_year or "",
        "department": doc.department or "",
        "status": str(doc.status.value if hasattr(doc.status, "value") else doc.status),
        "criterion_name": criterion_name,
        "metric_name": metric_name,
        "is_duplicate": bool(doc.is_duplicate_of)
    }

    return full_text, metadata

def index_document_for_rag(doc: Document, db: Session) -> int:
    """Indexes a single document into the vector database."""
    if not doc.ocr_text or not doc.ocr_text.strip():
        return 0
    full_text, metadata = build_document_text_for_indexing(doc, db)
    return add_document_chunks(str(doc.id), full_text, metadata)

def remove_document_from_rag(document_id: str) -> None:
    delete_document_from_vector_db(str(document_id))

def reindex_all_documents(db: Session) -> int:
    """Re-indexes all non-rejected documents with OCR text into vector DB."""
    docs = db.query(Document).filter(
        Document.ocr_text.isnot(None),
        Document.ocr_text != ""
    ).all()
    count = 0
    for doc in docs:
        c = index_document_for_rag(doc, db)
        if c > 0:
            count += 1
    return count

def search_evidence(
    query: str,
    db: Session,
    n_results: int = 5,
    filter_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Performs semantic search for evidence and groups results by parent document.
    """
    where_filter = None
    if filter_type:
        where_filter = {"document_type": filter_type}

    chunks = query_vector_db(query, n_results=n_results * 2, where=where_filter)
    
    # Group results by parent document_id
    doc_map = {}
    for chunk in chunks:
        doc_id = chunk["document_id"]
        if not doc_id:
            continue
        if doc_id not in doc_map:
            doc = db.query(Document).filter(Document.id == to_uuid(doc_id)).first()
            if not doc:
                continue
            
            # Fetch mapping info
            mapping = db.query(DocumentMapping).filter(DocumentMapping.document_id == doc.id).first()
            criterion_data = None
            if mapping:
                crit = db.query(AccreditationCriterion).filter(AccreditationCriterion.id == mapping.metric_id).first()
                if crit:
                    criterion_data = {
                        "criterion_name": crit.criterion_name,
                        "key_indicator": crit.key_indicator,
                        "metric_name": crit.metric_name
                    }
                    
            # Fetch fields
            fields = db.query(ExtractedField).filter(ExtractedField.document_id == doc.id).all()
            fields_data = {f.field_name: f.field_value for f in fields}

            doc_map[doc_id] = {
                "document_id": str(doc.id),
                "filename": doc.original_filename,
                "document_type": doc.document_type or "unknown",
                "academic_year": doc.academic_year or "N/A",
                "department": doc.department or "N/A",
                "status": str(doc.status.value if hasattr(doc.status, "value") else doc.status),
                "mapping": criterion_data,
                "extracted_fields": fields_data,
                "highest_similarity": chunk["similarity_score"],
                "snippets": [chunk["snippet"]]
            }
        else:
            if chunk["similarity_score"] > doc_map[doc_id]["highest_similarity"]:
                doc_map[doc_id]["highest_similarity"] = chunk["similarity_score"]
            if len(doc_map[doc_id]["snippets"]) < 2:
                doc_map[doc_id]["snippets"].append(chunk["snippet"])

    results = list(doc_map.values())
    results.sort(key=lambda x: x["highest_similarity"], reverse=True)
    return results[:n_results]

def generate_rag_answer(query: str, db: Session, n_results: int = 5) -> Dict[str, Any]:
    """
    Answers natural-language accreditation questions using retrieved evidence chunks.
    Provides synthesized findings, evidence sources, and metric alignments.
    """
    evidence_results = search_evidence(query, db, n_results=n_results)

    if not evidence_results:
        # Fallback keyword search over database if vector DB is empty or has no matches
        q_lower = query.lower()
        docs = db.query(Document).filter(
            Document.ocr_text.isnot(None)
        ).all()
        matched = []
        for d in docs:
            if any(term in (d.ocr_text or "").lower() for term in q_lower.split() if len(term) > 3):
                matched.append(d)
        
        if not matched:
            return {
                "query": query,
                "answer": "No relevant evidence documents matching this query were found in the institutional repository. Please ensure supporting documents have been uploaded and processed.",
                "sources": [],
                "total_found": 0,
                "recommendation": "Try uploading relevant PDFs or certificates to your document library."
            }

    # Synthesize intelligent answer based on the retrieved documents
    doc_count = len(evidence_results)
    doc_types = list(set(r["document_type"].replace('_', ' ').title() for r in evidence_results))
    criteria_mentioned = list(set(r["mapping"]["criterion_name"] for r in evidence_results if r.get("mapping")))

    summary_points = []
    for r in evidence_results:
        fields = r.get("extracted_fields", {})
        point = f"• **{r['filename']}** ({r['document_type'].replace('_', ' ').title()}"
        if r.get("academic_year") and r["academic_year"] != "N/A":
            point += f", Year: {r['academic_year']}"
        point += ")"
        
        key_facts = []
        if "faculty_name" in fields:
            key_facts.append(f"Faculty: {fields['faculty_name']}")
        if "journal_name" in fields:
            key_facts.append(f"Journal: {fields['journal_name']}")
        if "DOI" in fields:
            key_facts.append(f"DOI: {fields['DOI']}")
        if "package" in fields:
            key_facts.append(f"Package: {fields['package']}")
        if "organising_institute" in fields:
            key_facts.append(f"Institute: {fields['organising_institute']}")
        if "students_placed" in fields:
            key_facts.append(f"Placed: {fields['students_placed']}")
            
        if key_facts:
            point += " — " + ", ".join(key_facts)
        if r.get("mapping"):
            point += f" [Mapped to: {r['mapping']['criterion_name']}]"
        summary_points.append(point)

    findings_text = "\n".join(summary_points)
    
    synthesized_answer = (
        f"Based on analysis of {doc_count} relevant institutional evidence document(s) "
        f"across categories ({', '.join(doc_types)}):\n\n"
        f"{findings_text}\n\n"
    )

    if criteria_mentioned:
        synthesized_answer += f"These documents primarily support: **{', '.join(criteria_mentioned)}**."

    return {
        "query": query,
        "answer": synthesized_answer,
        "sources": evidence_results,
        "total_found": doc_count,
        "confidence_level": "High" if doc_count > 0 and evidence_results[0]["highest_similarity"] > 0.6 else "Moderate",
        "criteria_supported": criteria_mentioned
    }
