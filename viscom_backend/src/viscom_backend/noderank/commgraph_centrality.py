from __future__ import annotations

import math
from typing import Literal

import networkx as nx

from viscom_backend.commgraph.converter import convert_node_connections_graph_to_topic_graph


def calculate_commgraph_centrality(graph: nx.MultiDiGraph, mode: Literal["reachability", "closeness", "significance", "degree", "harmonic"], normalize=True) -> dict[str, float]:
    """
    Compute the commgraph centrality for nodes.

    The different modes are:
    - "reachability": The reachability of a node u is the sum of the inverse of the shortest path lengths from all other nodes v to u (harmonic centrality).
    - "closeness": The closeness extends the reachability by adding the inverse of the shortest path lengths from u to all other nodes v also to the start node v.
    - "significance": The significance not only values the start and end node of the shortest path, but also the nodes on the shortest path between the start and end node.

    """

    topic_graph = convert_node_connections_graph_to_topic_graph(graph)
    # topic_graph = graph

    centrality = dict.fromkeys(graph, 0.0)
    topic_degrees: dict[str, int] = dict.fromkeys(graph, 0)  #
    graph_degrees: dict[str, int] = dict.fromkeys(graph, 0)

    do_sqrt = True

    # Save the degrees for each node
    for node in graph.nodes():
        graph_degrees[node] = graph.degree(node)
        # centrality[node] = topic_graph.degree(node)

        # We don't want to take the raw degree that minds also unused topics
        # Instead, we only want to add topics, that are used, thus if the degree of an adjacent topic is greater than 1

        for topic in topic_graph.neighbors(node):
            if topic_graph.degree(topic) > 1:
                topic_degrees[node] += 1

    if mode == "degree":
        # Iterate over each node in the original graph and assign its degree in the topic graph to the centrality value
        for node in graph.nodes():
            centrality[node] = topic_degrees[node]
            # # centrality[node] = topic_graph.degree(node)

            # # We don't want to take the raw degree that minds also unused topics
            # # Instead, we only want to add topics, that are used, thus if the degree of an adjacent topic is greater than 1

            # for topic in topic_graph.neighbors(node):
            #     if topic_graph.degree(topic) > 1:
            #         centrality[node] += 1

    elif mode == "harmonic":
        # do_sqrt = False
        reverse_graph = topic_graph.reverse()
        for start_node in graph.nodes():
            shortest_paths = nx.dijkstra_predecessor_and_distance(topic_graph, start_node, weight="distance")
            shortest_paths_reverse = nx.dijkstra_predecessor_and_distance(reverse_graph, start_node, weight="distance")

            for end_node in graph.nodes():
                if end_node in shortest_paths[1] and shortest_paths[1][end_node] > 0:
                    centrality[start_node] += (1 / shortest_paths[1][end_node]) ** 2
                    # centrality[start_node] += (1 / shortest_paths[1][end_node]) ** 1
                if end_node in shortest_paths_reverse[1] and shortest_paths_reverse[1][end_node] > 0:
                    centrality[start_node] += (1 / shortest_paths_reverse[1][end_node]) ** 2
                    # centrality[start_node] += (1 / shortest_paths_reverse[1][end_node]) ** 1

    else:
        for start_node in graph.nodes():
            # print(start_node)
            # On the topic graph we now calculate the shortest paths between all node-pairs of the original graph
            # Get shortest path to all other nodes
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
                    # centrality[start_node] += 1 / shortest_paths[1][end_node]
                    centrality[start_node] += (1 / shortest_paths[1][end_node]) ** 2

                    scored_nodes: set[str] = set()
                    scored_nodes.add(start_node)

                    # print("\t[SCORE]", start_node, end_node)

                    def score_node(node: str):
                        if node in scored_nodes:
                            return

                        scored_nodes.add(node)
                        if node in centrality and shortest_paths[1][node] > 0:
                            score = (1 / shortest_paths[1][node]) ** 2
                            # score = (1 / shortest_paths[1][node]) ** 1
                            # print("\t\t[SCORE]", node, score, shortest_paths[1][node])
                            centrality[node] += score

                        # if len(shortest_paths[0][node]) > 1:
                        #     print("\t[MORE THAN 1 PRED]", node, shortest_paths[0][node])

                        for pred_node in shortest_paths[0][node]:
                            score_node(pred_node)

                    # From the end_node, go the path back to the start_node and add the values to the intermediate nodes
                    score_node(end_node)

                # print("\t", start_node, end_node, shortest_paths[1][end_node])
            x = 5

    if do_sqrt:
        centrality = {node: math.sqrt(value) for node, value in centrality.items()}

    # Sort the centrality values
    centrality = dict(sorted(centrality.items(), key=lambda item: item[1], reverse=True))

    # betweenness = nx.betweenness_centrality(graph, weight="distance", normalized=True)
    # centrality = {node: value / (betweenness[node] if betweenness[node] > 0 else 1) for node, value in centrality.items()}

    for node in centrality:
        # print(node, round(centrality[node], 4), round(betweenness[node], 4))
        print(node, round(centrality[node], 4))

    # Normalize the values
    if normalize:
        values = list(centrality.values())
        if len(values) > 0:
            max_value = max(values)
            if max_value > 0:
                centrality = {node: value / max_value for node, value in centrality.items()}

    for node in centrality:
        # print(node, round(centrality[node], 4), round(betweenness[node], 4))
        print(node, round(centrality[node], 4))

    return centrality


