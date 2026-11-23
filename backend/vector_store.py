import os
import json
import logging
from typing import List, Dict, Optional, Tuple
import numpy as np

# Cache preference for Hugging Face models
cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
if os.path.exists(cache_dir):
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"

logger = logging.getLogger(__name__)


class VectorStore:
    """
    Local Vector Store using Sentence Transformers for embeddings and FAISS for indexing.
    Maintains synchronized metadata linking each FAISS vector index to the TextChunk.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2", storage_dir: Optional[str] = None):
        self.model_name = model_name
        if storage_dir is None:
            self.storage_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
        else:
            self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)

        self._model = None
        self._index = None
        self._chunks: List[dict] = []
        self.dimension = 384

    def _get_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info(f"Loading local SentenceTransformer: {self.model_name}...")
                try:
                    self._model = SentenceTransformer(self.model_name, local_files_only=True)
                except Exception:
                    self._model = SentenceTransformer(self.model_name)

                test_emb = self._model.encode(["test"])
                self.dimension = test_emb.shape[1]
                logger.info(f"Embedding model loaded with dimension: {self.dimension}")
            except Exception as e:
                logger.warning(f"Could not load SentenceTransformer ({e}). Using TF-IDF/Dense fallback.")
                self._model = "fallback"
        return self._model

    def _get_faiss_index(self):
        import faiss
        if self._index is None:
            index_path = os.path.join(self.storage_dir, "faiss.index")
            if os.path.exists(index_path) and os.path.getsize(index_path) > 0:
                try:
                    self._index = faiss.read_index(index_path)
                    logger.info(f"Loaded existing FAISS index with {self._index.ntotal} vectors.")
                except Exception as e:
                    logger.warning(f"Could not load FAISS index: {e}. Creating new index.")
                    self._index = faiss.IndexFlatIP(self.dimension)
            else:
                self._index = faiss.IndexFlatIP(self.dimension)
        return self._index

    def _embed(self, texts: List[str]) -> np.ndarray:
        model = self._get_model()
        if model != "fallback":
            embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
            return np.array(embeddings, dtype=np.float32)
        else:
            # Fallback simple hashing embedding if torch/transformers unavailable
            embs = []
            for t in texts:
                v = np.zeros(self.dimension, dtype=np.float32)
                for i, w in enumerate(t.lower().split()[:self.dimension]):
                    v[i % self.dimension] += hash(w) % 100 / 100.0
                norm = np.linalg.norm(v)
                embs.append(v / (norm + 1e-9))
            return np.array(embs, dtype=np.float32)

    def add_chunks(self, chunks: List[dict]):
        if not chunks:
            return

        texts = [c["text"] for c in chunks]
        embeddings = self._embed(texts)

        index = self._get_faiss_index()
        index.add(embeddings)

        self._chunks.extend(chunks)
        self.save_state()
        logger.info(f"Added {len(chunks)} chunks to vector store. Total chunks: {len(self._chunks)}")

    def search(self, query: str, top_k: int = 3) -> List[dict]:
        if not self._chunks or len(self._chunks) == 0:
            return []

        # Ensure index has vectors
        index = self._get_faiss_index()
        if index.ntotal == 0:
            return []

        # If index and chunks are desynchronized, rebuild index
        if index.ntotal != len(self._chunks):
            logger.warning(f"FAISS desync detected (index={index.ntotal}, chunks={len(self._chunks)}). Rebuilding index.")
            import faiss
            self._index = faiss.IndexFlatIP(self.dimension)
            all_texts = [c["text"] for c in self._chunks]
            embs = self._embed(all_texts)
            self._index.add(embs)
            self.save_state()
            index = self._index

        query_emb = self._embed([query])
        k = min(top_k, index.ntotal)
        scores, indices = index.search(query_emb, k)

        results = []
        for rank, (score, idx) in enumerate(zip(scores[0], indices[0])):
            if 0 <= idx < len(self._chunks):
                chunk = dict(self._chunks[idx])
                chunk["score"] = float(score)
                chunk["rank"] = rank + 1
                results.append(chunk)

        return results

    def remove_document(self, doc_id: str) -> int:
        initial_count = len(self._chunks)
        self._chunks = [c for c in self._chunks if c.get("doc_id") != doc_id]
        removed = initial_count - len(self._chunks)

        if removed > 0:
            import faiss
            self._index = faiss.IndexFlatIP(self.dimension)
            if self._chunks:
                texts = [c["text"] for c in self._chunks]
                embeddings = self._embed(texts)
                self._index.add(embeddings)
            self.save_state()

        return removed

    def clear(self):
        import faiss
        self._chunks = []
        self._index = faiss.IndexFlatIP(self.dimension)
        self.save_state()
        logger.info("Cleared VectorStore index and chunks.")

    def save_state(self):
        import faiss
        index_path = os.path.join(self.storage_dir, "faiss.index")
        meta_path = os.path.join(self.storage_dir, "metadata.json")

        if self._index is not None:
            faiss.write_index(self._index, index_path)

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(self._chunks, f, ensure_ascii=False, indent=2)

    def load_state(self):
        meta_path = os.path.join(self.storage_dir, "metadata.json")
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    self._chunks = json.load(f)
                self._get_faiss_index()
                logger.info(f"VectorStore loaded state: {len(self._chunks)} chunks.")
            except Exception as e:
                logger.warning(f"Error loading VectorStore state: {e}")

    def get_stats(self) -> dict:
        unique_docs = len(set(c.get("doc_id", "") for c in self._chunks if c.get("doc_id")))
        return {
            "total_chunks": len(self._chunks),
            "unique_documents": unique_docs,
            "dimension": self.dimension,
            "embedding_model": self.model_name
        }

    def get_all_chunks(self) -> List[dict]:
        return list(self._chunks)
