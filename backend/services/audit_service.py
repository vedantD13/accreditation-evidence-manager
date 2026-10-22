import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models import Document, DocumentMapping, AccreditationCriterion, ExtractedField, DocumentStatusEnum

# Expected mandatory fields per document type for accreditation audits
MANDATORY_FIELDS_BY_TYPE = {
    "faculty_publication": ["faculty_name", "journal_name", "DOI", "publication_year"],
    "fdp_certificate": ["faculty_name", "organising_institute", "start_date"],
    "placement_report": ["package", "academic_year", "company_name", "students_placed"]
}

def perform_gap_analysis(db: Session) -> Dict[str, Any]:
    """
    Evaluates institutional evidence repository against accreditation criteria requirements.
    Detects missing documents, incomplete field extractions, outdated items, and duplicates.
    """
    criteria = db.query(AccreditationCriterion).all()
    all_docs = db.query(Document).all()
    
    criterion_reports = []
    total_required_overall = 0
    total_verified_overall = 0
    total_available_overall = len(all_docs)

    for c in criteria:
        req_count = c.required_evidence_count or 10
        total_required_overall += req_count

        # Get mappings for this criterion
        mappings = db.query(DocumentMapping).filter(DocumentMapping.metric_id == c.id).all()
        mapped_doc_ids = [m.document_id for m in mappings]
        
        # Count documents
        docs_for_metric = db.query(Document).filter(Document.id.in_(mapped_doc_ids)).all() if mapped_doc_ids else []
        verified_docs = [d for d in docs_for_metric if d.status == DocumentStatusEnum.verified]
        pending_docs = [d for d in docs_for_metric if d.status == DocumentStatusEnum.pending_review]
        
        verified_count = len(verified_docs)
        available_count = len(docs_for_metric)
        total_verified_overall += verified_count
        
        gap = max(0, req_count - verified_count)
        readiness_pct = min(100.0, round((verified_count / req_count) * 100, 1)) if req_count > 0 else 0.0

        # Determine status
        if readiness_pct >= 90.0:
            status = "Complete"
        elif readiness_pct >= 50.0:
            status = "Partially Complete"
        elif len(pending_docs) >= gap and len(pending_docs) > 0:
            status = "Under Verification"
        else:
            status = "Evidence Missing"

        criterion_reports.append({
            "criterion_id": str(c.id),
            "criterion_name": c.criterion_name,
            "key_indicator": c.key_indicator,
            "metric_name": c.metric_name,
            "required_count": req_count,
            "available_count": available_count,
            "verified_count": verified_count,
            "pending_count": len(pending_docs),
            "missing_count": gap,
            "readiness_percentage": readiness_pct,
            "status": status,
            "framework_version": c.framework_version
        })

    # Overall Institutional Readiness
    overall_readiness = (
        round((total_verified_overall / total_required_overall) * 100, 1)
        if total_required_overall > 0 else 0.0
    )

    # Calculate grade tier
    if overall_readiness >= 85:
        projected_grade = "A++ (Institution is Highly Prepared)"
    elif overall_readiness >= 75:
        projected_grade = "A+ (Institution is Well Prepared)"
    elif overall_readiness >= 65:
        projected_grade = "A (Preparation on Track)"
    elif overall_readiness >= 50:
        projected_grade = "B++ (Substantial Evidence Gaps)"
    else:
        projected_grade = "B (Critical Evidence Missing)"

    return {
        "overall_readiness_percentage": overall_readiness,
        "projected_grade": projected_grade,
        "total_required_evidence": total_required_overall,
        "total_verified_evidence": total_verified_overall,
        "total_available_evidence": total_available_overall,
        "criteria": criterion_reports,
        "timestamp": datetime.utcnow().isoformat()
    }

