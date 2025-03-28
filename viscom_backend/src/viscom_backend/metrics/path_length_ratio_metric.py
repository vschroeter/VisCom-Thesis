import math

from .metrics_calculator import MetricCalculator, MetricResult


class AbsolutePathLengthRatioMetricCalculator(MetricCalculator):
    """Calculator for measuring the ratio between actual path lengths and direct distances."""

    API_METHOD_NAME = "pathEfficiency"

    def calculate(self) -> MetricResult:
        """Calculate the ratio between path lengths and direct node distances."""
        total_path_length: float = 0
        total_direct_distance: float = 0
        valid_path_count: int = 0

        # Process only valid paths
        for link in self.links:
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
        if total_direct_distance == 0 or valid_path_count == 0:
            return MetricResult(key="path_efficiency_ratio", value=0, type="lower-better", error="No valid paths found or zero direct distance")

        # Calculate the waste ratio
        waste_ratio: float = total_path_length / total_direct_distance
        waste_ratio = max(waste_ratio, 1.0)

        print("#################################")
        print(f"Total path length: {total_path_length}")
        print(f"Total direct distance: {total_direct_distance}")
        print(f"Valid path count: {valid_path_count}")
        print(f"Path efficiency ratio: {waste_ratio}")
        print("#################################")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=waste_ratio,
            type="lower-better",  # Lower ratio means paths are closer to optimal straight lines
        )


class NormalizedPathLengthRatioMetricCalculator(MetricCalculator):
    """Calculator for measuring the ratio between actual path lengths and direct distances."""

    API_METHOD_NAME = "pathEfficiencyNormalized"

    def calculate(self) -> MetricResult:
        """Calculate the ratio between path lengths and direct node distances."""
        total_path_length: float = 0
        total_direct_distance: float = 0
        valid_path_count: int = 0

        total_ratio = 0

        # Process only valid paths
        for link in self.links:
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

                # Add to totals the current path ratio
                total_ratio += max(0, (path_length - direct_distance) / direct_distance)

                # Add to totals
                total_direct_distance += direct_distance
                total_path_length += path_length
                valid_path_count += 1
            except Exception as e:
                print(f"Error calculating path length: {e}")

        # # Avoid division by zero
        # if total_direct_distance == 0 or valid_path_count == 0:
        #     return MetricResult(key="path_efficiency_ratio", value=0, type="lower-better", error="No valid paths found or zero direct distance")

        # Calculate the waste ratio
        # waste_ratio: float = total_path_length / total_direct_distance
        # waste_ratio = max(waste_ratio, 1.0)

        waste_ratio = 1 + total_ratio / valid_path_count

        print("#################################")
        print(f"Total path length: {total_path_length}")
        print(f"Total direct distance: {total_direct_distance}")
        print(f"Valid path count: {valid_path_count}")
        print(f"Path efficiency ratio: {waste_ratio}")
        print("#################################")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=waste_ratio,
            type="lower-better",  # Lower ratio means paths are closer to optimal straight lines
        )
