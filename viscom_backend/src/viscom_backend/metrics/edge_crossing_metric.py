from __future__ import annotations

from typing import List

from svgpathtools.path import Path

from .graph_metric_calculator import GraphMetricCalculator
from .metrics_calculator import MetricResult


class EdgeCrossingMetricCalculator(GraphMetricCalculator):
    """
    Calculator for measuring edge crossing count in layouts.

    Fewer edge crossings improve the readability of the graph, as excessive crossings
    can obscure relationships between nodes and make the layout harder to interpret.
    """

    API_METHOD_NAME = "edgeCrossings"

    def calculate(self) -> MetricResult:
        """
        Calculate the normalized edge crossing metric in the graph layout.

        The metric is normalized by dividing the number of actual crossings by the
        maximum possible number of crossings, taking into account crossing impossiblities
        due to edges sharing nodes.

        Formula:
        ℵ_c = c / c_max

        where:
        c_max = c_all - c_impossible
              = (|E|*(|E|-1))/2 - (1/2)*sum(degree(u_i)*(degree(u_i)-1))

        Returns:
            MetricResult: The normalized edge crossing metric result.
        """
        # Filter out links with empty paths
        valid_links = [link for link in self.links if not link.is_empty and not link.path_error and link.path is not None]

        # Count actual edge crossings
        crossing_count: int = 0
        path_count: int = len(valid_links)
        print(f"Checking {path_count} paths for crossings...")

        for i in range(path_count):
            path1: Path = valid_links[i].path
            source1: str = valid_links[i].source
            target1: str = valid_links[i].target

            for j in range(i + 1, path_count):
                path2: Path = valid_links[j].path
                source2: str = valid_links[j].source
                target2: str = valid_links[j].target

                if i == j:
                    continue

                try:
                    # Find intersections between the paths
                    intersections: List[complex] = path1.intersect(path2)
                    crossing_count += len(intersections)
                    if len(intersections) > 0:
                        print(f"\t Found {len(intersections)} intersections between paths {i} and {j}")
                except Exception as e:
                    print(f"Error calculating intersection: {str(e)}")

        # Calculate maximum possible crossings
        graph = self.get_graph()
        edge_count = len(valid_links)

        # Calculate c_all = |E|*(|E|-1)/2
        c_all = (edge_count * (edge_count - 1)) / 2

        # Calculate c_impossible = (1/2)*sum(degree(u_i)*(degree(u_i)-1))
        c_impossible = 0
        node_degrees = dict(graph.degree())
        for degree in node_degrees.values():
            c_impossible += (degree * (degree - 1)) / 2

        # Calculate c_max = c_all - c_impossible
        c_max = c_all - c_impossible

        # Avoid division by zero
        if c_max <= 0:
            return MetricResult(
                key=self.API_METHOD_NAME, value=0.0 if crossing_count == 0 else 1.0, type="lower-better", error="Cannot normalize: maximum possible crossings is zero or negative"
            )

        # Calculate normalized crossing metric
        normalized_crossings = crossing_count / c_max

        print(f"\tActual crossings: {crossing_count}")
        print(f"\tMaximum possible crossings: {c_max}")
        print(f"\tNormalized crossing metric: {normalized_crossings}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=normalized_crossings,
            type="lower-better",  # Fewer crossings is better for readability
        )
