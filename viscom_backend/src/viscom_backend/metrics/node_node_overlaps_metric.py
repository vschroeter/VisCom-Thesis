from __future__ import annotations

import math

from .graph_metric_calculator import GraphMetricCalculator
from .metrics_calculator import MetricResult


class NodeNodeOverlapsMetricCalculator(GraphMetricCalculator):
    """
    Calculator for measuring overlaps between node circles.

    This metric counts instances where node circles overlap with each other.
    Fewer overlaps improve the clarity of the graph layout, making it easier
    to distinguish individual nodes and their connections.
    """

    API_METHOD_NAME = "nodeNodeOverlaps"

    def calculate(self) -> MetricResult:
        """
        Calculate the normalized node-node overlap metric for the graph layout.

        Formula:
        ℵ_nn = 1 - (o / o_max)

        where:
        - o is the number of node-node overlaps
        - o_max = (|N| * (|N| - 1)) / 2 is the maximum possible number of overlaps
          (all pairs of nodes)

        Higher values (closer to 1) indicate fewer overlaps, which improves
        the readability of the layout.

        Returns:
            MetricResult: The node-node overlaps metric result.
        """
        overlap_count = 0

        # Get count for normalization
        node_count = len(self.node_circles)

        # Calculate maximum possible overlaps (all possible pairs of nodes)
        max_overlaps = (node_count * (node_count - 1)) / 2

        if max_overlaps <= 0:
            return MetricResult(
                key=self.API_METHOD_NAME,
                value=1.0,  # Best possible value when no overlaps are possible
                type="higher-better",
                error="No possible overlaps with current graph structure",
            )

        # Process each pair of nodes
        node_items = list(self.node_circles.items())
        for i in range(len(node_items)):
            node1_id, node1_circle = node_items[i]

            # Check against each other node
            for j in range(i + 1, len(node_items)):
                node2_id, node2_circle = node_items[j]

                # Calculate distance between node centers
                dx = node2_circle.x - node1_circle.x
                dy = node2_circle.y - node1_circle.y
                distance = math.sqrt(dx * dx + dy * dy)

                # Check for overlap (distance is less than sum of radii)
                if distance < (node1_circle.r + node2_circle.r):
                    overlap_count += 1
                    print(f"\tFound overlap between node {node1_id} and node {node2_id}")

        # Calculate the normalized metric (1 - o/o_max)
        normalized_value = 1.0 - (overlap_count / max_overlaps)

        print(f"\tNode count: {node_count}")
        print(f"\tMaximum possible overlaps: {max_overlaps}")
        print(f"\tActual overlaps: {overlap_count}")
        print(f"\tNormalized node-node overlap metric: {normalized_value}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=normalized_value,
            type="higher-better",  # Higher values mean fewer overlaps relative to maximum possible
        )
