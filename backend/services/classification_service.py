def classify_document(text: str) -> tuple[str, float]:
    """
    Rule-based stub for Phase 2.
    Returns (document_type, confidence)
    """
    text_lower = text.lower()
    
    # 1. Faculty Publication
    if 'doi' in text_lower or 'journal' in text_lower or 'publication' in text_lower:
        return ('faculty_publication', 0.85)
        
    # 2. FDP Certificate
    if 'certificate' in text_lower or 'completion' in text_lower or 'fdp' in text_lower:
        return ('fdp_certificate', 0.90)
        
    # 3. Placement Report
    if 'placed' in text_lower or 'package' in text_lower or 'company' in text_lower or 'recruitment' in text_lower:
        return ('placement_report', 0.88)
        
    # Fallback
    return ('unknown', 0.40)
