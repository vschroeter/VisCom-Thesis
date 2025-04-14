from __future__ import annotations

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
        valid_links = self.valid_links

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
                    # Returns a tuple of (t1, t2) where t1 and t2 are the
                    # parameters at which the paths intersect
                    """
                    Returns:
                        (list[tuple[float, Curve, float]]): list of intersections, each
                            in the format ((T1, seg1, t1), (T2, seg2, t2)), where
                            self.point(T1) == seg1.point(t1) == seg2.point(t2) == other_curve.point(T2)
                    """
                    tol = 0.01
                    intersections: list = path1.intersect(path2, tol=tol)

                    def endpoint_distance(p: int):
                        if abs(p - 1) < abs(p):
                            return abs(p - 1)
                        else:
                            return abs(p)

                    # Filter out intersections that are too close to the endpoints
                    # filtered_intersections = [(i1, i2) for i1, i2 in intersections if (endpoint_distance(i1[0]) > tol and endpoint_distance(i2[0]) > tol)]
                    filtered_intersections = []
                    last_t1 = 0
                    for i1, i2 in intersections:
                        t1 = i1[0]
                        t2 = i2[0]
                        # Check if the intersection is close to the endpoints
                        if endpoint_distance(t1) > tol and endpoint_distance(t2) > tol:
                            if abs(t1 - last_t1) > tol:
                                filtered_intersections.append((i1, i2))

                            last_t1 = t1

                    # crossing_count += len(intersections)
                    crossing_count += len(filtered_intersections)
                    # crossing_count += 1
                    if len(intersections) > 0:
                        # print(f"\t Found {len(intersections)} intersections between paths {i} and {j}")
                        pass
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
                key=self.API_METHOD_NAME,
                value=0.0 if crossing_count == 0 else 1.0,
                type="lower-better",
                error=f"Cannot normalize: maximum possible crossings is zero or negative (c_max={c_max}) with {crossing_count} crossings (c_all={c_all}, c_impossible={c_impossible})",
            )

        # Calculate normalized crossing metric, capped at 1.0
        normalized_crossings = min(crossing_count / c_max, 1.0)

        print(f"\tActual crossings: {crossing_count}")
        print(f"\tDegrees: {node_degrees}")
        print(f"\tEdge count: {edge_count}")
        print(f"\tMaximum possible crossings: {c_max}")
        print(f"\tNormalized crossing metric: {normalized_crossings}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=normalized_crossings,
            type="lower-better",  # Fewer crossings is better for readability
        )


class TotalEdgeCrossingMetricCalculator(GraphMetricCalculator):
    """
    Calculator for counting the absolute number of edge crossings in layouts.

    This metric provides the raw count of edge intersections without normalization,
    which can be useful for comparing different layouts of the same graph.
    """

    API_METHOD_NAME = "totalEdgeCrossings"

    def calculate(self) -> MetricResult:
        """
        Calculate the total number of edge crossings in the graph layout.

        Unlike the normalized edge crossing metric, this returns the raw count
        without normalization by the maximum possible crossings.

        Returns:
            MetricResult: The total edge crossing count.
        """
        # Filter out links with empty paths
        valid_links = self.valid_links

        # Count actual edge crossings
        crossing_count: int = 0
        path_count: int = len(valid_links)

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
                    tol = 0.01
                    intersections: list = path1.intersect(path2, tol=tol)

                    def endpoint_distance(p: int):
                        if abs(p - 1) < abs(p):
                            return abs(p - 1)
                        else:
                            return abs(p)

                    # Filter out intersections that are too close to the endpoints
                    filtered_intersections = []
                    last_t1 = 0
                    for i1, i2 in intersections:
                        t1 = i1[0]
                        t2 = i2[0]
                        # Check if the intersection is close to the endpoints
                        if endpoint_distance(t1) > tol and endpoint_distance(t2) > tol:
                            if abs(t1 - last_t1) > tol:
                                filtered_intersections.append((i1, i2))

                            last_t1 = t1

                    crossing_count += len(filtered_intersections)
                except Exception as e:
                    print(f"Error calculating intersection: {str(e)}")

        return MetricResult(
            key=self.API_METHOD_NAME,
            value=float(crossing_count),
            type="lower-better",  # Fewer crossings is better for readability
        )
