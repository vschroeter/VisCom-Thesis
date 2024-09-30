from __future__ import annotations

import random
from collections import defaultdict
from functools import lru_cache

import networkx as nx
from networkx.algorithms.community import modularity

from commgraph_backend.commgraph.converter import convert_node_connections_graph_to_topic_graph, convert_to_weighted_graph


class Communities:
    def __init__(self, graph: nx.DiGraph, partitions: list[set[str]], weight="weight") -> None:
        self.graph = self.G = G = graph
        self.global_partition = partitions
        self.inner_partition = [{node} for node in G.nodes()]

        self.total_edge_count = self.graph.size(weight=weight)

        # Current community assignment of nodes
        self.node_to_community_index: dict[str, int] = {n: i for i, n in enumerate(self.G.nodes())}

        # Store the degrees of the current hyper nodes
        self.node_in_degrees = dict(self.G.in_degree(weight=weight))
        self.node_out_degrees = dict(self.G.out_degree(weight=weight))

        # Store the degrees of the communities
        self.community_total_in_degrees = list(self.node_in_degrees.values())
        self.community_total_out_degrees = list(self.node_out_degrees.values())

        # The weights of nodes to its neighbors
        # combined both in and out weights without considering self loops.
        # Dict is of the form {start_node: {target_node: weight}}
        self.neighbor_weights: dict[str, dict[str, float]] = dict()

        for node in G:
            self.neighbor_weights[node] = defaultdict(float)

            for start_node, target_node, connection_data in G.out_edges(node, data=True):
                if start_node == target_node:
                    continue

                weight = connection_data.get("weight", 1)
                self.neighbor_weights[node][target_node] += weight

            for start_node, target_node, connection_data in G.in_edges(node, data=True):
                if start_node == target_node:
                    continue

                weight = connection_data.get("weight", 1)
                self.neighbor_weights[node][start_node] += weight

    @property
    def m(self):
        return self.total_edge_count

    # Allow subscript access to the class
    def __getitem__(self, node: str) -> int:
        return self.node_to_community_index[node]

    def get_global_communities(self):
        return [c for c in self.global_partition if c and len(c) > 0]

    def get_current_hyper_communities(self):
        return [c for c in self.inner_partition if c and len(c) > 0]

    def get_community_of_node(self, node: str) -> int:
        return self.node_to_community_index[node]

    def out_degree_of_node(self, node: str) -> int:
        return self.node_out_degrees.get(node, 0)

    def in_degree_of_node(self, node: str) -> int:
        return self.node_in_degrees.get(node, 0)

    def get_total_in_of_community(self, community: int) -> int:
        return self.community_total_in_degrees[community]

    def get_total_out_of_community(self, community: int) -> int:
        return self.community_total_out_degrees[community]

    def get_expected_out_edges_prob_from_node_to_community(self, node: str, community: int, resolution: float = 1):
        return self.out_degree_of_node(node) * self.get_total_in_of_community(community) / self.total_edge_count

    def get_expected_in_edges_prob_from_community_to_node(self, node: str, community: int, resolution: float = 1):
        return self.in_degree_of_node(node) * self.get_total_out_of_community(community) / self.total_edge_count

    def get_expected_total_edges_prob_of_node_to_community(self, node: str, community: int, resolution: float = 1):
        out_pro = self.get_expected_out_edges_prob_from_node_to_community(node, community, resolution)
        in_prob = self.get_expected_in_edges_prob_from_community_to_node(node, community, resolution)

        return (out_pro + in_prob)

    # @lru_cache
    def get_weights_from_community_to_other_communities(self, node: str):
        weights_to_neighbor_communities = defaultdict(float)
        for neighbor_node, weight in self.neighbor_weights[node].items():
            neighbor_community = self[neighbor_node]
            weights_to_neighbor_communities[neighbor_community] += weight
        return weights_to_neighbor_communities

    def get_neighbor_communities(self, node: str):
        return self.get_weights_from_community_to_other_communities(node).keys()

    #########################################################
    # ACTIONS #
    #########################################################

    def remove_node_from_its_current_community(self, node: str, resolution: float = 1.0) -> float:
        """Remove the node from its current community and return the removal costs.

        Parameters
        ----------
        node : str
            The node to remove from its current community
        """
        current_community = self[node]

        in_degree = self.in_degree_of_node(node)
        out_degree = self.out_degree_of_node(node)

        self.community_total_in_degrees[current_community] -= in_degree
        self.community_total_out_degrees[current_community] -= out_degree

        comm_weights = self.get_weights_from_community_to_other_communities(node)

        nodes_contribution_to_current_community = comm_weights[current_community]
        # expected_outgoing_prob = self.get_expected_out_edges_prob_from_node_to_community(node, current_community, resolution)
        # expected_incoming_prob = self.get_expected_in_edges_prob_from_community_to_node(node, current_community, resolution)
        expected_total_prob = self.get_expected_total_edges_prob_of_node_to_community(node, current_community, resolution)

        remove_mod_cost = (-nodes_contribution_to_current_community + expected_total_prob) / self.m

        nodes_in_community = self.G.nodes[node].get("nodes", {node})
        self.global_partition[current_community].difference_update(nodes_in_community)
        self.inner_partition[current_community].remove(node)

        self.node_to_community_index[node] = -1

        return remove_mod_cost

    def get_gain_for_adding_node_to_community(self, node: str, community: int, resolution: float = 1.0):
        weights_to_neighbor_communities = self.get_weights_from_community_to_other_communities(node)
        weight_to_community = weights_to_neighbor_communities[community]

        # expected_outgoing_prob = self.get_expected_out_edges_prob_from_node_to_community(node, community, resolution)
        # expected_incoming_prob = self.get_expected_in_edges_prob_from_community_to_node(node, community, resolution)
        expected_total_prob = self.get_expected_total_edges_prob_of_node_to_community(node, community, resolution)

        gain = (weight_to_community - (expected_total_prob)) / self.m

        return gain

    def add_node_to_community(self, node: str, community: int):
        G = self.G
        # The hyper communities as nodes store the nodes of the community in the "nodes" attribute
        nodes_in_community = G.nodes[node].get("nodes", {node})

        # Update the total in and out degrees of the community
        in_degree = self.in_degree_of_node(node)
        out_degree = self.out_degree_of_node(node)

        self.community_total_in_degrees[community] += in_degree
        self.community_total_out_degrees[community] += out_degree

        # Update the global partition and the inner partition
        self.global_partition[community].update(nodes_in_community)
        self.inner_partition[community].add(node)

        # Update the node to community index
        self.node_to_community_index[node] = community

    def init_new_communities(self) -> Communities:
        """
        Update the current graph according to the current hyper communities
        """

        new_graph = nx.DiGraph()

        node_to_community_index: dict[str, int] = dict()

        # First add new hyper nodes to the graph
        # containing all nodes of the hyper community
        hyper_communities = self.get_current_hyper_communities()

        for i, community in enumerate(hyper_communities):
            nodes_in_hyper_community = set()

            for hyper_node in community:
                node_to_community_index[hyper_node] = i
                nodes_in_hyper_node = self.graph.nodes[hyper_node].get("nodes", set([hyper_node]))
                nodes_in_hyper_community.update(nodes_in_hyper_node)

            # We add a new hyper node to the new graph containing all nodes of the hyper community
            new_graph.add_node(i, nodes=nodes_in_hyper_community)

        # Add the edges between the hyper nodes based on the current graph
        for start_node, target_node, connection_data in self.graph.edges(data=True):
            weight = connection_data.get("weight", 1)

            start_community = node_to_community_index[start_node]
            target_community = node_to_community_index[target_node]

            current_weight = new_graph.get_edge_data(start_community, target_community, default={"weight": 0})["weight"]
            new_weight = current_weight + weight
            new_graph.add_edge(start_community, target_community, weight=new_weight)

            # # Add the edge to the new graph
            # new_graph.add_edge(start_community, target_community, weight=weight)

        # # Print graph
        # print("New graph:")
        # # Print nodes with data
        # for node in new_graph.nodes(data=True):
        #     print(node)
        
        # for edge in new_graph.edges(data=True):
        #     print(edge)

        # Create new communities object
        new_communities = Communities(new_graph, self.get_global_communities())
        return new_communities


