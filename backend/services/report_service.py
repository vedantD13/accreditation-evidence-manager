from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime
from models import AccreditationCriterion, DocumentMapping, Document, ExtractedField, DocumentStatusEnum, to_uuid
from services.audit_service import perform_gap_analysis

def generate_criterion_report(criterion_id: str, db: Session) -> Dict[str, Any]:
    """
    Generates a formal evidence dossier for a specific accreditation criterion.
    """
    criterion = db.query(AccreditationCriterion).filter(AccreditationCriterion.id == to_uuid(criterion_id)).first()
    if not criterion:
        return {"error": "Criterion not found"}

    mappings = db.query(DocumentMapping).filter(DocumentMapping.metric_id == criterion.id).all()
    mapped_doc_ids = [m.document_id for m in mappings]

    documents = db.query(Document).filter(Document.id.in_(mapped_doc_ids)).all() if mapped_doc_ids else []
    
    evidence_inventory = []
    for doc in documents:
        # Get fields
        fields = db.query(ExtractedField).filter(ExtractedField.document_id == doc.id).all()
        fields_dict = {f.field_name: f.field_value for f in fields}
        
        # Get mapping confidence & status
        mapping_obj = next((m for m in mappings if m.document_id == doc.id), None)

        evidence_inventory.append({
            "document_id": str(doc.id),
            "filename": doc.original_filename,
            "document_type": doc.document_type.replace('_', ' ').title() if doc.document_type else "Unclassified",
            "academic_year": doc.academic_year or "N/A",
            "department": doc.department or "N/A",
            "status": str(doc.status.value if hasattr(doc.status, "value") else doc.status),
            "extracted_fields": fields_dict,
            "mapping_confidence": mapping_obj.mapping_confidence if mapping_obj else 0.0,
            "upload_date": doc.upload_date.strftime("%Y-%m-%d") if doc.upload_date else ""
        })

    verified_count = len([d for d in documents if d.status == DocumentStatusEnum.verified])
    required_count = criterion.required_evidence_count or 10
    gap = max(0, required_count - verified_count)
    readiness = min(100.0, round((verified_count / required_count) * 100, 1))

    return {
        "criterion": {
            "id": str(criterion.id),
            "criterion_name": criterion.criterion_name,
            "key_indicator": criterion.key_indicator,
            "metric_name": criterion.metric_name,
            "framework_version": criterion.framework_version,
            "required_count": required_count,
            "verified_count": verified_count,
            "available_count": len(documents),
            "gap": gap,
            "readiness_percentage": readiness
        },
        "evidence_inventory": evidence_inventory,
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    }

def generate_full_ssr_report(db: Session) -> Dict[str, Any]:
    """
    Generates the institutional NAAC Self-Study Report (SSR) evidence compilation.
    """
    gap_data = perform_gap_analysis(db)
    criteria = db.query(AccreditationCriterion).all()
    
    sections = []
    for c in criteria:
        sec = generate_criterion_report(str(c.id), db)
        sections.append(sec)

    return {
        "institution_name": "Accreditation Evidence Management System",
        "framework": "NAAC-2024 / SSR Quality Matrix",
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "overall_readiness_percentage": gap_data["overall_readiness_percentage"],
        "projected_grade": gap_data["projected_grade"],
        "summary": {
            "total_required": gap_data["total_required_evidence"],
            "total_verified": gap_data["total_verified_evidence"],
            "total_available": gap_data["total_available_evidence"]
        },
        "criteria_sections": sections
    }

def export_ssr_markdown(db: Session) -> str:
    """Exports the SSR report as a formatted GitHub-style Markdown document."""
    report = generate_full_ssr_report(db)
    
    md = []
    md.append(f"# Institutional Accreditation Evidence Report (SSR)")
    md.append(f"**Generated:** {report['generated_at']} | **Framework:** {report['framework']}")
    md.append(f"**Overall Readiness:** {report['overall_readiness_percentage']}% | **Projected Grade:** {report['projected_grade']}\n")
    
    md.append("## Executive Summary")
    md.append(f"- **Total Evidence Required:** {report['summary']['total_required']}")
    md.append(f"- **Total Evidence Verified:** {report['summary']['total_verified']}")
    md.append(f"- **Total Uploaded Evidence:** {report['summary']['total_available']}\n")
    
    md.append("## Criterion-wise Quality Audit")
    for sec in report["criteria_sections"]:
        crit = sec["criterion"]
        md.append(f"### {crit['criterion_name']} - {crit['key_indicator']}")
        md.append(f"**Metric:** {crit['metric_name']}")
        md.append(f"- Status: {crit['readiness_percentage']}% Complete ({crit['verified_count']}/{crit['required_count']} verified)")
        if crit['gap'] > 0:
            md.append(f"- **Evidence Deficit:** {crit['gap']} document(s) required")
        
        md.append("\n**Supporting Evidence Inventory:**")
        if sec["evidence_inventory"]:
            md.append("| Filename | Type | Academic Year | Status | Extracted Highlights |")
            md.append("| --- | --- | --- | --- | --- |")
            for item in sec["evidence_inventory"]:
                fields_summary = ", ".join([f"{k}: {v}" for k, v in list(item["extracted_fields"].items())[:3]])
                md.append(f"| {item['filename']} | {item['document_type']} | {item['academic_year']} | {item['status']} | {fields_summary} |")
        else:
            md.append("*No supporting evidence documents currently mapped to this metric.*")
        md.append("\n---\n")

    return "\n".join(md)
