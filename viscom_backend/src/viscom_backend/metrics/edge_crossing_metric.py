from __future__ import annotations

from typing import List

from svgpathtools.path import Path

from .metrics_calculator import MetricCalculator, MetricResult


class EdgeCrossingMetricCalculator(MetricCalculator):
    """Calculator for measuring edge crossing count in layouts."""

    API_METHOD_NAME = "edgeCrossings"

    def calculate(self) -> MetricResult:
        """Calculate the number of edge crossings in the graph layout."""
        crossing_count: int = 0

        # Filter out links with empty paths
        valid_links = [link for link in self.links if not link.is_empty and not link.path_error and link.path is not None]

        # Check each pair of paths for intersections
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
                    crossing_count += min(3, len(intersections))
                    if len(intersections) > 0:
                        print(f"\t Found {len(intersections)} intersections between paths {i} and {j}")
                        if len(intersections) > 10:
                            print(f"\t\tPath 1: {path1}")
                            print(f"\t\tPath 2: {path2}")
                except Exception as e:
                    print(f"Error calculating intersection: {str(e)}")
                    print(f"\tPath 1: {path1}")
                    print(f"\tPath 2: {path2}")

        return MetricResult(
            key="edge_crossing_count",
            value=crossing_count,
            type="lower-better",  # Fewer crossings is better for readability
        )
