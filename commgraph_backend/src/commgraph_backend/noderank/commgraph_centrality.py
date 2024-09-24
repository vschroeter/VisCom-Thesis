from typing import Literal
import networkx as nx
from networkx import Graph
from networkx.algorithms.centrality.betweenness import _accumulate_basic, _accumulate_endpoints, _rescale, _single_source_dijkstra_path_basic, _single_source_shortest_path_basic

from commgraph_backend.commgraph.converter import convert_node_connections_graph_to_topic_graph


def calculate_commgraph_centrality(graph: nx.MultiDiGraph, mode: Literal["reachability", "closeness", "significance", "degree"]) -> dict[str, float]:
    """
    Compute the commgraph centrality for nodes.

    The different modes are:
    - "reachability": The reachability of a node u is the sum of the inverse of the shortest path lengths from all other nodes v to u (harmonic centrality).
    - "closeness": The closeness extends the reachability by adding the inverse of the shortest path lengths from u to all other nodes v also to the start node v.
    - "significance": The significance not only values the start and end node of the shortest path, but also the nodes on the shortest path between the start and end node.

    """

    topic_graph = convert_node_connections_graph_to_topic_graph(graph)

    centrality = dict.fromkeys(graph, 0.0)

    if mode == "degree":
        # Iterate over each node in the original graph and assign its degree in the topic graph to the centrality value
        for node in graph.nodes():
            centrality[node] = topic_graph.degree(node)
    else:

        for start_node in graph.nodes():
            print(start_node)
            # On the topic graph we now calculate the shortest paths between all node-pairs of the original graph
            # Get shortest path to all other nodes
            shortest_paths = nx.single_source_shortest_path_length(topic_graph, start_node)
            shortest_paths = nx.dijkstra_predecessor_and_distance(topic_graph, start_node, weight="distance")
            for end_node in graph.nodes():
                if end_node not in shortest_paths[1]:
                    continue

                if end_node == start_node:
                    continue

                if mode == "reachability":
                    # If we only want to calculate the reachability,
                    # we just add the inverse of the shortest path length to end node to the reachability value of the end node
                    centrality[end_node] += 1 / shortest_paths[1][end_node]
                elif mode == "closeness":
                    # If we want to also value the start node for a short path to the end node,
                    # we add the inverse of the shortest path length to the start node to the centrality value of the start node
                    centrality[end_node] += 1 / shortest_paths[1][end_node]
                    centrality[start_node] += 1 / shortest_paths[1][end_node]
                elif mode == "significance":
                    # If we want to also value the nodes on the shortest path between the start and end node,
                    # we add the paths of the shortest path to the respective nodes
                    centrality[start_node] += 1 / shortest_paths[1][end_node]

                    # From the end_node, go the path back to the start_node and add the values to the intermediate nodes
                    current_node = end_node
                    while current_node != start_node:
                        if current_node in centrality:
                            centrality[current_node] += 1 / shortest_paths[1][current_node]
                        current_node = shortest_paths[0][current_node][0]

                print("\t", start_node, end_node, shortest_paths[1][end_node])
            x = 5

    # Sort the centrality values
    centrality = dict(sorted(centrality.items(), key=lambda item: item[1], reverse=True))

    # Normalize the values
    max_value = max(centrality.values())
    centrality = {node: value / max_value for node, value in centrality.items()}

    return centrality
