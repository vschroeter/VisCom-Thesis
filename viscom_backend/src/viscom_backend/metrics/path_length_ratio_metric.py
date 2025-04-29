import math

from .metrics_calculator import MetricCalculator, MetricResult


class AbsolutePathLengthRatioMetricCalculator(MetricCalculator):
    """
    Calculator for measuring the ratio between direct distances and actual path lengths.

    This can be seen as a generalization of the metric for edge bends. Higher values
    indicate paths that are closer to straight lines, which are typically more efficient
    and easier to follow.
    """

    API_METHOD_NAME = "pathEfficiency"

    def calculate(self) -> MetricResult:
        """
        Calculate the overall path efficiency as the ratio of total direct distances to total path lengths.

        Formula:
        PathEfficiency = (sum of direct distances) / (sum of path lengths)

        A value closer to 1 indicates that paths are closer to straight lines,
        which improves the readability of the graph.

        Returns:
            MetricResult: The path efficiency metric result.
        """
        total_path_length: float = 0
        total_direct_distance: float = 0
        valid_path_count: int = 0

        # Process only valid paths
        for link in self.valid_links:
            # Skip empty or error paths
            if link.is_empty or link.path_error or link.path is None:
                continue

            # Get node positions
            source_node = next((node for node in self.nodes if node.id == link.source), None)
            target_node = next((node for node in self.nodes if node.id == link.target), None)

            if not source_node or not target_node:
                continue

            # Calculate direct distance
            direct_distance: float = math.sqrt((target_node.x - source_node.x) ** 2 + (target_node.y - source_node.y) ** 2) - source_node.radius - target_node.radius

            # Calculate path length
            try:
                path_length: float = link.path.length()

                # Add to totals
                total_direct_distance += direct_distance
                total_path_length += path_length
                valid_path_count += 1
            except Exception as e:
                print(f"Error calculating path length: {e}")

        # Avoid division by zero
        if total_path_length == 0 or valid_path_count == 0:
            return MetricResult(key=self.API_METHOD_NAME, value=0, type="higher-better", error="No valid paths found or zero path length")

        # Calculate the efficiency ratio
        efficiency_ratio: float = total_direct_distance / total_path_length
        efficiency_ratio = min(efficiency_ratio, 1.0)  # Ensure it doesn't exceed 1.0

        print(f"\tTotal direct distance: {total_direct_distance}")
        print(f"\tTotal path length: {total_path_length}")
        print(f"\tValid path count: {valid_path_count}")
        print(f"\tPath efficiency ratio: {efficiency_ratio}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=efficiency_ratio,
            type="higher-better",  # Higher ratio means paths are closer to optimal straight lines
        )


class NormalizedPathLengthRatioMetricCalculator(MetricCalculator):
    """
    Calculator for measuring the normalized path efficiency across individual path segments.

    This metric calculates the average efficiency of individual path segments,
    providing a view of path efficiency that is normalized across all edges.
    """

    API_METHOD_NAME = "pathEfficiencyNormalized"

    def calculate(self) -> MetricResult:
        """
        Calculate the normalized path efficiency by averaging the efficiency of individual paths.

        Formula:
        PathEfficiency_norm = (1/|E_N|) * sum(DirectDistance(e)/PathLength(e))

        Returns:
            MetricResult: The normalized path efficiency metric result.
        """
        total_efficiency = 0
        valid_path_count: int = 0

        # Process only valid paths
        for link in self.valid_links:
            # Skip empty or error paths
            if link.is_empty or link.path_error or link.path is None:
                continue

            # Get node positions
            source_node = next((node for node in self.nodes if node.id == link.source), None)
            target_node = next((node for node in self.nodes if node.id == link.target), None)

            if not source_node or not target_node:
                continue

            # Calculate direct distance
            direct_distance: float = math.sqrt((target_node.x - source_node.x) ** 2 + (target_node.y - source_node.y) ** 2) - source_node.radius - target_node.radius

            # Calculate path length
            try:
                path_length: float = link.path.length()

                if path_length > 0:
                    # Calculate individual path efficiency
                    path_efficiency = direct_distance / path_length
                    path_efficiency = min(path_efficiency, 1.0)  # Ensure it doesn't exceed 1.0

                    # Add to total
                    total_efficiency += path_efficiency
                    valid_path_count += 1
            except Exception as e:
                print(f"Error calculating path length: {e}")

        # Avoid division by zero
        if valid_path_count == 0:
            return MetricResult(key=self.API_METHOD_NAME, value=0, type="higher-better", error="No valid paths found")

        # Calculate the average path efficiency
        avg_efficiency = total_efficiency / valid_path_count

        print(f"\tTotal path efficiency sum: {total_efficiency}")
        print(f"\tValid path count: {valid_path_count}")
        print(f"\tNormalized path efficiency: {avg_efficiency}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=avg_efficiency,
            type="higher-better",  # Higher ratio means paths are closer to optimal straight lines
        )
