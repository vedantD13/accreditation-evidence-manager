import os
import shutil
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from db import engine, get_db, Base
from config import settings
from models import User, Document, ExtractedField, DocumentStatusEnum, FileTypeEnum, RoleEnum, VerificationLog, VerificationStatusEnum, AccreditationCriterion, DocumentMapping
from auth import verify_password, get_password_hash, create_access_token, get_current_user, timedelta, ACCESS_TOKEN_EXPIRE_MINUTES
from services.ocr_service import extract_text_from_file
from services.classification_service import classify_document
from services.extraction_service import extract_information
from services.mapping_service import map_document_to_metrics
from typing import Optional, Dict
from pydantic import BaseModel

class VerificationRequest(BaseModel):
    action: str
    remarks: Optional[str] = None
    extracted_fields: Optional[Dict[str, str]] = None
    metric_id: Optional[str] = None
    document_type: Optional[str] = None

app = FastAPI(title=settings.PROJECT_NAME)

@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    db.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash VARCHAR;"))
    db.commit()
    
    if not db.query(User).filter(User.email == "faculty@test.com").first():
        test_user = User(
            name="Test Faculty",
            email="faculty@test.com",
            password_hash=get_password_hash("password123"),
            role=RoleEnum.faculty,
            department="Computer Science"
        )
        db.add(test_user)
        db.commit()

    from models import AccreditationCriterion
    if not db.query(AccreditationCriterion).first():
        criteria = [
            AccreditationCriterion(criterion_name="Research, Innovations and Extension", key_indicator="Research Publications", metric_name="Number of research papers published per teacher in the Journals notified on UGC website", required_evidence_count=50, framework_version="NAAC-2024"),
            AccreditationCriterion(criterion_name="Faculty Empowerment Strategies", key_indicator="Professional Development", metric_name="Average number of professional development /administrative training programs organized by the institution", required_evidence_count=10, framework_version="NAAC-2024"),
            AccreditationCriterion(criterion_name="Student Support and Progression", key_indicator="Student Progression", metric_name="Average percentage of placement of outgoing students", required_evidence_count=5, framework_version="NAAC-2024")
        ]
        db.add_all(criteria)
        db.commit()

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
        # Test database connection
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")

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
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role}}

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def process_document_background(document_id: str):
    db = next(get_db())
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return
        
    try:
        # OCR Phase
        ocr_text = extract_text_from_file(doc.file_path, doc.file_type)
        doc.ocr_text = ocr_text
        doc.status = DocumentStatusEnum.ocr_complete
        db.commit()
        
        # Duplicate Check (Near)
        if not doc.is_duplicate_of:
            from services.duplicate_service import check_near_duplicate
            near_dup = check_near_duplicate(doc, ocr_text, db)
            if near_dup:
                doc.is_duplicate_of = near_dup.id
                db.commit()

        # Classification Phase
        doc_type, confidence = classify_document(ocr_text)
        doc.document_type = doc_type
        doc.classification_confidence = confidence
        
        # Extraction Phase
        fields = extract_information(ocr_text, doc_type)
        for f in fields:
            ef = ExtractedField(
                document_id=doc.id,
                field_name=f["field_name"],
                field_value=f["field_value"],
                confidence=f["confidence"]
            )
            db.add(ef)
            
        # Mapping Phase
        map_document_to_metrics(str(doc.id), doc_type, ocr_text, db)
            
        doc.status = DocumentStatusEnum.pending_review
        db.commit()
        
    except Exception as e:
        print(f"Error processing document {document_id}: {e}")
        doc.status = DocumentStatusEnum.ocr_failed
        db.commit()

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
    else: file_type = FileTypeEnum.pdf # fallback

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
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    extracted_fields = db.query(ExtractedField).filter(ExtractedField.document_id == document_id).all()
    
    from models import DocumentMapping, AccreditationCriterion
    mapping = db.query(DocumentMapping).filter(DocumentMapping.document_id == document_id).first()
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
        "mapping_id": mapping.id if mapping else None,
        "metric_id": mapping.metric_id if mapping else None
    }

@app.get("/api/criteria")
def get_criteria(db: Session = Depends(get_db)):
    return db.query(AccreditationCriterion).all()

@app.post("/api/documents/{document_id}/verify")
def verify_document(document_id: str, req: VerificationRequest, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if req.action == 'reject':
        doc.status = DocumentStatusEnum.rejected
    else:
        doc.status = DocumentStatusEnum.verified
        if req.document_type:
            doc.document_type = req.document_type
            
        if req.extracted_fields:
            for field_name, new_val in req.extracted_fields.items():
                ef = db.query(ExtractedField).filter(ExtractedField.document_id == document_id, ExtractedField.field_name == field_name).first()
                if ef:
                    ef.field_value = new_val
                else:
                    db.add(ExtractedField(document_id=doc.id, field_name=field_name, field_value=new_val, confidence=1.0))
                    
        mapping = db.query(DocumentMapping).filter(DocumentMapping.document_id == document_id).first()
        if mapping:
            if req.action == 'correct_and_save':
                mapping.verification_status = VerificationStatusEnum.corrected
                if req.metric_id:
                    mapping.metric_id = req.metric_id
            else:
                mapping.verification_status = VerificationStatusEnum.approved

    # Hardcoding a dummy user ID for now since auth isn't fully implemented on frontend
    reviewer_id = db.query(User).first().id 

    log = VerificationLog(
        document_id=doc.id,
        reviewer_id=reviewer_id,
        action=req.action,
        remarks=req.remarks
    )
    db.add(log)
    db.commit()
    return {"message": "Verification saved"}

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
