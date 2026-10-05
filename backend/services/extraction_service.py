import spacy
import re
from typing import List, Dict

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # If not found (e.g., download pending), we load it or fallback.
    nlp = None

def extract_information(text: str, document_type: str) -> List[Dict]:
    if not nlp:
        return []

    doc = nlp(text)
    extracted_fields = []
    
    def add_field(name, value, confidence):
        if value:
            extracted_fields.append({
                "field_name": name,
                "field_value": str(value).strip(),
                "confidence": confidence
            })
            
    persons = [ent.text for ent in doc.ents if ent.label_ == 'PERSON']
    orgs = [ent.text for ent in doc.ents if ent.label_ == 'ORG']
    dates = [ent.text for ent in doc.ents if ent.label_ == 'DATE']
    
    if document_type == "faculty_publication":
        doi_match = re.search(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", text, re.I)
        add_field("DOI", doi_match.group(0) if doi_match else None, 0.95 if doi_match else 0)
        
        year_match = re.search(r"\b20\d{2}\b", text)
        add_field("publication_year", year_match.group(0) if year_match else None, 0.8)
        
        add_field("faculty_name", persons[0] if persons else None, 0.7)
        add_field("journal_name", orgs[0] if orgs else None, 0.6)
        
    elif document_type == "fdp_certificate":
        add_field("faculty_name", persons[0] if persons else None, 0.75)
        add_field("organising_institute", orgs[0] if orgs else None, 0.8)
        add_field("start_date", dates[0] if len(dates) > 0 else None, 0.7)
        add_field("end_date", dates[1] if len(dates) > 1 else None, 0.6)
        
    elif document_type == "placement_report":
        lpa_match = re.search(r"\d+(\.\d+)?\s*(LPA|lpa)", text)
        add_field("package", lpa_match.group(0) if lpa_match else None, 0.9)
        
        ay_match = re.search(r"20\d{2}\s*-\s*\d{2,4}", text)
        add_field("academic_year", ay_match.group(0) if ay_match else None, 0.85)
        
        add_field("company_name", orgs[0] if orgs else None, 0.7)
        
        num_match = re.search(r"(\d+)\s*students?", text, re.I)
        add_field("students_placed", num_match.group(1) if num_match else None, 0.75)

    return extracted_fields
