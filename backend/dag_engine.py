from typing import List, Dict, Set, Tuple, Optional
from collections import deque, defaultdict
from models import SubQuestionNode, QuestionPlanDAG


class DAGEngine:
    """
    Validates question dependency DAGs, detects cycles, and calculates topological execution order.
    """

    @staticmethod
    def validate_and_order(
        nodes: List[SubQuestionNode],
        original_question: str,
        final_answer_instruction: Optional[str] = None
    ) -> QuestionPlanDAG:
        if not nodes:
            return QuestionPlanDAG(
                original_question=original_question,
                hops=[],
                nodes=[],
                final_answer_instruction=final_answer_instruction,
                execution_order=[],
                is_valid_dag=False,
                error_message="Plan contains no subquestion nodes."
            )

        for node in nodes:
            if node.purpose and not node.description:
                node.description = node.purpose
            elif node.description and not node.purpose:
                node.purpose = node.description

        # Check duplicate IDs
        id_set = set()
        for node in nodes:
            if node.id in id_set:
                return QuestionPlanDAG(
                    original_question=original_question,
                    hops=nodes,
                    nodes=nodes,
                    final_answer_instruction=final_answer_instruction,
                    execution_order=[],
                    is_valid_dag=False,
                    error_message=f"Duplicate node ID detected: '{node.id}'"
                )
            id_set.add(node.id)

        # Check reference integrity
        for node in nodes:
            for dep in node.depends_on:
                if dep == node.id:
                    return QuestionPlanDAG(
                        original_question=original_question,
                        hops=nodes,
                        nodes=nodes,
                        final_answer_instruction=final_answer_instruction,
                        execution_order=[],
                        is_valid_dag=False,
                        error_message=f"Node '{node.id}' has a self-dependency."
                    )
                if dep not in id_set:
                    return QuestionPlanDAG(
                        original_question=original_question,
                        hops=nodes,
                        nodes=nodes,
                        final_answer_instruction=final_answer_instruction,
                        execution_order=[],
                        is_valid_dag=False,
                        error_message=f"Node '{node.id}' depends on non-existent node '{dep}'."
                    )

        # Kahn's Algorithm for Topological Sort & Cycle Detection
        in_degree: Dict[str, int] = {node.id: 0 for node in nodes}
        adj_list: Dict[str, List[str]] = defaultdict(list)
        node_map: Dict[str, SubQuestionNode] = {node.id: node for node in nodes}

        for node in nodes:
            for dep in node.depends_on:
                adj_list[dep].append(node.id)
                in_degree[node.id] += 1

        queue = deque([node_id for node_id, deg in in_degree.items() if deg == 0])
        execution_order: List[str] = []
        node_levels: Dict[str, int] = {node_id: 0 for node_id in in_degree if in_degree[node_id] == 0}

        while queue:
            curr = queue.popleft()
            execution_order.append(curr)
            curr_level = node_levels.get(curr, 0)

            for neighbor in adj_list[curr]:
                in_degree[neighbor] -= 1
                node_levels[neighbor] = max(node_levels.get(neighbor, 0), curr_level + 1)
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(execution_order) != len(nodes):
            return QuestionPlanDAG(
                original_question=original_question,
                hops=nodes,
                nodes=nodes,
                final_answer_instruction=final_answer_instruction,
                execution_order=[],
                is_valid_dag=False,
                error_message="Cycle detected in subquestion dependencies."
            )

        for node_id, lvl in node_levels.items():
            if node_id in node_map:
                node_map[node_id].level = lvl

        ordered_nodes = [node_map[nid] for nid in execution_order]

        return QuestionPlanDAG(
            original_question=original_question,
            hops=ordered_nodes,
            nodes=ordered_nodes,
            final_answer_instruction=final_answer_instruction,
            execution_order=execution_order,
            is_valid_dag=True,
            error_message=None
        )

    @staticmethod
    def sanitize_or_repair(
        nodes: List[SubQuestionNode],
        original_question: str,
        final_answer_instruction: Optional[str] = None
    ) -> QuestionPlanDAG:
        """
        Repairs broken dependencies by falling back to a linear topological chain.
        """
        for i, node in enumerate(nodes):
            node.depends_on = [nodes[i - 1].id] if i > 0 else []
            node.level = i

        exec_order = [n.id for n in nodes]
        return QuestionPlanDAG(
            original_question=original_question,
            hops=nodes,
            nodes=nodes,
            final_answer_instruction=final_answer_instruction,
            execution_order=exec_order,
            is_valid_dag=True,
            error_message="Repaired cyclic or malformed dependencies into a linear chain."
        )
