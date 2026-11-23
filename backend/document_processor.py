import re
import uuid
from typing import List, Tuple
from datetime import datetime
from models import TextChunk, DocumentInfo


class DocumentProcessor:
    def __init__(self, default_chunk_size: int = 500, default_chunk_overlap: int = 100):
        self.default_chunk_size = default_chunk_size
        self.default_chunk_overlap = default_chunk_overlap

    def clean_text(self, text: str) -> str:
        """Normalize line endings and whitespace."""
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = text.replace("\xa0", " ")
        return text

    def split_into_chunks(
        self,
        text: str,
        doc_id: str,
        doc_name: str,
        chunk_size: int = None,
        chunk_overlap: int = None
    ) -> List[TextChunk]:
        """
        Split a document into overlapping chunks using hierarchical boundary splitting:
        paragraphs -> sentences -> words -> characters.
        """
        chunk_size = chunk_size or self.default_chunk_size
        chunk_overlap = chunk_overlap or self.default_chunk_overlap

        if chunk_overlap >= chunk_size:
            chunk_overlap = max(0, chunk_size // 4)

        text = self.clean_text(text)
        if not text.strip():
            return []

        chunks: List[TextChunk] = []
        start = 0
        total_len = len(text)
        chunk_idx = 0

        while start < total_len:
            end = min(start + chunk_size, total_len)

            if end < total_len:
                lookback_window = text[max(start, end - max(50, chunk_size // 4)):end]
                para_break = lookback_window.rfind("\n\n")
                if para_break != -1:
                    end = (max(start, end - max(50, chunk_size // 4))) + para_break + 2
                else:
                    sentence_matches = list(re.finditer(r'([.!?])(?:\s+|$)', lookback_window))
                    if sentence_matches:
                        last_match = sentence_matches[-1]
                        end = (max(start, end - max(50, chunk_size // 4))) + last_match.end()
                    else:
                        newline_pos = lookback_window.rfind("\n")
                        if newline_pos != -1:
                            end = (max(start, end - max(50, chunk_size // 4))) + newline_pos + 1
                        else:
                            space_pos = lookback_window.rfind(" ")
                            if space_pos != -1:
                                end = (max(start, end - max(50, chunk_size // 4))) + space_pos + 1

            chunk_text = text[start:end].strip()
            if chunk_text:
                chunk = TextChunk(
                    chunk_id=f"{doc_id}_{chunk_idx}",
                    doc_id=doc_id,
                    doc_name=doc_name,
                    chunk_index=chunk_idx,
                    text=chunk_text,
                    start_char=start,
                    end_char=end
                )
                chunks.append(chunk)
                chunk_idx += 1

            if end >= total_len:
                break
            start = max(start + 1, end - chunk_overlap)

        return chunks

    def process_document(
        self,
        content: str,
        filename: str,
        chunk_size: int = None,
        chunk_overlap: int = None
    ) -> Tuple[DocumentInfo, List[TextChunk]]:
        doc_id = str(uuid.uuid4())[:8]
        chunks = self.split_into_chunks(content, doc_id, filename, chunk_size, chunk_overlap)
        doc_info = DocumentInfo(
            id=doc_id,
            filename=filename,
            chunk_count=len(chunks),
            char_count=len(content),
            upload_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        )
        return doc_info, chunks