class CommGraphCommunityDetector:
    def __init__(self, graph: nx.MultiDiGraph) -> None:
        self.graph = graph

        self.weighted_node_graph = convert_to_weighted_graph(graph)
        self.topic_graph = convert_node_connections_graph_to_topic_graph(graph)
        self.communities = Communities(self.weighted_node_graph, [{n} for n in self.weighted_node_graph.nodes()])

        # self.current_graph = self.weighted_node_graph

        # self.total_edge_count = self.weighted_node_graph.size()
        # self.total_weighted_edges = self.weighted_node_graph.size(weight="weight")

        # # Initialize communities
        # # Each node starts in its own community
        # self.communities: list[set[str]] = [{n} for n in graph.nodes()]

        # # Current hyper communities
        # # At the start, each community is its own hyper community
        # # During the algorithm, at each step, nodes of the same community are merged into a hyper community
        # self.hyper_communities: list[set[str]] = [set(c) for c in self.communities]

        # nx.algorithms.community.louvain_communities(self.weighted_node_graph)

    def calculate_commgraph_communities(self, weight="weight", resolution=1, threshold=0.0000001, seed=None) -> list[set[str]]:
        """
        Get communities from a graph using a adapted Louvain algorithm
        """

        mod = modularity(self.weighted_node_graph, self.communities.global_partition, weight=weight, resolution=resolution)

        print(f"Start mod: {mod}")

        while True:
            self.communities = self.communities.init_new_communities()
            # Create the new graph according to the current hyper communities
            # self.current_graph = self._generate_current_graph()
            # self.communities = Communities(self.current_graph, self.communities.get_global_communities())

            # Iterate a step to get the new improved communities
            global_communities, inner_communities, improved = self._iterate_one_level()

            new_mod = modularity(self.weighted_node_graph, self.communities.global_partition, weight=weight, resolution=resolution)

            if new_mod - mod < threshold:
                print(f"End mod: {new_mod}")
                break

            mod = new_mod

            if not improved:
                print(f"Did not improve End mod: {mod}")
                break

    def _iterate_one_level(self) -> None:
        G = self.communities.graph

        communities = self.communities

        # Take a random order of the nodes
        random_nodes = list(G.nodes)
        random.seed(42)
        random.shuffle(random_nodes)

        moved_nodes = 1
        improved = False

        # Repeat until no nodes have been moved
        while moved_nodes > 0:
            moved_nodes = 0

            # Iterate over all nodes
            for node in random_nodes:
                best_gain = 0
                current_community = communities[node]
                best_community = current_community

                # First remove the node from its current community and get the removal cost
                remove_cost = communities.remove_node_from_its_current_community(node)

                # Now for each neighbor community check the gain of adding the node to the community
                for new_community in communities.get_neighbor_communities(node):
                    gain = communities.get_gain_for_adding_node_to_community(node, new_community)
                    total_gain = remove_cost + gain
                    if total_gain > best_gain:
                        best_gain = total_gain
                        best_community = new_community

                # Add the node to the best community
                communities.add_node_to_community(node, best_community)

                # If the best community is not the current community, move the node
                if best_community != current_community:
                    moved_nodes += 1
                    improved = True

        # Filter out empty communities
        global_communities = communities.get_global_communities()
        inner_communities = communities.get_current_hyper_communities()

        print(f"Global communities: {global_communities}")

        return global_communities, inner_communities, improved

    # def _generate_current_graph(self) -> None:
    #     """
    #     Update the current graph according to the current hyper communities
    #     """

    #     new_graph = nx.DiGraph()

    #     communitiy_graph = self.communities.graph

    #     node_to_community_index: dict[str, int] = dict()

    #     # First add new hyper nodes to the graph
    #     # containing all nodes of the hyper community
    #     for i, community in enumerate(self.communities.inner_partition):
    #         nodes_in_hyper_community = set()

    #         for hyper_node in community:
    #             node_to_community_index[hyper_node] = i
    #             nodes_in_hyper_node = communitiy_graph[hyper_node].get("nodes", set([hyper_node]))
    #             nodes_in_hyper_community.update(nodes_in_hyper_node)

    #         # We add a new hyper node to the new graph containing all nodes of the hyper community
    #         new_graph.add_node(i, nodes=nodes_in_hyper_community)

    #     # Add the edges between the hyper nodes based on the current graph
    #     for start_node, target_node, connection_data in communitiy_graph.edges(data=True):
    #         weight = connection_data.get("weight", 1)

    #         start_community = node_to_community_index[start_node]
    #         target_community = node_to_community_index[target_node]

    #         current_weight = new_graph.get_edge_data(start_community, target_community, default={"weight": 0})["weight"]
    #         new_weight = current_weight + weight
    #         new_graph.add_edge(start_community, target_community, weight=new_weight)

    #         # Add the edge to the new graph
    #         new_graph.add_edge(start_community, target_community, weight=weight)

    #     return new_graph
