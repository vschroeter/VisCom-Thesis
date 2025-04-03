from __future__ import annotations

import math

import networkx as nx

from .graph_metric_calculator import GraphMetricCalculator
from .metrics_calculator import MetricResult


class WeightedPathContinuityMetricCalculator(GraphMetricCalculator):
    """
    Calculator for measuring the weighted continuity/smoothness of paths in a graph layout.

    This extends the Path Continuity Metric by weighting angular differences based on edge weights,
    emphasizing the importance of high-weight connections in the layout.
    """

    API_METHOD_NAME = "weightedPathContinuity"

    def calculate(self) -> MetricResult:
        """
        Calculate the weighted path continuity metric based on angular differences.

        Formula:
        WeightedPathContinuity = (sqrt((1/W) * sum([w_i * Δ(θ_{i-1}, θ_i)]²))) / π

        where:
        - θ_i is the polar angle of the i-th segment
        - Δ(θ_{i-1}, θ_i) is the angular difference between consecutive segments
        - w_i is the weight of the i-th edge
        - W is the total weight of all edges included in the sum

        Lower values indicate smoother, more continuous paths with an emphasis on
        high-weight connections.

        Returns:
            MetricResult: The weighted path continuity metric result.
        """
        # Use graph for shortest paths calculation
        graph = self.get_graph()

        if len(graph.nodes) < 3:
            return MetricResult(key=self.API_METHOD_NAME, value=0.0, type="lower-better", error="Not enough nodes to calculate path continuity")

        # Variables to store the weighted sum of squared angular differences and total weight
        weighted_squared_angle_diffs_sum = 0.0
        total_weight = 0.0

        # Get all shortest paths between all pairs of nodes
        try:
            for source in graph.nodes():
                # Use NetworkX's single_source_shortest_path to get all paths from this source
                # paths = nx.single_source_shortest_path(graph, source)
                paths = nx.single_source_dijkstra(graph, source, weight="distance")

                for target, path in paths[1].items():
                    # Skip paths that are too short to have angular changes
                    if len(path) < 3:
                        continue

                    # Calculate angles for each segment in the path and store the edge weights
                    segment_angles = []
                    edge_weights = []

                    for i in range(len(path) - 1):
                        node1_id = path[i]
                        node2_id = path[i + 1]

                        # Get node positions
                        node1 = self.node_circles.get(node1_id, None)
                        node2 = self.node_circles.get(node2_id, None)

                        if node1 is None or node2 is None:
                            continue  # Skip if nodes are not found

                        # Calculate segment direction (angle)
                        dx = node2.x - node1.x
                        dy = node2.y - node1.y
                        angle = math.atan2(dy, dx)
                        segment_angles.append(angle)

                        # Get edge weight (use default 1.0 if not specified)
                        weight = graph.get_edge_data(node1_id, node2_id).get("weight", 1.0)
                        edge_weights.append(weight)

                    # Calculate weighted angular differences between consecutive segments
                    for j in range(len(segment_angles) - 1):
                        angle1 = segment_angles[j]
                        angle2 = segment_angles[j + 1]
                        # Use the weight of the second edge as it represents the "change" segment
                        weight = edge_weights[j + 1]

                        # Calculate the smallest angular difference
                        angle_diff = abs(angle2 - angle1)
                        # Ensure we get the smaller angle between the two directions
                        if angle_diff > math.pi:
                            angle_diff = 2 * math.pi - angle_diff

                        # Square the difference, weight it, and add to sum
                        weighted_squared_angle_diffs_sum += weight * (angle_diff**2)
                        total_weight += weight

        except Exception as e:
            return MetricResult(
                key=self.API_METHOD_NAME,
                value=1.0,  # Worst possible value
                type="lower-better",
                error=f"Error calculating weighted path continuity: {str(e)}",
            )

        # Handle the case where there are no valid path segments
        if total_weight == 0:
            return MetricResult(key=self.API_METHOD_NAME, value=0.0, type="lower-better", error="No valid weighted path segments found")

        # Calculate weighted root mean square of angular differences
        weighted_rms_angle_diff = math.sqrt(weighted_squared_angle_diffs_sum / total_weight)

        # Normalize to [0, 1] by dividing by π
        normalized_value = weighted_rms_angle_diff / math.pi

        print(f"\tTotal weighted squared angular differences: {weighted_squared_angle_diffs_sum}")
        print(f"\tTotal weight of connections: {total_weight}")
        print(f"\tWeighted RMS of angular differences: {weighted_rms_angle_diff}")
        print(f"\tNormalized weighted path continuity metric: {normalized_value}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=normalized_value,
            type="lower-better",  # Lower values mean smoother paths
        )
