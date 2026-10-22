import os
import shutil
from typing import Optional, Dict, List, Any
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from db import engine, get_db, Base
from config import settings
from models import (
    User, Document, ExtractedField, DocumentStatusEnum, 
    FileTypeEnum, RoleEnum, VerificationLog, VerificationStatusEnum, 
    AccreditationCriterion, DocumentMapping, to_uuid
)
from auth import (
    verify_password, get_password_hash, create_access_token, 
    get_current_user, timedelta, ACCESS_TOKEN_EXPIRE_MINUTES
)
from services.agents.coordinator import CoordinatorAgent
from services.audit_service import perform_gap_analysis, generate_audit_alerts
from services.analytics_service import get_dashboard_analytics
from services.report_service import generate_criterion_report, generate_full_ssr_report, export_ssr_markdown
from services.rag_service import search_evidence, generate_rag_answer, index_document_for_rag, reindex_all_documents
from services.vector_db import get_vector_db_stats

coordinator = CoordinatorAgent()

class VerificationRequest(BaseModel):
    action: str  # approve / correct_and_save / reject
    remarks: Optional[str] = None
    extracted_fields: Optional[Dict[str, str]] = None
    metric_id: Optional[str] = None
    document_type: Optional[str] = None
    academic_year: Optional[str] = None
    department: Optional[str] = None

class BatchVerificationRequest(BaseModel):
    document_ids: List[str]
    action: str  # approve / reject
    remarks: Optional[str] = None

class RAGSearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    document_type: Optional[str] = None

app = FastAPI(title=settings.PROJECT_NAME)

