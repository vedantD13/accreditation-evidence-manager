import hashlib
from sqlalchemy.orm import Session
from models import Document
from sqlalchemy import text

try:
    from sentence_transformers import SentenceTransformer, util
    model = SentenceTransformer('all-MiniLM-L6-v2')
    HAS_ST = True
except Exception:
    HAS_ST = False

def calculate_file_hash(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()

def check_exact_duplicate(file_path: str, db: Session) -> Document:
    file_hash = calculate_file_hash(file_path)
    duplicate = db.query(Document).filter(Document.file_hash == file_hash).first()
    return duplicate, file_hash

def check_near_duplicate(current_doc: Document, ocr_text: str, db: Session) -> Document:
    if not HAS_ST or not ocr_text.strip():
        return None
        
    all_docs = db.query(Document).filter(
        Document.id != current_doc.id, 
        Document.ocr_text.isnot(None),
        Document.status != 'rejected'
    ).all()
    
    if not all_docs:
        return None
        
    current_embedding = model.encode(ocr_text[:2000], convert_to_tensor=True)
    
    best_duplicate = None
    highest_sim = 0.0
    
    for doc in all_docs:
        doc_embedding = model.encode(doc.ocr_text[:2000], convert_to_tensor=True)
        sim = util.cos_sim(current_embedding, doc_embedding).item()
        
        if sim > highest_sim and sim > 0.92:
            highest_sim = sim
            best_duplicate = doc
            
    return best_duplicate