class DistanceResult:
    def __init__(self, start_node: str, target_node: str, distance: int):
        self.parent_node = start_node
        self.target_node = target_node
        self.distance = distance

    def __str__(self):
        return f"{self.parent_node} -> {self.target_node}: {self.distance}"

    def __repr__(self):
        return str(self)


class NodeCluster:
    def __init__(self, node: str):
        self.center_node = node
        self.distance_results: list[DistanceResult] = []

        self.child_node_to_distance_map: dict[str, int] = dict()

        self.parent: NodeCluster | None = None
        self.children: list[NodeCluster] = []

    def add_distance_result(self, target_node: str, distance: int):
        self.distance_results.append(DistanceResult(self.center_node, target_node, distance))
        self.child_node_to_distance_map[target_node] = distance


class ResolvedCluster:
    def __init__(self, node: str):
        # The center node of the cluster
        self.node = node

        # Distances to other nodes in the cluster
        self.child_node_to_distance_map: dict[str, int] = dict()

        self.max_path_distance = 0

        self.cluster_graph: nx.Graph = nx.Graph()

    def __str__(self):
        return self.node + ": " + len(self.child_node_to_distance_map)

    def __repr__(self):
        return f"ResolvedCluster({len(self.child_node_to_distance_map)})[{self.max_path_distance}] of {self.node}"

    def resolve(self, clusters: dict[str, NodeCluster]):
        to_resolve = [self.node]
        resolved_nodes: set[str] = set()

        # Add all distances of child nodes to the cluster
        while len(to_resolve) > 0:
            current_node = to_resolve.pop(0)
            if current_node in resolved_nodes:
                continue

            resolved_nodes.add(current_node)
            self.cluster_graph.add_node(current_node)

            cluster = clusters[current_node]
            for child_node in cluster.child_node_to_distance_map:
                to_resolve.append(child_node)
                distance = cluster.child_node_to_distance_map[child_node]

                # Add the path segment to the graph
                # If there is already a path segment between the nodes, we check if the new distance is shorter
                if self.cluster_graph.has_edge(current_node, child_node):
                    current_distance = self.cluster_graph[current_node][child_node]["distance"]
                    if distance < current_distance:
                        self.cluster_graph[current_node][child_node]["distance"] = distance
                else:
                    self.cluster_graph.add_edge(current_node, child_node, distance=distance)

            self.update_distances()

    def update_distances(self):
        # Now get the shortest distances between the cluster center and all other nodes
        if not self.cluster_graph.has_node(self.node):
            return
        shortest_paths = nx.single_source_dijkstra_path_length(self.cluster_graph, self.node, weight="distance")
        for target_node in shortest_paths:
            distance = shortest_paths[target_node]
            self.child_node_to_distance_map[target_node] = distance

        # shortest_paths_length = nx.single_source_shortest_path_length(self.cluster_graph, self.node)
        shortest_paths_length = nx.single_source_dijkstra_path_length(self.cluster_graph, self.node, weight="distance")

        self.max_path_distance = max(shortest_paths_length.values())

    def remove_node(self, node: str):
        if node in self.child_node_to_distance_map:
            del self.child_node_to_distance_map[node]

        if self.cluster_graph.has_node(node):
            self.cluster_graph.remove_node(node)


