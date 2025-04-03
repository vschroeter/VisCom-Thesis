from __future__ import annotations

import math

import networkx as nx

from .graph_metric_calculator import GraphMetricCalculator
from .metrics_calculator import MetricResult


class PathAngularPredictionMetricCalculator(GraphMetricCalculator):
    """
    Calculator for measuring how well paths follow a consistent angular trend.

    This metric predicts the expected angle of the next segment based on the trend
    of the previous two segments and measures the deviation from this expectation.

    Lower values indicate more consistent angular trends, which contribute to a more
    intuitive layout that follows human expectations of continuity.
    """

    API_METHOD_NAME = "pathAngularPrediction"

    def calculate(self) -> MetricResult:
        """
        Calculate the path angular prediction metric based on angular trend deviations.

        Formula:
        PathAngularPrediction = (sqrt((1/W) * sum(w_i * (θ_i - θ_pred(θ_{i-2}, θ_{i-1}))²))) / π

        where:
        - θ_i is the polar angle of the i-th segment
        - θ_pred() is the predicted angle based on the trend of previous segments
        - w_i is the weight of the i-th edge
        - W is the total weight of all edges included in the sum

        Returns:
            MetricResult: The path angular prediction metric result.
        """
        # Use graph for shortest paths calculation
        graph = self.get_graph()

        if len(graph.nodes) < 4:
            return MetricResult(key=self.API_METHOD_NAME, value=0.0, type="lower-better", error="Not enough nodes to calculate path angular prediction")

        # Variables to store the weighted sum of squared deviations and total weight
        weighted_squared_deviations_sum = 0.0
        total_weight = 0.0

        # Get all shortest paths between all pairs of nodes
        try:
            for source in graph.nodes():
                # Use NetworkX's single_source_shortest_path to get all paths from this source
                paths = nx.single_source_dijkstra(graph, source, weight="distance")

                for target, path in paths[1].items():
                    # Skip paths that are too short to have three consecutive segments
                    if len(path) < 4:
                        continue

                    # Calculate angles for each segment in the path and store edge weights
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

                    # Calculate deviations from predicted angles for triplets of segments
                    for j in range(len(segment_angles) - 2):
                        angle1 = segment_angles[j]
                        angle2 = segment_angles[j + 1]
                        angle3 = segment_angles[j + 2]

                        # Calculate the trend from first two angles
                        angle_delta = angle2 - angle1

                        # Normalize angle_delta to be between -π and π
                        if angle_delta > math.pi:
                            angle_delta -= 2 * math.pi
                        elif angle_delta < -math.pi:
                            angle_delta += 2 * math.pi

                        # Predict the third angle based on the trend (θ_pred)
                        predicted_angle = angle2 + angle_delta

                        # Normalize predicted_angle to be between -π and π
                        while predicted_angle > math.pi:
                            predicted_angle -= 2 * math.pi
                        while predicted_angle < -math.pi:
                            predicted_angle += 2 * math.pi

                        # Calculate deviation between predicted and actual third angle
                        deviation = abs(angle3 - predicted_angle)

                        # Ensure we get the smaller angle between the two directions
                        if deviation > math.pi:
                            deviation = 2 * math.pi - deviation

                        # Use the weight of the third edge for weighting
                        weight = edge_weights[j + 2]

                        # Square the deviation, weight it, and add to sum
                        weighted_squared_deviations_sum += weight * (deviation**2)
                        total_weight += weight

        except Exception as e:
            return MetricResult(
                key=self.API_METHOD_NAME,
                value=1.0,  # Worst possible value
                type="lower-better",
                error=f"Error calculating path angular prediction: {str(e)}",
            )

        # Handle the case where there are no valid path segments
        if total_weight == 0:
            # print("###################################################")
            # print("No valid path segments found for prediction.")
            # for node in graph.nodes:
            #     print(f"\t{node}: {graph.nodes[node]}")

            # # Print edges with data
            # for edge in graph.edges:
            #     print(f"\t{edge}: {graph.get_edge_data(*edge)}")

            # print("###################################################")

            return MetricResult(key=self.API_METHOD_NAME, value=0.0, type="lower-better", error="No valid weighted path segments found for prediction")

        # Calculate weighted root mean square of angular deviations
        weighted_rms_deviation = math.sqrt(weighted_squared_deviations_sum / total_weight)

        # Normalize to [0, 1] by dividing by π
        normalized_value = weighted_rms_deviation / math.pi

        print(f"\tTotal weighted squared angular prediction deviations: {weighted_squared_deviations_sum}")
        print(f"\tTotal weight of connections: {total_weight}")
        print(f"\tWeighted RMS of angular prediction deviations: {weighted_rms_deviation}")
        print(f"\tNormalized path angular prediction metric: {normalized_value}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=normalized_value,
            type="lower-better",  # Lower values mean more consistent angular trends
        )