def generate_audit_alerts(db: Session) -> List[Dict[str, Any]]:
    """
    Generates actionable compliance and gap alerts categorized by severity:
    - CRITICAL: Missing mandatory metrics below threshold
    - WARNING: Incomplete extractions, unmapped files, or duplicates
    - INFO: Pending verifications or approaching deadlines
    """
    alerts = []
    alert_id = 1

    gap_data = perform_gap_analysis(db)
    
    # 1. Missing Evidence Alerts (Critical / Warning)
    for c in gap_data["criteria"]:
        if c["missing_count"] > 0:
            severity = "critical" if c["readiness_percentage"] < 40 else "warning"
            alerts.append({
                "id": f"alert_{alert_id}",
                "type": "missing_evidence",
                "severity": severity,
                "title": f"Evidence Deficit: {c['key_indicator']}",
                "message": (
                    f"Metric '{c['metric_name'][:75]}...' requires {c['required_count']} documents. "
                    f"Only {c['verified_count']} verified. Deficit: {c['missing_count']} documents."
                ),
                "criterion_name": c["criterion_name"],
                "metric_id": c["criterion_id"],
                "action_required": f"Upload at least {c['missing_count']} more supporting evidence documents."
            })
            alert_id += 1

    # 2. Incomplete Document Extractions (Warning)
    all_docs = db.query(Document).filter(Document.status != DocumentStatusEnum.rejected).all()
    for doc in all_docs:
        doc_type = doc.document_type
        if doc_type in MANDATORY_FIELDS_BY_TYPE:
            expected = MANDATORY_FIELDS_BY_TYPE[doc_type]
            fields = db.query(ExtractedField).filter(ExtractedField.document_id == doc.id).all()
            present_fields = [f.field_name for f in fields if f.field_value and f.field_value.strip()]
            missing_fields = [f for f in expected if f not in present_fields]

            if missing_fields:
                formatted_missing = ", ".join(m.replace('_', ' ').title() for m in missing_fields)
                alerts.append({
                    "id": f"alert_{alert_id}",
                    "type": "incomplete_fields",
                    "severity": "warning",
                    "title": f"Incomplete Extractions: {doc.original_filename}",
                    "message": f"Missing mandatory field(s): {formatted_missing}.",
                    "document_id": str(doc.id),
                    "action_required": "Review document in Verification Queue and manually supply missing fields."
                })
                alert_id += 1

    # 3. Duplicate Document Alerts (Warning)
    duplicate_docs = db.query(Document).filter(Document.is_duplicate_of.isnot(None)).all()
    for dup in duplicate_docs:
        orig = db.query(Document).filter(Document.id == dup.is_duplicate_of).first()
        orig_name = orig.original_filename if orig else "previous upload"
        alerts.append({
            "id": f"alert_{alert_id}",
            "type": "duplicate_document",
            "severity": "warning",
            "title": f"Duplicate Flagged: {dup.original_filename}",
            "message": f"This file is a duplicate of '{orig_name}'. Double-counting in accreditation will skew metric scores.",
            "document_id": str(dup.id),
            "action_required": "Reject duplicate document or verify if it contains distinct addenda."
        })
        alert_id += 1

    # 4. Unmapped Documents (Warning)
    mapped_ids = {m.document_id for m in db.query(DocumentMapping.document_id).all()}
    unmapped_docs = [d for d in all_docs if d.id not in mapped_ids and d.status != DocumentStatusEnum.processing]
    for unmapped in unmapped_docs:
        alerts.append({
            "id": f"alert_{alert_id}",
            "type": "unmapped_document",
            "severity": "warning",
            "title": f"Unmapped Evidence: {unmapped.original_filename}",
            "message": "Document has not been mapped to any Accreditation Criterion or Metric.",
            "document_id": str(unmapped.id),
            "action_required": "Assign to a target metric in Verification Queue."
        })
        alert_id += 1

    # 5. Pending Verification Queue (Info)
    pending_count = db.query(Document).filter(Document.status == DocumentStatusEnum.pending_review).count()
    if pending_count > 0:
        alerts.append({
            "id": f"alert_{alert_id}",
            "type": "verification_queue",
            "severity": "info",
            "title": f"Faculty Review Pending: {pending_count} Items",
            "message": f"There are {pending_count} document(s) awaiting faculty validation.",
            "action_required": "Visit the Verification Queue to approve or adjust mappings."
        })
        alert_id += 1

    return alerts
