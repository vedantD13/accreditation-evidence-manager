# AI-Driven Accreditation Evidence Management & Intelligent Retrieval Framework

An institutional compliance platform utilizing **OCR, NLP, RAG, and Human-in-the-Loop Validation** to digitize, classify, map, and retrieve accreditation evidence aligned with the **NAAC-2024** framework.

---

## Quick Start (How to Run)

Both services can be started in separate terminal windows:

### 1. Start the Backend Server (FastAPI + Uvicorn + ChromaDB)

Open a terminal in the project root:

```powershell
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

- **Backend API**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

### 2. Start the Frontend Application (React + Vite + TailwindCSS)

Open a second terminal in the project root:

```powershell
cd frontend
npm run dev
```

- **Frontend App**: [http://localhost:5173/](http://localhost:5173/)

---

## Key Modules & Routes

| Module | URL Path | Description |
|---|---|---|
| **Readiness Dashboard** | `/` | Real-time KPI counters, institutional grade assessment, criterion progress, and audit alerts. |
| **Upload Evidence** | `/upload` | Drag-and-drop ingestion supporting PDF, DOCX, XLSX, JPG, PNG with OCR processing. |
| **Document Library** | `/library` | Searchable catalog of digitized evidence, classifications, and extracted metadata. |
| **Faculty Verification** | `/verification` | Human-in-the-loop review queue for validating AI mappings and correcting extracted fields. |
| **Intelligent Search (RAG)** | `/search` | Natural-language query interface with ChromaDB vector search and AI synthesized evidence answers. |
| **Accreditation Reports** | `/reports` | Criterion-wise evidence dossiers and exportable institutional Self-Study Reports (SSR). |

---

## Multi-Agent Architecture

When a document is uploaded, the **Coordinator Agent** orchestrates the ingestion pipeline through 7 specialized agents:

1. **Document Processing Agent**: PyMuPDF & Tesseract OCR text extraction.
2. **Duplicate Detection Agent**: Exact SHA-256 hash & semantic near-duplicate screening.
3. **Classification Agent**: Categorizes into NAAC evidence types (*Faculty Publication*, *Placement Report*, *FDP Certificate*, etc.).
4. **Information Extraction Agent**: Extracts NER entities (DOI, faculty name, package, dates, journal).
5. **Accreditation Mapping Agent**: Calculates cosine similarity against all 7 NAAC criteria and metrics.
6. **Evidence Validation Agent**: Audits mandatory fields and identifies deficits.
7. **RAG Indexing Agent**: Chunks and embeds text into persistent ChromaDB storage.

---

## Key API Endpoints

- `GET /api/analytics/dashboard`: Institutional readiness percentage, criterion breakdown, active alerts.
- `GET /api/audit/gap-analysis`: Complete compliance gap analysis across all criteria.
- `GET /api/audit/alerts`: Active alerts categorized by `critical`, `warning`, and `info`.
- `POST /api/search/rag`: Semantic natural language Q&A with evidence citations.
- `GET /api/search/semantic`: Lightweight vector search over indexed chunks.
- `GET /api/reports/ssr`: Full institutional Self-Study Report JSON.
- `GET /api/reports/ssr/markdown`: Downloadable GitHub-flavored Markdown report.
- `GET /api/agents/status`: Multi-agent pipeline status and agent telemetry.
