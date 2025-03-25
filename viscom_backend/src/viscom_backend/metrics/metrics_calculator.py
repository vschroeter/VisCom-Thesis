from typing import Dict, List, Any, Tuple, Union, Literal, TypedDict, Optional, Type
from svgpathtools import Path, Line, CubicBezier, Arc, parse_path
import numpy as np
from abc import ABC, abstractmethod
import math


class LaidOutNode:
    """Representation of a node in the layout."""

    def __init__(self, id: str, x: float, y: float, score: float, radius: float):
        self.id: str = id
        self.x: float = x
        self.y: float = y
        self.score: float = score
        self.radius: float = radius


class LaidOutConnection:
    """Representation of a connection between nodes in the layout."""

    def __init__(self, source: str, target: str, weight: float, path: str):
        self.source: str = source
        self.target: str = target
        self.weight: float = weight
        # Parse SVG path string directly in the constructor
        try:
            # Skip empty paths
            if not path or path.isspace():
                self.path: Optional[Path] = None
                self.path_error: bool = True
                self.is_empty: bool = True
            else:
                self.path: Path = parse_path(path)
                self.path_error: bool = False
                self.is_empty: bool = False
        except Exception as e:
            print(f"Error parsing path: {e}")
            # Default to no path
            self.path: Optional[Path] = None
            self.path_error: bool = True
            self.is_empty: bool = False

        # Store original path string for reference if needed
        self.path_str: str = path


class LaidOutData:
    """Complete layout data with nodes and links."""

    def __init__(self, nodes: List[LaidOutNode], links: List[LaidOutConnection]):
        self.nodes: List[LaidOutNode] = nodes
        self.links: List[LaidOutConnection] = links


class MetricResult:
    """Result of a metric calculation."""

    def __init__(self, key: str, value: float, type: Literal["lower-better", "higher-better"], error: Optional[str] = None):
        self.key: str = key
        self.value: float = value
        self.type: Literal["lower-better", "higher-better"] = type
        self.error: Optional[str] = error


class MetricCalculator(ABC):
    """Base class for calculating metrics on graph layouts."""

    def __init__(self, data: LaidOutData):
        self.nodes: List[LaidOutNode] = data.nodes
        self.links: List[LaidOutConnection] = data.links

        # Convert nodes to circle representations
        self.node_circles: Dict[str, Tuple[complex, float]] = {}
        for node in self.nodes:
            center: complex = complex(node.x, node.y)
            radius: float = node.radius
            self.node_circles[node.id] = (center, radius)

        # No longer attempt to fix invalid paths - just use valid ones

    @abstractmethod
    def calculate(self) -> MetricResult:
        """Calculate the metric. Must be implemented by subclasses."""
        pass


class EdgeCrossingMetricCalculator(MetricCalculator):
    """Calculator for measuring edge crossing count in layouts."""

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
            type="lower-better"  # Fewer crossings is better for readability
        )


class PathLengthRatioMetricCalculator(MetricCalculator):
    """Calculator for measuring the ratio between actual path lengths and direct distances."""

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
            direct_distance: float = math.sqrt(
                (target_node.x - source_node.x)**2 +
                (target_node.y - source_node.y)**2
            )

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
            return MetricResult(
                key="path_efficiency_ratio",
                value=0,
                type="lower-better",
                error="No valid paths found or zero direct distance"
            )

        # Calculate the waste ratio: (path_length - direct_distance) / direct_distance
        # This measures how much longer paths are compared to direct lines
        waste_ratio: float = (total_path_length - total_direct_distance) / total_direct_distance

        return MetricResult(
            key="path_efficiency_ratio",
            value=waste_ratio,
            type="lower-better"  # Lower ratio means paths are closer to optimal straight lines
        )


# Dictionary of all available metric calculators, mapping API names to calculator classes
AVAILABLE_METRICS: Dict[str, Type[MetricCalculator]] = {
    "edgeCrossings": EdgeCrossingMetricCalculator,
    "pathEfficiency": PathLengthRatioMetricCalculator,
    # Add more metric calculators here as they are implemented
}


def calculate_metrics(data: LaidOutData, method: Optional[str] = None) -> List[MetricResult]:
    """
    Calculate metrics for the given graph layout data.

    Args:
        data: The layout data to analyze
        method: If provided, calculate only the specific metric; otherwise calculate all

    Returns:
        List of metric results
    """
    results: List[MetricResult] = []

    if method is not None:
        # Calculate only the requested metric
        if method not in AVAILABLE_METRICS:
            return [MetricResult(
                key=method,
                value=-1,
                type="lower-better",
                error=f"Unknown metric method: {method}"
            )]

        try:
            calculator_class = AVAILABLE_METRICS[method]
            calculator = calculator_class(data)
            results.append(calculator.calculate())
        except Exception as e:
            print(f"Error calculating {method} metric: {e}")
            results.append(MetricResult(
                key=method,
                value=-1,
                type="lower-better",
                error=str(e)
            ))
    else:
        # Calculate all available metrics
        for method_name, calculator_class in AVAILABLE_METRICS.items():
            try:
                calculator = calculator_class(data)
                results.append(calculator.calculate())
            except Exception as e:
                print(f"Error calculating {method_name} metric: {e}")
                results.append(MetricResult(
                    key=method_name,
                    value=-1,
                    type="lower-better",
                    error=str(e)
                ))

    return results


def convert_dict_to_laid_out_data(data_dict: Dict[str, Any]) -> LaidOutData:
    """Convert a dictionary to a LaidOutData object."""
    nodes: List[LaidOutNode] = [
        LaidOutNode(
            id=node["id"],
            x=float(node["x"]),
            y=float(node["y"]),
            score=float(node["score"]),
            radius=float(node["radius"])
        ) for node in data_dict["nodes"]
    ]

    links: List[LaidOutConnection] = [
        LaidOutConnection(
            source=link["source"],
            target=link["target"],
            weight=float(link["weight"]),
            path=link["path"]
        ) for link in data_dict["links"]
    ]

    return LaidOutData(nodes=nodes, links=links)
