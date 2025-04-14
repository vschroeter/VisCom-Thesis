from __future__ import annotations

from .graph_metric_calculator import GraphMetricCalculator
from .metrics_calculator import MetricResult


class TotalPathLengthMetricCalculator(GraphMetricCalculator):
    """
    Calculator for measuring the total path length of all edges in the layout.

    This metric provides the sum of all edge path lengths. Lower total path length
    generally indicates a more efficient use of space in the layout.
    """

    API_METHOD_NAME = "totalPathLength"

    def calculate(self) -> MetricResult:
        """
        Calculate the sum of all path lengths in the graph layout.

        Returns:
            MetricResult: The total path length.
        """
        # Filter out links with empty paths
        valid_links = self.valid_links

        # Sum up all path lengths
        total_length: float = 0.0

        for link in valid_links:
            try:
                if link.path is not None:
                    path_length = link.path.length()
                    total_length += path_length
            except Exception as e:
                print(f"Error calculating path length: {str(e)}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=total_length,
            type="lower-better",  # Shorter total length is generally better
        )
