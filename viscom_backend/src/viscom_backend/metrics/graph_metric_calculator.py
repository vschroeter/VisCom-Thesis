from __future__ import annotations

import networkx as nx

from .metrics_calculator import LaidOutData, MetricCalculator


class GraphMetricCalculator(MetricCalculator):
    """Abstract base class for metrics that require a graph representation."""

    def __init__(self, data: LaidOutData):
        super().__init__(data)
        # Create a directed graph by default
        # self.graph = self._create_graph()
        # Also create an undirected version for metrics that need it
        # self.undirected_graph = self.get_undirected_graph()

    def get_graph(self) -> nx.DiGraph:
        """Create a weighted directed networkx graph from the layout data."""
        G = nx.DiGraph()

        # Add nodes with positions
        for node in self.nodes:
            node_circle = self.node_circles[node.id]
            G.add_node(node.id, pos=(node_circle.x, node_circle.y))

        # Add edges with weights
        for link in self.valid_links:
            G.add_edge(link.source, link.target, weight=link.weight, distance=link.distance)

        return G

    def get_undirected_graph(self) -> nx.Graph:
        """Convert the directed graph to an undirected graph."""
        # Create a new undirected graph
        G_undirected = nx.Graph()

        graph = self.get_graph()

        # Copy nodes and their attributes
        for node, attrs in graph.nodes(data=True):
            G_undirected.add_node(node, **attrs)

        # Copy edges and their attributes (removing duplicates automatically)
        for u, v, attrs in graph.edges(data=True):
            if G_undirected.has_edge(u, v):
                # If the edge already exists, keep the minimum distance/weight
                current_attrs = G_undirected.get_edge_data(u, v)
                G_undirected[u][v]["weight"] = min(attrs.get("weight", 1.0), current_attrs.get("weight", 1.0))
                G_undirected[u][v]["distance"] = min(attrs.get("distance", 1.0), current_attrs.get("distance", 1.0))
            else:
                G_undirected.add_edge(u, v, **attrs)

        return G_undirected
