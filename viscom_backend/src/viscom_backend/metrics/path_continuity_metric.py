from __future__ import annotations

import math

import networkx as nx

from .graph_metric_calculator import GraphMetricCalculator
from .metrics_calculator import MetricResult


class PathContinuityMetricCalculator(GraphMetricCalculator):
    """Calculator for measuring the continuity/smoothness of paths in a graph layout."""

    API_METHOD_NAME = "pathContinuity"

    def calculate(self) -> MetricResult:
        """
        Calculate the path continuity metric based on angular differences.

        This metric measures how smoothly the paths change direction when following
        shortest paths in the graph. Lower values indicate smoother, more continuous paths.

        The algorithm:
        1. Find all shortest paths between all nodes
        2. For each path with at least 3 nodes:
           a. Calculate the angles of consecutive segments
           b. Calculate the angular difference between consecutive segments
           c. Square these differences
        3. Calculate the root mean square of all angular differences
        4. Normalize to [0,1] by dividing by π

        Returns:
            MetricResult: The path continuity metric result.
        """
        # Use undirected graph for shortest paths calculation
        # graph = self.get_undirected_graph()
        graph = self.get_graph()

        if len(graph.nodes) < 3:
            return MetricResult(key=self.API_METHOD_NAME, value=0.0, type="lower-better", error="Not enough nodes to calculate path continuity")

        # Variables to store the sum of squared angular differences and count
        squared_angle_diffs_sum = 0.0
        angle_diff_count = 0

        # Get all shortest paths between all pairs of nodes
        try:
            for source in graph.nodes():
                # Use NetworkX's single_source_shortest_path to get all paths from this source
                paths = nx.single_source_shortest_path(graph, source)

                for target, path in paths.items():
                    # Skip paths that are too short to have angular changes
                    if len(path) < 3:
                        continue

                    # Calculate angles for each segment in the path
                    segment_angles = []

                    for i in range(len(path) - 1):
                        node1_id = path[i]
                        node2_id = path[i + 1]

                        # Get node positions
                        node1 = self.node_circles[node1_id]
                        node2 = self.node_circles[node2_id]

                        # Calculate segment direction (angle)
                        dx = node2.x - node1.x
                        dy = node2.y - node1.y
                        angle = math.atan2(dy, dx)
                        segment_angles.append(angle)

                    # Calculate angular differences between consecutive segments
                    for j in range(len(segment_angles) - 1):
                        angle1 = segment_angles[j]
                        angle2 = segment_angles[j + 1]

                        # Calculate the smallest angular difference
                        angle_diff = abs(angle2 - angle1)
                        # Ensure we get the smaller angle between the two directions
                        if angle_diff > math.pi:
                            angle_diff = 2 * math.pi - angle_diff

                        # Square the difference and add to sum
                        squared_angle_diffs_sum += angle_diff**2
                        angle_diff_count += 1

        except Exception as e:
            return MetricResult(
                key=self.API_METHOD_NAME,
                value=1.0,  # Worst possible value
                type="lower-better",
                error=f"Error calculating path continuity: {str(e)}",
            )

        # Handle the case where there are no valid path segments
        if angle_diff_count == 0:
            return MetricResult(key=self.API_METHOD_NAME, value=0.0, type="lower-better", error="No valid path segments found")

        # Calculate root mean square of angular differences
        rms_angle_diff = math.sqrt(squared_angle_diffs_sum / angle_diff_count)

        # Normalize to [0, 1] by dividing by π
        normalized_value = rms_angle_diff / math.pi

        print(f"\tTotal squared angular differences: {squared_angle_diffs_sum}")
        print(f"\tNumber of angular differences: {angle_diff_count}")
        print(f"\tRMS of angular differences: {rms_angle_diff}")
        print(f"\tNormalized path continuity metric: {normalized_value}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=normalized_value,
            type="lower-better",  # Lower values mean smoother paths
        )
