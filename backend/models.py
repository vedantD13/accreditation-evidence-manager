import enum
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Enum, Uuid
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from db import Base

def to_uuid(val):
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, AttributeError):
        return val

class RoleEnum(str, enum.Enum):
    faculty = "faculty"
    hod = "hod"
    iqac_admin = "iqac_admin"

class FileTypeEnum(str, enum.Enum):
    pdf = "pdf"
    image = "image"
    docx = "docx"
    xlsx = "xlsx"

class DocumentStatusEnum(str, enum.Enum):
    processing = "processing"
    ocr_complete = "ocr_complete"
    ocr_failed = "ocr_failed"
    pending_review = "pending_review"
    verified = "verified"
    rejected = "rejected"

class VerificationStatusEnum(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    corrected = "corrected"
    rejected = "rejected"

class User(Base):
    __tablename__ = "users"
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    department = Column(String)

class Document(Base):
    __tablename__ = "documents"
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uploaded_by = Column(Uuid(as_uuid=True), ForeignKey("users.id"))
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(Enum(FileTypeEnum), nullable=False)
    file_hash = Column(String, nullable=True)
    ocr_text = Column(String)
    document_type = Column(String)
    classification_confidence = Column(Float)
    academic_year = Column(String)
    department = Column(String)
    upload_date = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(DocumentStatusEnum), default=DocumentStatusEnum.pending_review)
    is_duplicate_of = Column(Uuid(as_uuid=True), ForeignKey("documents.id"), nullable=True)

    uploader = relationship("User", foreign_keys=[uploaded_by])

class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(Uuid(as_uuid=True), ForeignKey("documents.id"))
    field_name = Column(String, nullable=False)
    field_value = Column(String)
    confidence = Column(Float)

    document = relationship("Document")

class AccreditationCriterion(Base):
    __tablename__ = "accreditation_criteria"
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    criterion_name = Column(String, nullable=False)
    key_indicator = Column(String, nullable=False)
    metric_name = Column(String, nullable=False)
    required_evidence_count = Column(Integer)
    framework_version = Column(String, nullable=False)

class DocumentMapping(Base):
    __tablename__ = "document_mappings"
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(Uuid(as_uuid=True), ForeignKey("documents.id"))
    metric_id = Column(Uuid(as_uuid=True), ForeignKey("accreditation_criteria.id"))
    mapping_confidence = Column(Float)
    verified_by = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verification_status = Column(Enum(VerificationStatusEnum), default=VerificationStatusEnum.pending)

    document = relationship("Document")
    metric = relationship("AccreditationCriterion")
    verifier = relationship("User")

class VerificationLog(Base):
    __tablename__ = "verification_logs"
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(Uuid(as_uuid=True), ForeignKey("documents.id"))
    reviewer_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"))
    action = Column(String, nullable=False)  # approve/correct/reject
    remarks = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document")
    reviewer = relationship("User")
