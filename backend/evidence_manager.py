from typing import List, Dict, Optional, Any
from models import ChunkSearchResult, HopExecutionResult, CitationItem


class EvidenceManager:
    """
    Manages intermediate reasoning results and retrieved evidence across DAG hops.
    Provides context formatting for downstream hops and final grounded synthesis.
    """

    def __init__(self):
        self.hops: List[HopExecutionResult] = []
        self._hop_by_id: Dict[str, HopExecutionResult] = {}
        self._all_chunks: Dict[str, ChunkSearchResult] = {}

    def add_hop_result(self, result: HopExecutionResult):
        self.hops.append(result)
        self._hop_by_id[result.node_id] = result
        for chunk in result.retrieved_chunks:
            if chunk.chunk_id not in self._all_chunks:
                self._all_chunks[chunk.chunk_id] = chunk

    def get_hop_result(self, node_id: str) -> Optional[HopExecutionResult]:
        return self._hop_by_id.get(node_id)

    def get_parent_evidence_context(self, parent_ids: List[str]) -> str:
        """
        Builds a readable summary of dependencies to inform the next hop query & answer.
        """
        if not parent_ids:
            return ""

        context_lines = []
        for pid in parent_ids:
            hop = self._hop_by_id.get(pid)
            if hop:
                context_lines.append(f"Subquestion [{hop.node_id}]: {hop.question}")
                context_lines.append(f"Answer [{hop.node_id}]: {hop.answer.strip()}")
        return "\n".join(context_lines)

    def build_citations(self) -> List[CitationItem]:
        """
        Generates a deduplicated list of numbered citations for the final answer.
        """
        citations: List[CitationItem] = []
        seen_chunk_ids = set()
        cit_num = 1

        for hop in self.hops:
            for chunk in hop.retrieved_chunks:
                if chunk.chunk_id not in seen_chunk_ids:
                    seen_chunk_ids.add(chunk.chunk_id)
                    snippet = chunk.text[:180].replace("\n", " ").strip() + "..."
                    citations.append(CitationItem(
                        citation_id=cit_num,
                        doc_name=chunk.doc_name,
                        chunk_index=chunk.chunk_index,
                        chunk_id=chunk.chunk_id,
                        snippet=snippet,
                        score=round(chunk.score, 4)
                    ))
                    cit_num += 1

        return citations

    def format_final_context_prompt(self) -> str:
        """
        Creates structured context with intermediate QA and supporting passages.
        """
        sections = []

        qa_section = ["### Intermediate Hop Findings:"]
        for hop in self.hops:
            qa_section.append(f"- Subquestion: {hop.question}")
            qa_section.append(f"  Intermediate Answer: {hop.answer}")
        sections.append("\n".join(qa_section))

        passage_section = ["### Supporting Document Passages:"]
        seen_chunks = set()
        idx = 1
        for hop in self.hops:
            for chunk in hop.retrieved_chunks:
                if chunk.chunk_id not in seen_chunks:
                    seen_chunks.add(chunk.chunk_id)
                    passage_section.append(
                        f"[Passage {idx}] Source: {chunk.doc_name} (Chunk #{chunk.chunk_index}):\n\"{chunk.text.strip()}\"\n"
                    )
                    idx += 1
        sections.append("\n".join(passage_section))

        return "\n\n".join(sections)
