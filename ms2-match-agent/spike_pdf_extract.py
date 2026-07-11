import pdfplumber
import sys

def extract_text(pdf_path: str)-> str:
    text_parts=[]
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text_parts.append(page.extract_text() or "")
        return "\n".join(text_parts)

if __name__ =="__main__":
    if len(sys.argv)<2:
        print("Usage: python spike_pdf_extract.py <path_to_pdf")
        sys.exit(1)
    
    pdf_path=sys.argv[1]
    extracted =extract_text(pdf_path)
    print("--- Extracted text---")
    print(extracted)
    print(f"\n---total characters: {len(extracted)} ---")