from typing import List
from models import FinalAnswerResponse, QuestionPlanDAG, HopExecutionResult
from evidence_manager import EvidenceManager
from llm_client import LLMClient


class AnswerGenerator:
    """
    Synthesizes intermediate hop reasoning and supporting text chunks into a cohesive,
    well-grounded final answer with source document citations.
    """

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def generate_response(
        self,
        original_question: str,
        plan: QuestionPlanDAG,
        intermediate_hops: List[HopExecutionResult],
        evidence_mgr: EvidenceManager,
        elapsed_seconds: float = 0.0
    ) -> FinalAnswerResponse:
        context_prompt = evidence_mgr.format_final_context_prompt()

        final_text = await self.llm.generate_final_answer(
            original_question=original_question,
            evidence_prompt_context=context_prompt,
            plan=plan,
            intermediate_hops=intermediate_hops
        )

        citations = evidence_mgr.build_citations()
        total_chunks = sum(len(h.retrieved_chunks) for h in intermediate_hops)

        return FinalAnswerResponse(
            original_question=original_question,
            plan=plan,
            intermediate_hops=intermediate_hops,
            final_answer=final_text,
            citations=citations,
            total_retrieved_chunks=total_chunks,
            timing_seconds=round(elapsed_seconds, 2)
        )
