from __future__ import annotations

import math
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Literal, Optional, Type

from svgpathtools.parser import parse_path
from svgpathtools.path import Path

# Import the metric calculators


class LaidOutNode:
    """Representation of a node in the layout."""

    def __init__(self, id: str, x: float, y: float, score: float, radius: float):
        self.id: str = id
        self.x: float = x
        self.y: float = y
        self.score: float = score
        self.radius: float = radius


class NodeCircle:
    """Representation of a node as a circle with position and radius."""

    def __init__(self, x: float, y: float, r: float):
        self.x: float = x
        self.y: float = y
        self.r: float = r

    @staticmethod
    def euclidean_distance(node1: NodeCircle, node2: NodeCircle) -> float:
        """Calculate the Euclidean distance between two nodes."""
        return math.sqrt((node1.x - node2.x) ** 2 + (node1.y - node2.y) ** 2)

    @property
    def position(self) -> complex:
        """Return position as a complex number for compatibility."""
        return complex(self.x, self.y)


class LaidOutConnection:
    """Representation of a connection between nodes in the layout."""

    def __init__(self, source: str, target: str, weight: float, distance: float, path: str):
        self.source: str = source
        self.target: str = target
        self.weight: float = weight
        self.distance: float = distance

        self.path: Optional[Path] = None

        # Parse SVG path string directly in the constructor
        try:
            # Skip empty paths
            if not path or path.isspace():
                self.path: Optional[Path] = None
                self.path_error: bool = True
                self.is_empty: bool = True
            else:
                self.path: Optional[Path] = parse_path(path)
                self.path.approximate_arcs_with_cubics()
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

    def __str__(self) -> str:
        """Return a user-friendly string representation of the metric result."""
        if self.error:
            return f"Metric '{self.key}': Error - {self.error}"
        return f"Metric '{self.key}': {self.value:.4f} ({self.type})"

    def __repr__(self) -> str:
        """Return a detailed string representation for debugging."""
        return f"MetricResult(key='{self.key}', value={self.value}, type='{self.type}', error={repr(self.error)})"


class MetricCalculator(ABC):
    """Base class for calculating metrics on graph layouts."""

    API_METHOD_NAME = ""

    # Dictionary of all available metric calculators, mapping API names to calculator classes
    AVAILABLE_METRICS: Dict[str, Type[MetricCalculator]] = dict()
    # = {
    #     "edgeCrossings": EdgeCrossingMetricCalculator,
    #     "pathEfficiency": PathLengthRatioMetricCalculator,
    #     # Add more metric calculators here as they are implemented
    # }

    def __init_subclass__(cls, **kwargs):
        """Register subclasses in the available metrics dictionary."""
        super().__init_subclass__(**kwargs)
        # Register the subclass in the available metrics dictionary
        MetricCalculator.AVAILABLE_METRICS[cls.API_METHOD_NAME] = cls

    def __init__(self, data: LaidOutData):
        self.nodes: List[LaidOutNode] = data.nodes
        self.links: List[LaidOutConnection] = data.links

        self.valid_links = [link for link in self.links if not link.is_empty and not link.path_error and link.path is not None]

        # Convert nodes to NodeCircle representations
        self.node_circles: Dict[str, NodeCircle] = {}
        for node in self.nodes:
            self.node_circles[node.id] = NodeCircle(node.x, node.y, node.radius)

    @abstractmethod
    def calculate(self) -> MetricResult:
        """Calculate the metric. Must be implemented by subclasses."""
        pass


def calculate_metrics(data: LaidOutData, method: str) -> MetricResult:
    """
    Calculate a specific metric for the given graph layout data.

    Args:
        data: The layout data to analyze
        method: The specific metric method to calculate

    Returns:
        A single metric result
    """
    # Check if the requested method exists
    if method not in MetricCalculator.AVAILABLE_METRICS:
        return MetricResult(key=method, value=-1, type="lower-better", error=f"Unknown metric method: {method}")

    try:
        calculator_class = MetricCalculator.AVAILABLE_METRICS[method]
        calculator = calculator_class(data)
        return calculator.calculate()
    except Exception as e:
        print(f"Error calculating {method} metric: {e}")
        return MetricResult(key=method, value=-1, type="lower-better", error=str(e))


def calculate_all_metrics(data: LaidOutData) -> List[MetricResult]:
    """
    Calculate all available metrics for the given graph layout data.

    Args:
        data: The layout data to analyze

    Returns:
        List of all metric results
    """
    results: List[MetricResult] = []

    # Calculate each available metric
    for method_name in MetricCalculator.AVAILABLE_METRICS:
        results.append(calculate_metrics(data, method_name))

    return results


def convert_dict_to_laid_out_data(data_dict: Dict[str, Any]) -> LaidOutData:
    """Convert a dictionary to a LaidOutData object."""
    nodes: List[LaidOutNode] = [
        LaidOutNode(id=node["id"], x=float(node["x"]), y=float(node["y"]), score=float(node["score"]), radius=float(node["radius"])) for node in data_dict["nodes"]
    ]

    links: List[LaidOutConnection] = [
        LaidOutConnection(source=link["source"], target=link["target"], weight=float(link["weight"]), distance=float(link["distance"]), path=link["path"])
        for link in data_dict["links"]
    ]

    return LaidOutData(nodes=nodes, links=links)
