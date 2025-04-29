from __future__ import annotations

import math

from svgpathtools import Path

from .graph_metric_calculator import GraphMetricCalculator
from .metrics_calculator import MetricResult


class NodeEdgeOverlapsMetricCalculator(GraphMetricCalculator):
    """
    Calculator for measuring overlaps between node circles and edge paths.

    This metric counts instances where an edge path intersects with a node
    that is not one of its endpoints. Fewer overlaps improve the traceability
    of edges in the layout, making the graph easier to read and understand.
    """

    API_METHOD_NAME = "nodeEdgeOverlaps"

    def calculate(self) -> MetricResult:
        """
        Calculate the normalized node-edge overlap metric for the graph layout.

        Formula:
        ℵ_o = 1 - (o / o_max)

        where:
        - o is the number of node-edge overlaps
        - o_max = |E| * (|N| - 2) is the maximum possible number of overlaps

        Higher values (closer to 1) indicate fewer overlaps, which improves
        the traceability of edges in the layout.

        Returns:
            MetricResult: The node-edge overlaps metric result.
        """
        overlap_count = 0

        # Filter out links with empty paths
        valid_links = self.valid_links

        # Get counts for normalization
        edge_count = len(valid_links)
        node_count = len(self.node_circles)

        # Calculate maximum possible overlaps
        max_overlaps = edge_count * (node_count - 2)

        if max_overlaps <= 0:
            return MetricResult(
                key=self.API_METHOD_NAME,
                value=1.0,  # Best possible value when no overlaps are possible
                type="higher-better",
                error="No possible overlaps with current graph structure",
            )

        # Process each node
        for node_id, node_circle in self.node_circles.items():
            # Create a circle path for the node
            start_pos_x = node_circle.x + node_circle.r
            start_pos_y = node_circle.y
            rad = 0.1

            # Convert rad to position on circle
            end_pos_x = node_circle.x + node_circle.r * math.cos(rad)
            end_pos_y = node_circle.y + node_circle.r * math.sin(rad)

            path_str = f"M {start_pos_x},{start_pos_y} A {node_circle.r},{node_circle.r} 0 1 0 {end_pos_x},{end_pos_y} Z"
            circle_path = Path(path_str)

            # Check against each edge
            for link in valid_links:
                # Skip if this node is an endpoint of the edge
                if node_id == link.source or node_id == link.target:
                    continue

                try:
                    # Find intersections between the node circle and the edge path
                    intersections = circle_path.intersect(link.path)

                    if intersections:
                        print(f"\tFound {len(intersections)} overlaps between node {node_id} and edge {link.source}-{link.target}")
                        overlap_count += 1  # Count as one overlap regardless of number of intersection points
                except Exception as e:
                    print(f"Error calculating node-edge intersection: {str(e)}")

        # Calculate the normalized metric (1 - o/o_max)
        normalized_value = 1.0 - (overlap_count / max_overlaps)

        print(f"\tNode count: {node_count}")
        print(f"\tEdge count: {edge_count}")
        print(f"\tMaximum possible overlaps: {max_overlaps}")
        print(f"\tActual overlaps: {overlap_count}")
        print(f"\tNormalized node-edge overlap metric: {normalized_value}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=normalized_value,
            type="higher-better",  # Higher values mean fewer overlaps relative to maximum possible
        )
