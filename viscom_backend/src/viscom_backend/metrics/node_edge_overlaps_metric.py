from __future__ import annotations

import math

from svgpathtools import Path

from .graph_metric_calculator import GraphMetricCalculator
from .metrics_calculator import MetricResult


class NodeEdgeOverlapsMetricCalculator(GraphMetricCalculator):
    """Calculator for measuring overlaps between node circles and edge paths."""

    API_METHOD_NAME = "nodeEdgeOverlaps"

    def calculate(self) -> MetricResult:
        """
        Calculate the number of node-edge overlaps in the graph layout.

        This metric counts instances where an edge path intersects with a node
        that is not one of its endpoints. Lower values indicate better layout
        with fewer unwanted overlaps.

        Returns:
            MetricResult: The node-edge overlaps metric result.
        """
        overlap_count = 0
        total_checks = 0

        # Filter out links with empty paths
        valid_links = [link for link in self.links if not link.is_empty and not link.path_error and link.path is not None]

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

                total_checks += 1

                try:
                    # Find intersections between the node circle and the edge path
                    intersections = circle_path.intersect(link.path)

                    if intersections:
                        print(f"\tFound {len(intersections)} overlaps between node {node_id} and edge {link.source}-{link.target}")
                        overlap_count += 1  # Count as one overlap regardless of number of intersection points
                except Exception as e:
                    print(f"Error calculating node-edge intersection: {str(e)}")

        print(f"Found {overlap_count} node-edge overlaps in {total_checks} checks")

        # Normalize the result based on the potential maximum number of overlaps
        if total_checks == 0:
            normalized_value = 0.0
        else:
            # normalized_value = overlap_count / total_checks
            normalized_value = overlap_count

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=normalized_value,
            type="lower-better",  # Fewer overlaps is better for readability
        )