@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        res = db.execute(text("PRAGMA table_info(documents)")).fetchall()
        col_names = [r[1] for r in res]
        if "file_hash" not in col_names:
            db.execute(text("ALTER TABLE documents ADD COLUMN file_hash VARCHAR;"))
            db.commit()
    except Exception as e:
        print(f"[Startup] Migration notice: {e}")

    # Ensure test faculty exists
    if not db.query(User).filter(User.email == "faculty@test.com").first():
        test_user = User(
            name="Dr. Vedant Dhotre",
            email="faculty@test.com",
            password_hash=get_password_hash("password123"),
            role=RoleEnum.faculty,
            department="Computer Science & Engineering"
        )
        db.add(test_user)
        db.commit()

    # Complete NAAC 7-Criteria Framework
    criteria_definitions = [
        ("Curricular Aspects", "Curriculum Enrichment", "Number of value-added courses offered imparting transferable and life skills", 15, "NAAC-2024"),
        ("Teaching-Learning and Evaluation", "Teacher Profile and Quality", "Number of full-time teachers with NET/SET/Ph.D. / D.Sc. / D.Litt.", 30, "NAAC-2024"),
        ("Research, Innovations and Extension", "Research Publications", "Number of research papers published per teacher in the Journals notified on UGC website", 50, "NAAC-2024"),
        ("Infrastructure and Learning Resources", "Library as a Learning Resource", "Library automated using Integrated Library Management System and digital subscriptions", 8, "NAAC-2024"),
        ("Student Support and Progression", "Student Progression", "Average percentage of placement of outgoing students and progression to higher education", 25, "NAAC-2024"),
        ("Faculty Empowerment Strategies", "Professional Development", "Average number of professional development / administrative training programs organized", 10, "NAAC-2024"),
        ("Institutional Values and Best Practices", "Institutional Values and Social Responsibilities", "Quality audits on environment and energy regularly undertaken by the institution", 6, "NAAC-2024")
    ]

    for c_name, k_ind, m_name, count, f_ver in criteria_definitions:
        existing = db.query(AccreditationCriterion).filter(
            AccreditationCriterion.criterion_name == c_name,
            AccreditationCriterion.key_indicator == k_ind
        ).first()
        if not existing:
            db.add(AccreditationCriterion(
                criterion_name=c_name,
                key_indicator=k_ind,
                metric_name=m_name,
                required_evidence_count=count,
                framework_version=f_ver
            ))
    db.commit()

    # Perform initial ChromaDB sync in background/startup
    try:
        reindex_all_documents(db)
    except Exception as e:
        print(f"[Startup] Vector DB initial sync skipped: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        vdb_stats = get_vector_db_stats()
        return {
            "status": "healthy",
            "database": "connected",
            "vector_db": vdb_stats
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Health check failed: {str(e)}")

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "user": {
            "id": str(user.id), 
            "name": user.name, 
            "email": user.email, 
            "role": user.role,
            "department": user.department
        }
    }

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def process_document_background(document_id: str):
    db = next(get_db())
    coordinator.process_document(document_id, db)

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...), 
    background_tasks: BackgroundTasks = BackgroundTasks(), 
    db: Session = Depends(get_db)
):
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Determine file type
    ext = file.filename.split('.')[-1].lower()
    if ext == 'pdf': file_type = FileTypeEnum.pdf
    elif ext in ['jpg', 'jpeg', 'png']: file_type = FileTypeEnum.image
    elif ext == 'docx': file_type = FileTypeEnum.docx
    elif ext == 'xlsx': file_type = FileTypeEnum.xlsx
    else: file_type = FileTypeEnum.pdf

    from services.duplicate_service import check_exact_duplicate
    exact_dup, file_hash = check_exact_duplicate(file_location, db)

    new_doc = Document(
        original_filename=file.filename,
        file_path=file_location,
        file_type=file_type,
        file_hash=file_hash,
        is_duplicate_of=exact_dup.id if exact_dup else None,
        status=DocumentStatusEnum.processing
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    background_tasks.add_task(process_document_background, str(new_doc.id))
    
    return {"message": "File uploaded successfully", "document": new_doc}

@app.get("/api/documents")
def get_documents(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Document)
    if status:
        query = query.filter(Document.status == status)
    return query.order_by(Document.upload_date.desc()).all()

@app.get("/api/documents/{document_id}")
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == to_uuid(document_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    extracted_fields = db.query(ExtractedField).filter(ExtractedField.document_id == to_uuid(document_id)).all()
    
    mapping = db.query(DocumentMapping).filter(DocumentMapping.document_id == to_uuid(document_id)).first()
    mapping_data = None
    if mapping:
        criterion = db.query(AccreditationCriterion).filter(AccreditationCriterion.id == mapping.metric_id).first()
        if criterion:
            mapping_data = {
                "criterion_name": criterion.criterion_name,
                "key_indicator": criterion.key_indicator,
                "metric_name": criterion.metric_name,
                "confidence": mapping.mapping_confidence
            }
    
    return {
        "document": doc,
        "extracted_fields": extracted_fields,
        "mapping": mapping_data,
        "mapping_id": str(mapping.id) if mapping else None,
        "metric_id": str(mapping.metric_id) if mapping else None
    }

@app.get("/api/criteria")
def get_criteria(db: Session = Depends(get_db)):
    return db.query(AccreditationCriterion).all()

@app.post("/api/documents/{document_id}/verify")
def verify_document(document_id: str, req: VerificationRequest, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == to_uuid(document_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if req.action == 'reject':
        doc.status = DocumentStatusEnum.rejected
    else:
        doc.status = DocumentStatusEnum.verified
        if req.document_type:
            doc.document_type = req.document_type
        if req.academic_year:
            doc.academic_year = req.academic_year
        if req.department:
            doc.department = req.department
            
        if req.extracted_fields:
            for field_name, new_val in req.extracted_fields.items():
                ef = db.query(ExtractedField).filter(
                    ExtractedField.document_id == to_uuid(document_id), 
                    ExtractedField.field_name == field_name
                ).first()
                if ef:
                    ef.field_value = new_val
                else:
                    db.add(ExtractedField(document_id=doc.id, field_name=field_name, field_value=new_val, confidence=1.0))
                    
        mapping = db.query(DocumentMapping).filter(DocumentMapping.document_id == to_uuid(document_id)).first()
        if mapping:
            if req.action == 'correct_and_save':
                mapping.verification_status = VerificationStatusEnum.corrected
                if req.metric_id:
                    mapping.metric_id = to_uuid(req.metric_id)
            else:
                mapping.verification_status = VerificationStatusEnum.approved
        elif req.metric_id:
            # Create new mapping if one did not exist
            new_map = DocumentMapping(
                document_id=doc.id,
                metric_id=to_uuid(req.metric_id),
                mapping_confidence=1.0,
                verification_status=VerificationStatusEnum.approved
            )
            db.add(new_map)

    # Log verification action
    reviewer = db.query(User).first()
    reviewer_id = reviewer.id if reviewer else None

    log = VerificationLog(
        document_id=doc.id,
        reviewer_id=reviewer_id,
        action=req.action,
        remarks=req.remarks
    )
    db.add(log)
    db.commit()

    # Re-index verified document in ChromaDB so search metadata is up to date
    try:
        index_document_for_rag(doc, db)
    except Exception as e:
        print(f"[Verify] Vector DB update error: {e}")

    return {"message": "Verification successfully saved", "status": str(doc.status.value)}

@app.post("/api/documents/batch-verify")
def batch_verify_documents(req: BatchVerificationRequest, db: Session = Depends(get_db)):
    reviewer = db.query(User).first()
    reviewer_id = reviewer.id if reviewer else None
    
    verified_count = 0
    for doc_id in req.document_ids:
        doc = db.query(Document).filter(Document.id == to_uuid(doc_id)).first()
        if not doc:
            continue
        
        if req.action == "approve":
            doc.status = DocumentStatusEnum.verified
            mapping = db.query(DocumentMapping).filter(DocumentMapping.document_id == doc.id).first()
            if mapping:
                mapping.verification_status = VerificationStatusEnum.approved
        elif req.action == "reject":
            doc.status = DocumentStatusEnum.rejected
            
        log = VerificationLog(
            document_id=doc.id,
            reviewer_id=reviewer_id,
            action=req.action,
            remarks=req.remarks or f"Batch {req.action}"
        )
        db.add(log)
        verified_count += 1
        
    db.commit()
    return {"message": f"Successfully processed {verified_count} documents."}

# ==================== PHASE 1: RAG & SEMANTIC SEARCH ====================

@app.post("/api/search/rag")
def natural_language_rag_search(req: RAGSearchRequest, db: Session = Depends(get_db)):
    """
    Accepts natural language queries, performs semantic retrieval from ChromaDB,
    and returns synthesized evidence summaries with citations.
    """
    result = generate_rag_answer(query=req.query, db=db, n_results=req.top_k or 5)
    return result

@app.get("/api/search/semantic")
def semantic_search(
    q: str = Query(..., description="Query text"), 
    top_k: int = Query(5, description="Number of results"),
    doc_type: Optional[str] = Query(None, description="Filter by document type"),
    db: Session = Depends(get_db)
):
    results = search_evidence(query=q, db=db, n_results=top_k, filter_type=doc_type)
    return {"query": q, "results": results, "count": len(results)}

@app.post("/api/rag/reindex")
def trigger_rag_reindex(db: Session = Depends(get_db)):
    count = reindex_all_documents(db)
    return {"message": f"Successfully reindexed {count} documents into ChromaDB."}

# ==================== PHASE 2: GAP ANALYSIS & AUDIT ALERTS ====================

@app.get("/api/audit/gap-analysis")
def get_gap_analysis(db: Session = Depends(get_db)):
    return perform_gap_analysis(db)

@app.get("/api/audit/alerts")
def get_audit_alerts(db: Session = Depends(get_db)):
    alerts = generate_audit_alerts(db)
    return {"alerts": alerts, "total_alerts": len(alerts)}

# ==================== PHASE 3: ANALYTICS & DASHBOARD ====================

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total_docs = db.query(Document).count()
    verified_docs = db.query(Document).filter(Document.status == DocumentStatusEnum.verified).count()
    pending_docs = db.query(Document).filter(Document.status == DocumentStatusEnum.pending_review).count()
    duplicates = db.query(Document).filter(Document.is_duplicate_of.isnot(None)).count()
    
    return {
        "total_documents": total_docs,
        "verified": verified_docs,
        "pending_review": pending_docs,
        "duplicates_flagged": duplicates
    }

@app.get("/api/analytics/dashboard")
def get_analytics_dashboard(db: Session = Depends(get_db)):
    return get_dashboard_analytics(db)

# ==================== PHASE 4: EVIDENCE REPORTS ====================

@app.get("/api/reports/criterion/{criterion_id}")
def get_criterion_evidence_report(criterion_id: str, db: Session = Depends(get_db)):
    report = generate_criterion_report(criterion_id, db)
    if "error" in report:
        raise HTTPException(status_code=404, detail=report["error"])
    return report

@app.get("/api/reports/ssr")
def get_institutional_ssr_report(db: Session = Depends(get_db)):
    return generate_full_ssr_report(db)

@app.get("/api/reports/ssr/markdown", response_class=PlainTextResponse)
def export_ssr_markdown_report(db: Session = Depends(get_db)):
    return export_ssr_markdown(db)

# ==================== PHASE 5: MULTI-AGENT TELEMETRY ====================

@app.get("/api/agents/status")
def get_agents_status():
    return {
        "framework": "Coordinator-Multi-Agent Architecture",
        "active_agents": [
            {"name": "Coordinator Agent", "role": "Pipeline Orchestration & Task Routing", "status": "Active"},
            {"name": "Document Processing Agent", "role": "OCR & Multi-Format Ingestion", "status": "Active"},
            {"name": "Duplicate Detection Agent", "role": "SHA-256 & Semantic Near-Duplicate Screening", "status": "Active"},
            {"name": "Classification Agent", "role": "Document-Type Categorization (NAAC taxonomy)", "status": "Active"},
            {"name": "Information Extraction Agent", "role": "spaCy NER & Schema Field Extraction", "status": "Active"},
            {"name": "Accreditation Mapping Agent", "role": "Semantic Criteria & Metric Alignment", "status": "Active"},
            {"name": "Evidence Validation Agent", "role": "Completeness & Missing Fields Audit", "status": "Active"},
            {"name": "RAG Indexing Agent", "role": "Vector Embedding & ChromaDB Persistent Indexing", "status": "Active"},
            {"name": "Evidence Retrieval Agent", "role": "Natural Language Semantic Querying & Synthesis", "status": "Active"},
            {"name": "Report Generation Agent", "role": "SSR Matrix & Criterion Evidence Dossiers", "status": "Active"}
        ]
    }
