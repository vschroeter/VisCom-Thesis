from __future__ import annotations

import networkx as nx

from .graph_metric_calculator import GraphMetricCalculator
from .metrics_calculator import MetricResult, NodeCircle


class StressMetricCalculator(GraphMetricCalculator):
    """
    Calculator for measuring stress in graph layouts.

    Stress measures how well the Euclidean distances between nodes in the layout
    match the shortest path distances in the graph structure, with scale invariance.

    Lower stress values indicate that the layout better preserves the graph structure,
    providing a more accurate visualization of the relationships between nodes.
    """

    API_METHOD_NAME = "stress"

    def calculate(self) -> MetricResult:
        """
        Calculate the stress of the graph embedding with optimal scaling.

        Formula:
        S = (sum((δ_ij - α*d_ij)²)) / (sum(δ_ij²))

        where:
        - α = (sum(δ_ij * d_ij)) / (sum(d_ij²)) is the optimal scaling factor
        - d_ij is the Euclidean distance between nodes i and j in the 2D layout
        - δ_ij is the graph-theoretical distance (shortest path) between nodes i and j

        For disconnected nodes, we use the maximum shortest path distance found in the graph.

        Returns:
            MetricResult: The stress metric result.
        """
        # Use the graph for stress calculation
        graph = self.get_graph()

        # Calculate shortest paths between all nodes
        try:
            shortest_paths = dict(nx.all_pairs_dijkstra_path_length(graph, weight="distance"))
        except Exception as e:
            return MetricResult(key=self.API_METHOD_NAME, value=1.0, type="lower-better", error=f"Error computing shortest paths: {str(e)}")

        # Find the longest shortest path for disconnected components
        max_distance = 0
        for source_dict in shortest_paths.values():
            if source_dict:
                max_distance = max(max_distance, max(source_dict.values()))
        if max_distance == 0:
            max_distance = 1  # Fallback if we have no paths

        # Initialize variables for calculating alpha
        sum_product_delta_d = 0  # Σ(δ_ij · d_ij)
        sum_squared_d = 0  # Σ(d_ij²)
        sum_squared_delta = 0  # Σ(δ_ij²)

        # First pass: collect data for alpha calculation
        for i in self.node_circles:
            for j in self.node_circles:
                if i != j:
                    # Calculate Euclidean distance in the layout
                    d_ij = NodeCircle.euclidean_distance(self.node_circles[i], self.node_circles[j])

                    # Get shortest path distance
                    if j in shortest_paths.get(i, {}):
                        delta_ij = shortest_paths[i][j]
                    else:
                        # Use max distance for disconnected nodes
                        delta_ij = max_distance

                    # Update sums for alpha calculation
                    sum_product_delta_d += delta_ij * d_ij
                    sum_squared_d += d_ij * d_ij
                    sum_squared_delta += delta_ij * delta_ij

        # Handle edge cases
        if sum_squared_d == 0 or sum_squared_delta == 0:
            return MetricResult(
                key=self.API_METHOD_NAME,
                value=1.0,  # Worst stress value
                type="lower-better",
                error="Unable to compute stress (no valid distances)",
            )

        # Calculate the optimal scaling factor alpha
        alpha = sum_product_delta_d / sum_squared_d

        # Calculate the stress numerator: Σ[i,j] [δ_ij - α·d_ij]²
        sum_squared_diff = 0

        # Second pass: calculate stress with optimal scaling
        for i in self.node_circles:
            for j in self.node_circles:
                if i != j:
                    # Calculate Euclidean distance in the layout
                    d_ij = NodeCircle.euclidean_distance(self.node_circles[i], self.node_circles[j])

                    # Get shortest path distance
                    if j in shortest_paths.get(i, {}):
                        delta_ij = shortest_paths[i][j]
                    else:
                        # Use max distance for disconnected nodes
                        delta_ij = max_distance

                    # Calculate squared difference with optimal scaling
                    squared_diff = (delta_ij - alpha * d_ij) ** 2
                    sum_squared_diff += squared_diff

        # Calculate final stress as normalized squared difference
        stress = sum_squared_diff / sum_squared_delta

        print(f"\tOptimal scaling factor α: {alpha}")
        print(f"\tSum of products δ_ij·d_ij: {sum_product_delta_d}")
        print(f"\tSum of squared d_ij: {sum_squared_d}")
        print(f"\tSum of squared δ_ij: {sum_squared_delta}")
        print(f"\tSum of squared differences: {sum_squared_diff}")
        print(f"\tStress: {stress}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=stress,
            type="lower-better",  # Lower stress is better
        )
