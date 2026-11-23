import logging
from typing import List, Dict, Callable, Optional
from models import QuestionPlanDAG, HopExecutionResult, ChunkSearchResult, SubQuestionNode
from vector_store import VectorStore
from evidence_manager import EvidenceManager
from llm_client import LLMClient

logger = logging.getLogger(__name__)


class HopExecutor:
    """
    Executes subquestions sequentially along the DAG's topological order.
    For each hop:
      1. Aggregates context from prerequisite parent hops.
      2. Expands/contextualizes the search query for vector retrieval.
      3. Retrieves relevant chunks from FAISS.
      4. Synthesizes an intermediate answer.
      5. Commits intermediate findings to the EvidenceManager.
    """

    def __init__(self, vector_store: VectorStore, llm_client: LLMClient, evidence_manager: EvidenceManager):
        self.vector_store = vector_store
        self.llm = llm_client
        self.evidence_mgr = evidence_manager

    async def execute_plan(
        self,
        plan: QuestionPlanDAG,
        top_k: int = 3,
        step_callback: Optional[Callable[[SubQuestionNode, str], None]] = None
    ) -> List[HopExecutionResult]:
        node_map: Dict[str, SubQuestionNode] = {node.id: node for node in plan.nodes}
        hop_results: List[HopExecutionResult] = []

        for node_id in plan.execution_order:
            node = node_map[node_id]
            node.status = "running"
            if step_callback:
                step_callback(node, "Starting retrieval")

            # 1. Fetch prerequisite context from parent nodes
            parent_context = self.evidence_mgr.get_parent_evidence_context(node.depends_on)

            # 2. Contextualize query
            contextualized_query = await self.llm.contextualize_query(node.question, parent_context)
            node.contextualized_query = contextualized_query

            # 3. Vector similarity search via FAISS
            raw_chunks = self.vector_store.search(contextualized_query, top_k=top_k)
            retrieved = [
                ChunkSearchResult(
                    chunk_id=c["chunk_id"],
                    doc_id=c["doc_id"],
                    doc_name=c["doc_name"],
                    chunk_index=c["chunk_index"],
                    text=c["text"],
                    score=c.get("score", 0.0)
                )
                for c in raw_chunks
            ]
            node.retrieved_chunks = retrieved

            # 4. Generate intermediate answer for this hop
            answer = await self.llm.answer_hop(
                subquestion=node.question,
                retrieved_chunks=retrieved,
                parent_evidence_text=parent_context,
                contextualized_query=contextualized_query
            )
            node.answer = answer
            node.status = "completed"

            # 5. Record hop result
            hop_res = HopExecutionResult(
                node_id=node.id,
                question=node.question,
                contextualized_query=contextualized_query,
                retrieved_chunks=retrieved,
                answer=answer,
                reasoning=f"Answered based on {len(retrieved)} retrieved passages and {len(node.depends_on)} parent hops."
            )
            self.evidence_mgr.add_hop_result(hop_res)
            hop_results.append(hop_res)

            if step_callback:
                step_callback(node, "Completed")

        return hop_results
