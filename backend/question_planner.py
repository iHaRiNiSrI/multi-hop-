from typing import List, Optional, Dict, Any
from models import SubQuestionNode, QuestionPlanDAG
from dag_engine import DAGEngine
from llm_client import LLMClient


class QuestionPlanner:
    """
    Decomposes a complex user question into a directed acyclic graph (DAG) of subquestions.
    Uses the LLM client and verifies graph properties with DAGEngine.
    """

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def create_plan(self, question: str, doc_preview: str = "") -> QuestionPlanDAG:
        raw_plan = await self.llm.plan_subquestions(question, doc_preview)

        if isinstance(raw_plan, dict):
            raw_nodes = raw_plan.get("hops", raw_plan.get("nodes", []))
            final_instruction = raw_plan.get("final_answer_instruction", None)
            orig_q = raw_plan.get("original_question", question)
        elif isinstance(raw_plan, list):
            raw_nodes = raw_plan
            final_instruction = None
            orig_q = question
        else:
            raw_nodes = []
            final_instruction = None
            orig_q = question

        nodes: List[SubQuestionNode] = []
        for n in raw_nodes:
            purpose_text = str(n.get("purpose", n.get("description", "")))
            node = SubQuestionNode(
                id=str(n.get("id", f"H{len(nodes)+1}")),
                question=str(n.get("question", "")),
                depends_on=[str(d) for d in n.get("depends_on", [])],
                purpose=purpose_text,
                description=purpose_text
            )
            nodes.append(node)

        plan = DAGEngine.validate_and_order(nodes, orig_q, final_answer_instruction=final_instruction)
        if not plan.is_valid_dag:
            plan = DAGEngine.sanitize_or_repair(nodes, orig_q, final_answer_instruction=final_instruction)

        return plan