def get_commgraph_node_clusters(graph: nx.MultiDiGraph):
    topic_graph = convert_node_connections_graph_to_topic_graph(graph)
    topic_graph_reversed = convert_node_connections_graph_to_topic_graph(graph, reversed=False)
    topic_graph_undirected = convert_node_connections_graph_to_topic_graph(graph, directed=False)

    degree_centrality = calculate_commgraph_centrality(graph, mode="degree")
    significance_centrality = calculate_commgraph_centrality(graph, mode="significance")

    combined_centrality = {node: degree_centrality[node] * significance_centrality[node] for node in graph.nodes()}
    combined_centrality = dict(sorted(combined_centrality.items(), key=lambda item: item[1], reverse=True))

    for node in combined_centrality:
        print(node, combined_centrality[node])

    # For each node, we want to store the distances to all other nodes in the graph
    distance_maps: dict[str, dict[str, int | None]] = dict()
    visited_nodes: set[str] = set()

    for node in combined_centrality:
        distance_maps[node] = dict()

        # Clone the topic graph
        topic_graph_copy = topic_graph.copy()
        topic_graph_reversed_copy = topic_graph_reversed.copy()
        topic_graph_undirected_copy = topic_graph_undirected.copy()

        # Delete already visited nodes
        # for visited_node in visited_nodes:
        #     topic_graph_copy.remove_node(visited_node)
        #     topic_graph_reversed_copy.remove_node(visited_node)
        #     topic_graph_undirected_copy.remove_node(visited_node)

        shortest_paths = nx.dijkstra_predecessor_and_distance(topic_graph_copy, node, weight="distance")
        shortest_paths_reversed = nx.dijkstra_predecessor_and_distance(topic_graph_reversed_copy, node, weight="distance")
        shortest_paths_undirected = nx.dijkstra_predecessor_and_distance(topic_graph_undirected_copy, node, weight="distance")

        for target_node in graph:
            if target_node in shortest_paths[1]:
                d = min(shortest_paths[1][target_node], shortest_paths_reversed[1][target_node])
                d_undirected = shortest_paths_undirected[1][target_node]
                distance_maps[node][target_node] = d

        visited_nodes.add(node)

    # for node in distance_maps:
    #     print(node)
    #     for target_node in distance_maps[node]:
    #         print("\t", target_node, distance_maps[node][target_node])

    distance_results: list[DistanceResult] = []

    for start_node in distance_maps:
        for target_node in distance_maps[start_node]:
            if start_node == target_node:
                continue
            if distance_maps[start_node][target_node] is None:
                continue
            distance = distance_maps[start_node][target_node]
            distance_results.append(DistanceResult(start_node, target_node, distance))

    # for result in distance_results:
    #     print(result)

    # Sort the distance results ascending
    # If distance is the same, sort by the combined centrality descending
    distance_results = sorted(distance_results, key=lambda x: (x.distance, -combined_centrality[x.parent_node]), reverse=False)

    # For each node, create a cluster
    cluster_map: dict[str, NodeCluster] = {}
    for node in distance_maps:
        cluster = NodeCluster(node)
        cluster_map[node] = cluster

    # Store the distances at which a node has been added to a cluster
    node_to_distance_in_cluster_map: dict[str, int] = dict()
    duplicated_nodes: set[str] = set()

    for distance_result in distance_results:
        # The distance result are already sorted by distance, so the nodes appear in the order of the distance

        parent_node = distance_result.parent_node
        target_node = distance_result.target_node
        distance = distance_result.distance

        if target_node in node_to_distance_in_cluster_map:  # noqa: SIM102
            # We continue if the current distance is greater than the already added distance
            if distance > node_to_distance_in_cluster_map[target_node]:
                continue

            # If the distance is the same, we add the node to the duplicated nodes
            duplicated_nodes.add(target_node)

        cluster = cluster_map[parent_node]
        cluster.add_distance_result(target_node, distance)
        node_to_distance_in_cluster_map[target_node] = distance

    # Print the clusters
    for node in cluster_map:
        cluster = cluster_map[node]
        print(cluster.center_node)
        for distance_result in cluster.distance_results:
            print("\t", distance_result)

    # Print the duplicated nodes
    print("\nDuplicated nodes:")
    for node in duplicated_nodes:
        print(node)

    # resolved_cluster = ResolvedCluster("i2c_bridge_node")
    # resolved_cluster.resolve(cluster_map)

    # Resolve the clusters
    resolved_clusters: list[ResolvedCluster] = []

    for node in combined_centrality:
        resolved_cluster = ResolvedCluster(node)
        resolved_cluster.resolve(cluster_map)
        resolved_clusters.append(resolved_cluster)

    min_node_count_per_cluster = 3
    max_path_distance = 3

    separated_clusters: list[ResolvedCluster] = []
    moved_clusters: set[str] = set()
    while len(resolved_clusters) > 0:
        cluster = resolved_clusters[0]

        # If the cluster has less than 3 nodes, we shift it to the end
        if len(cluster.child_node_to_distance_map) < min_node_count_per_cluster:
            if cluster.node not in moved_clusters:
                resolved_clusters.remove(cluster)
                resolved_clusters.append(cluster)
                moved_clusters.add(cluster.node)
                continue

            # Handle the case where all left clusters have less than 3 nodes and we can't separate them further
            separated_clusters.append(cluster)
            resolved_clusters.remove(cluster)
            added_nodes = cluster.child_node_to_distance_map.keys()
        else:
            # If the cluster has a greater path distance than the max path distance, we try to separate it
            if cluster.max_path_distance > max_path_distance:
                nodes_in_cluster = set(cluster.child_node_to_distance_map.keys())
                next_clusters = [c for c in resolved_clusters if c.node in nodes_in_cluster and c != cluster]
                if len(next_clusters) == 0:
                    separated_clusters.append(cluster)
                    resolved_clusters.remove(cluster)
                    added_nodes = cluster.child_node_to_distance_map.keys()
                else:
                    next_cluster = next_clusters[0]
                    nodes_in_cluster |= set(next_cluster.child_node_to_distance_map.keys())

                    nodes_to_keep_in_current_cluster = set()
                    nodes_to_keep_in_next_cluster = set()

                    # For each node of the clusters, we assign it to the cluster where the distance to the center node is shorter
                    for node in nodes_in_cluster:
                        distance_cluster = cluster.child_node_to_distance_map.get(node, None)
                        distance_next_cluster = next_cluster.child_node_to_distance_map.get(node, None)

                        if distance_cluster is None:
                            nodes_to_keep_in_next_cluster.add(node)
                        elif distance_next_cluster is None or distance_cluster <= distance_next_cluster:
                            nodes_to_keep_in_current_cluster.add(node)
                        else:
                            nodes_to_keep_in_next_cluster.add(node)

                    if len(nodes_to_keep_in_next_cluster) <= min_node_count_per_cluster:
                        nodes_to_keep_in_current_cluster |= nodes_to_keep_in_next_cluster
                        nodes_to_keep_in_next_cluster = set()
                        resolved_clusters.remove(next_cluster)

                    # Remove the nodes from the clusters
                    for node in nodes_to_keep_in_current_cluster:
                        next_cluster.remove_node(node)
                    for node in nodes_to_keep_in_next_cluster:
                        cluster.remove_node(node)

                    # Update the distances
                    cluster.update_distances()
                    next_cluster.update_distances()

                    continue

            else:
                separated_clusters.append(cluster)
                resolved_clusters.remove(cluster)
            added_nodes = cluster.child_node_to_distance_map.keys()

        # Remove the clusters that have nodes of the current cluster as parent
        clusters_to_remove: list[ResolvedCluster] = [c for c in resolved_clusters if c.node in added_nodes]
        for c in clusters_to_remove:
            resolved_clusters.remove(c)

        # For each other cluster remove the nodes that are in the current cluster
        for c in resolved_clusters:
            for node in added_nodes:
                c.remove_node(node)
                c.update_distances()

        x = 5

    x = 5
