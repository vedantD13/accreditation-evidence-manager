import string
from typing import List, Tuple
from sqlalchemy.orm import Session
from models import AccreditationCriterion, DocumentMapping, to_uuid

try:
    from sentence_transformers import SentenceTransformer, util
    model = SentenceTransformer('all-MiniLM-L6-v2')
    HAS_ST = True
except Exception:
    HAS_ST = False

def jaccard_similarity(s1: str, s2: str) -> float:
    set1 = set(s1.lower().translate(str.maketrans('', '', string.punctuation)).split())
    set2 = set(s2.lower().translate(str.maketrans('', '', string.punctuation)).split())
    if not set1 or not set2:
        return 0.0
    return len(set1.intersection(set2)) / len(set1.union(set2))

def map_document_to_metrics(document_id: str, document_type: str, ocr_text: str, db: Session) -> None:
    target_metric_keyword = ""
    if document_type == "faculty_publication":
        target_metric_keyword = "research papers published"
    elif document_type == "fdp_certificate":
        target_metric_keyword = "professional development"
    elif document_type == "placement_report":
        target_metric_keyword = "placement"
        
    criteria = db.query(AccreditationCriterion).all()
    if not criteria:
        return
        
    best_match = None
    best_score = 0.0
    
    if HAS_ST and ocr_text:
        doc_embedding = model.encode(ocr_text[:1000], convert_to_tensor=True) # limit text length for speed
        for c in criteria:
            metric_embedding = model.encode(c.metric_name, convert_to_tensor=True)
            score = util.cos_sim(doc_embedding, metric_embedding).item()
            if target_metric_keyword and target_metric_keyword in c.metric_name.lower():
                score += 0.4 
            if score > best_score:
                best_score = score
                best_match = c
    else:
        for c in criteria:
            score = jaccard_similarity(ocr_text, c.metric_name)
            if target_metric_keyword and target_metric_keyword in c.metric_name.lower():
                score += 0.8
            if score > best_score:
                best_score = score
                best_match = c
                
    if best_match:
        final_confidence = min(max(best_score, 0.1), 0.98)
        mapping = DocumentMapping(
            document_id=to_uuid(document_id),
            metric_id=to_uuid(best_match.id),
            mapping_confidence=final_confidence
        )
        db.add(mapping)
        db.commit()
