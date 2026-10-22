import os
from typing import List, Dict, Optional, Any
import chromadb
from chromadb.config import Settings

# Persistent storage directory for ChromaDB
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")
os.makedirs(CHROMA_DIR, exist_ok=True)

COLLECTION_NAME = "accreditation_evidence"

_client: Optional[chromadb.PersistentClient] = None
_collection = None

def get_chroma_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=CHROMA_DIR)
    return _client

def get_evidence_collection():
    global _collection
    if _collection is None:
        client = get_chroma_client()
        # Uses Chroma's default all-MiniLM-L6-v2 ONNX embedding pipeline
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"description": "Accreditation evidence text embeddings and metadata"}
        )
    return _collection

def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
    """Splits text into overlapping chunks for finer-grained retrieval."""
    if not text or not text.strip():
        return []
    text = text.strip()
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk.strip())
        if end >= len(text):
            break
        start += chunk_size - overlap
    return [c for c in chunks if c]

def add_document_chunks(
    document_id: str,
    text: str,
    metadata: Dict[str, Any]
) -> int:
    """
    Chunks and indexes a document into ChromaDB.
    Replaces any previous chunks for this document.
    """
    collection = get_evidence_collection()
    
    # Remove existing chunks for this document if any
    try:
        delete_document_from_vector_db(document_id)
    except Exception:
        pass

    chunks = chunk_text(text)
    if not chunks:
        return 0

    ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
    
    # Sanitize metadata for ChromaDB (values must be str, int, float, or bool)
    clean_meta = {}
    for k, v in metadata.items():
        if v is None:
            clean_meta[k] = ""
        elif isinstance(v, (str, int, float, bool)):
            clean_meta[k] = v
        else:
            clean_meta[k] = str(v)
            
    clean_meta["document_id"] = str(document_id)

    metadatas = []
    for i in range(len(chunks)):
        chunk_m = dict(clean_meta)
        chunk_m["chunk_index"] = i
        metadatas.append(chunk_m)

    collection.add(
        documents=chunks,
        ids=ids,
        metadatas=metadatas
    )
    return len(chunks)

def delete_document_from_vector_db(document_id: str) -> None:
    collection = get_evidence_collection()
    try:
        # Query existing IDs with this document_id
        res = collection.get(where={"document_id": str(document_id)})
        if res and res.get("ids"):
            collection.delete(ids=res["ids"])
    except Exception as e:
        print(f"[VectorDB] Warning while deleting doc {document_id}: {e}")

def query_vector_db(
    query_text: str,
    n_results: int = 5,
    where: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Performs semantic vector search over the evidence collection.
    Returns ranked chunks with similarity distance and metadata.
    """
    collection = get_evidence_collection()
    total_docs = collection.count()
    if total_docs == 0:
        return []

    limit = min(n_results, total_docs)
    query_kwargs = {
        "query_texts": [query_text],
        "n_results": limit
    }
    if where:
        query_kwargs["where"] = where

    results = collection.query(**query_kwargs)

    formatted_results = []
    if results and results.get("ids") and len(results["ids"]) > 0:
        ids_list = results["ids"][0]
        docs_list = results["documents"][0] if results.get("documents") else []
        meta_list = results["metadatas"][0] if results.get("metadatas") else []
        dist_list = results["distances"][0] if results.get("distances") else []

        for i in range(len(ids_list)):
            raw_dist = dist_list[i] if i < len(dist_list) else 1.0
            # Convert L2 distance or cosine distance to similarity score in [0, 1]
            similarity = max(0.0, min(1.0, 1.0 - (raw_dist / 2.0)))
            formatted_results.append({
                "chunk_id": ids_list[i],
                "document_id": meta_list[i].get("document_id") if i < len(meta_list) else "",
                "snippet": docs_list[i] if i < len(docs_list) else "",
                "metadata": meta_list[i] if i < len(meta_list) else {},
                "similarity_score": round(similarity, 4),
                "distance": round(raw_dist, 4)
            })

    return formatted_results

def get_vector_db_stats() -> Dict[str, Any]:
    collection = get_evidence_collection()
    return {
        "collection_name": COLLECTION_NAME,
        "total_chunks": collection.count(),
        "storage_path": CHROMA_DIR
    }
