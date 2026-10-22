from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Document, DocumentStatusEnum, VerificationLog, User
from services.audit_service import perform_gap_analysis, generate_audit_alerts

def get_dashboard_analytics(db: Session) -> Dict[str, Any]:
    """
    Computes comprehensive analytics for the Accreditation Readiness Dashboard.
    """
    # KPI Counters
    total_docs = db.query(Document).count()
    verified_docs = db.query(Document).filter(Document.status == DocumentStatusEnum.verified).count()
    pending_docs = db.query(Document).filter(Document.status == DocumentStatusEnum.pending_review).count()
    rejected_docs = db.query(Document).filter(Document.status == DocumentStatusEnum.rejected).count()
    duplicates_count = db.query(Document).filter(Document.is_duplicate_of.isnot(None)).count()

    # Gap Analysis & Criterion Readiness
    gap_data = perform_gap_analysis(db)

    # Document Type Distribution
    type_counts = (
        db.query(Document.document_type, func.count(Document.id))
        .group_by(Document.document_type)
        .all()
    )
    doc_types = [
        {
            "type": t[0].replace('_', ' ').title() if t[0] else "Unclassified",
            "raw_type": t[0] or "unclassified",
            "count": t[1]
        }
        for t in type_counts
    ]

    # Academic Year Distribution
    year_counts = (
        db.query(Document.academic_year, func.count(Document.id))
        .filter(Document.academic_year.isnot(None))
        .group_by(Document.academic_year)
        .all()
    )
    academic_years = [{"year": y[0], "count": y[1]} for y in year_counts]

    # Department Distribution
    dept_counts = (
        db.query(Document.department, func.count(Document.id))
        .filter(Document.department.isnot(None))
        .group_by(Document.department)
        .all()
    )
    departments = [{"department": d[0], "count": d[1]} for d in dept_counts]
    if not departments:
        # Default institutional departments if none set yet
        departments = [
            {"department": "Computer Science & Engineering", "count": verified_docs},
            {"department": "Information Technology", "count": 0},
            {"department": "Electronics & Telecomm", "count": 0}
        ]

    # Recent Verification Audit Logs
    recent_logs = (
        db.query(VerificationLog)
        .order_by(VerificationLog.timestamp.desc())
        .limit(6)
        .all()
    )
    logs_data = []
    for l in recent_logs:
        reviewer = db.query(User).filter(User.id == l.reviewer_id).first()
        doc = db.query(Document).filter(Document.id == l.document_id).first()
        logs_data.append({
            "id": str(l.id),
            "action": l.action,
            "remarks": l.remarks or "",
            "timestamp": l.timestamp.isoformat() if l.timestamp else "",
            "reviewer_name": reviewer.name if reviewer else "Faculty Reviewer",
            "filename": doc.original_filename if doc else "Document"
        })

    # Actionable Alerts
    alerts = generate_audit_alerts(db)

    return {
        "kpis": {
            "total_documents": total_docs,
            "verified": verified_docs,
            "pending_review": pending_docs,
            "rejected": rejected_docs,
            "duplicates_flagged": duplicates_count
        },
        "readiness": {
            "overall_percentage": gap_data["overall_readiness_percentage"],
            "projected_grade": gap_data["projected_grade"],
            "total_required": gap_data["total_required_evidence"],
            "total_verified": gap_data["total_verified_evidence"]
        },
        "criteria": gap_data["criteria"],
        "distributions": {
            "document_types": doc_types,
            "academic_years": academic_years,
            "departments": departments
        },
        "recent_logs": logs_data,
        "alerts": alerts[:8] # Top 8 most pressing alerts
    }
