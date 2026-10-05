import pymupdf
import pytesseract
import os

if os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

def extract_text_from_file(file_path: str, file_type: str) -> str:
    extracted_text = ""
    try:
        if file_type == 'pdf':
            doc = pymupdf.open(file_path)
            for page in doc:
                text = page.get_text()
                if text:
                    extracted_text += text + "\n"
            doc.close()
            
            if len(extracted_text.strip()) > 50:
                return extracted_text.strip()
                
        elif file_type == 'image':
            if HAS_CV2:
                image = cv2.imread(file_path)
                if image is not None:
                    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                    denoised = cv2.fastNlMeansDenoising(gray, None, h=10, searchWindowSize=21, templateWindowSize=7)
                    try:
                        extracted_text = pytesseract.image_to_string(denoised)
                    except Exception as e:
                        raise Exception(f"Tesseract failed: {e}")
            else:
                raise Exception("OpenCV not installed or failed to import. OCR cannot run on images.")

        if not extracted_text.strip():
            raise Exception("No text could be extracted using OCR or native PDF parsing.")

        return extracted_text.strip()
    except Exception as e:
        raise Exception(f"OCR Failed: {str(e)}")
