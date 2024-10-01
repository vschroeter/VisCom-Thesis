from __future__ import annotations

import random
from collections import defaultdict
from functools import lru_cache

import networkx as nx
from networkx.algorithms.community import modularity

from commgraph_backend.commgraph.converter import convert_node_connections_graph_to_topic_graph, convert_to_weighted_graph


class Community:
    def __init__(self, nodes: set[str] = None) -> None:
        self.nodes = nodes or set()

        self.hypermodes: list[HyperNode] = []

        self.total_in_degree = 0
        self.total_out_degree = 0

    def is_empty(self):
        return len(self.nodes) == 0

    def __repr__(self) -> str:
        return f"Community ({len(self.nodes)}) [{self.nodes}]"

    def __str__(self) -> str:
        return self.__repr__()


class HyperNode:
    def __init__(self, hypernode_id: str | int, communities: Communities, community: Community) -> None:
        self.community: Community = community
        self.hypernode_id = hypernode_id
        self.communities = communities
        self.nodes = list(community.nodes)

        # # Store the degrees of the current hyper nodes
        # self.node_in_degrees = dict(self.G.in_degree(weight=weight))
        # self.node_out_degrees = dict(self.G.out_degree(weight=weight))

    @property
    def G(self):
        return self.communities.hyper_graph

    @property
    def m(self):
        return self.communities.m

    def init(self, weight="weight"):
        # Set the node to hyper node mapping
        for node in self.nodes:
            self.communities.node_to_hypernode[node] = self

        self.communities.hypernode_id_to_hypernode[self.hypernode_id] = self

        nodes_in_g = list(self.G.nodes(data=True))

        # Total degrees of the hyper node
        self.total_out_degree = self.G.out_degree(self.hypernode_id, weight=weight)
        self.total_in_degree = self.G.in_degree(self.hypernode_id, weight=weight)

        # At init, the hypernode is the only node in a community, so we can assign the same degree values as init total degrees of the community
        self.community.total_in_degree = self.total_in_degree
        self.community.total_out_degree = self.total_out_degree

        self.weights_to_other_hypernodes: dict[str, float] = defaultdict(float)

        # Weight to other hyper nodes
        for start_node, target_node, connection_data in self.G.out_edges(self.hypernode_id, data=True):
            if start_node == target_node:
                continue

            weight = connection_data.get("weight", 1)
            self.weights_to_other_hypernodes[target_node] += weight

        for start_node, target_node, connection_data in self.G.in_edges(self.hypernode_id, data=True):
            if start_node == target_node:
                continue

            weight = connection_data.get("weight", 1)
            self.weights_to_other_hypernodes[start_node] += weight

    def __repr__(self) -> str:
        return f"HyperNode {self.hypernode_id} ({len(self.nodes)}) [{self.nodes}]"

    def __str__(self) -> str:
        return self.__repr__()

    def is_empty(self):
        return len(self.nodes) == 0

    def get_neighbor_communities(self):
        return list(self.get_weights_to_communities().keys())

    def get_weight_to_hypernode(self, hypernode: str) -> float:
        return self.weights_to_other_hypernodes.get(hypernode, 0)

    def get_expected_out_edges_prob_to_community(self, community: Community, resolution: float = 1):
        return resolution * (self.total_out_degree * community.total_in_degree / self.communities.m)

    def get_expected_in_edges_prob_from_community(self, community: Community, resolution: float = 1):
        return resolution * (self.total_in_degree * community.total_out_degree / self.communities.m)
        # return self.in_degree_of_hypernode(node) * self.get_total_out_of_community(community) / self.total_edge_count

    def get_expected_total_edges_prob_to_community(self, community: Community, resolution: float = 1):
        out_pro = self.get_expected_out_edges_prob_to_community(community, resolution)
        in_prob = self.get_expected_in_edges_prob_from_community(community, resolution)

        return out_pro + in_prob

    def get_weights_to_communities(self) -> dict[Community, float]:
        weights_to_communities = defaultdict(float)

        for other_hypernode_id, weight in self.weights_to_other_hypernodes.items():
            neighbor_community = self.communities.get_community_of_hypernode_id(other_hypernode_id)
            weights_to_communities[neighbor_community] += weight
        return weights_to_communities

        # weights_to_neighbor_communities = defaultdict(float)

        # for neighbor_node, weight in self.neighbor_weights[node].items():
        #     neighbor_community = self[neighbor_node]
        #     weights_to_neighbor_communities[neighbor_community] += weight
        # return weights_to_neighbor_communities

    def remove_from_current_community(self, resolution: float = 1.0):
        """Remove the hypernode from its current community and return the removal costs.

        Parameters
        ----------
        node : str
            The node to remove from its current community
        """
        comm = self.community

        in_degree = self.total_in_degree
        out_degree = self.total_out_degree

        comm.total_in_degree -= in_degree
        comm.total_out_degree -= out_degree

        # self.community_total_in_degrees[current_community] -= in_degree
        # self.community_total_out_degrees[current_community] -= out_degree

        # comm_weights = self.get_weights_from_community_to_other_communities(node)
        comm_weights = self.weights_to_other_hypernodes
        comm_weights = self.get_weights_to_communities()

        nodes_contribution_to_current_community = comm_weights[comm]
        # expected_outgoing_prob = self.get_expected_out_edges_prob_from_node_to_community(node, current_community, resolution)
        # expected_incoming_prob = self.get_expected_in_edges_prob_from_community_to_node(node, current_community, resolution)
        expected_total_prob = self.get_expected_total_edges_prob_to_community(comm, resolution)

        remove_mod_cost = (-nodes_contribution_to_current_community + expected_total_prob) / self.m

        comm.nodes.difference_update(self.nodes)
        self.community = None

        # nodes_in_community = self.G.nodes[node].get("nodes", {node})
        # self.communities[current_community].difference_update(nodes_in_community)
        # self.hypernodes[current_community].remove(node)

        # self.hypernode_to_community_index[node] = -1

        return remove_mod_cost

    def get_gain_for_adding_to_community(self, community: Community, resolution: float = 1.0):
        weights_to_neighbor_communities = self.get_weights_to_communities()
        weight_to_community = weights_to_neighbor_communities[community]

        # expected_outgoing_prob = self.get_expected_out_edges_prob_from_node_to_community(node, community, resolution)
        # expected_incoming_prob = self.get_expected_in_edges_prob_from_community_to_node(node, community, resolution)
        expected_total_prob = self.get_expected_total_edges_prob_to_community(community, resolution)

        gain = (weight_to_community - (expected_total_prob)) / self.m

        return gain

    def add_to_community(self, community: Community):
        # Update the total in and out degrees of the community
        community.total_in_degree += self.total_in_degree
        community.total_out_degree += self.total_out_degree

        # Update the global partition and the inner partition
        community.nodes.update(self.nodes)
        self.community = community


class Communities:
    def __init__(self, origin_graph: nx.MultiDiGraph, weight="weight") -> None:
        # The original graph with connections between single nodes
        self.origin_graph = origin_graph

        # # The current graph with hyper nodes
        # self.graph = self.G = G = graph
        self.hyper_graph: nx.DiGraph = origin_graph
        G = self.hyper_graph

        # self.global_partition: list[set[str]] = partitions
        self.node_to_community: dict[str, Community] = {n: Community({n}) for n in G.nodes()}
        self.communities: list[Community] = list(self.node_to_community.values())
        # self.inner_partition = [{node} for node in G.nodes()]
        self.node_to_hypernode: dict[str, HyperNode] = {n: HyperNode(n, self, self.node_to_community[n]) for n in self.origin_graph.nodes()}
        self.hypernode_id_to_hypernode: dict[str, HyperNode] = dict(self.node_to_hypernode)
        self.hypernodes = list(self.node_to_hypernode.values())

        self.total_edge_count = self.origin_graph.size(weight=weight)

        # self.generate_new_hypernode_graph()

    def get_communities_as_sets(self) -> list[set[str]]:
        return [c.nodes for c in self.communities]

    # def generate_hypernode_graph(self):
    #     # Current community assignment of nodes
    #     self.hypernode_to_community_index: dict[str, int] = {n: i for i, n in enumerate(self.G.nodes())}
    #     self.node_to_community_index: dict[str, int] = dict()
    #     for hypernode in G.nodes():
    #         for node in G.nodes[hypernode].get("nodes", {hypernode}):
    #             self.node_to_community_index[node] = self.hypernode_to_community_index[hypernode]

    #     for hypernode in self.hypernodes:
    #         for node in hypernode.nodes:

    # # Store the degrees of the current hyper nodes
    # self.node_in_degrees = dict(self.G.in_degree(weight=weight))
    # self.node_out_degrees = dict(self.G.out_degree(weight=weight))

    # # Store the degrees of the communities
    # self.community_total_in_degrees = list(self.node_in_degrees.values())
    # self.community_total_out_degrees = list(self.node_out_degrees.values())

    # The weights of nodes to its neighbors
    # combined both in and out weights without considering self loops.
    # Dict is of the form {start_node: {target_node: weight}}
    # self.neighbor_weights: dict[str, dict[str, float]] = dict()

    # for node in G:
    #     self.neighbor_weights[node] = defaultdict(float)

    #     for start_node, target_node, connection_data in G.out_edges(node, data=True):
    #         if start_node == target_node:
    #             continue

    #         weight = connection_data.get("weight", 1)
    #         self.neighbor_weights[node][target_node] += weight

    #     for start_node, target_node, connection_data in G.in_edges(node, data=True):
    #         if start_node == target_node:
    #             continue

    #         weight = connection_data.get("weight", 1)
    #         self.neighbor_weights[node][start_node] += weight

    @property
    def m(self):
        return self.total_edge_count

    def generate_new_hypernode_graph(self) -> Communities:
        """
        Update the current graph according to the current hyper communities
        """

        new_graph = nx.DiGraph()

        # node_to_community_index: dict[str, int] = dict()

        community_to_new_hypernode_id: dict[Community, int] = dict()

        new_hypernodes: list[HyperNode] = []

        current_hypernodes = self.get_current_hypernodes()
        old_hypernode_id_to_community: dict[HyperNode, Community] = dict()

        for hypernode in current_hypernodes:
            old_hypernode_id_to_community[hypernode.hypernode_id] = hypernode.community

        # First add new hyper nodes to the graph
        # containing all nodes of the hyper community
        communities = self.get_communities()

        for i, community in enumerate(communities):
            nodes_in_community = community.nodes

            # Create a new hyper node
            hypernode = HyperNode(i, self, community)
            new_hypernodes.append(hypernode)
            community_to_new_hypernode_id[community] = i

            # We add a new hyper node to the new graph containing all nodes of the hyper community
            new_graph.add_node(i, nodes=nodes_in_community, hypernode=hypernode)

        # for i, hyper_node in enumerate(hyper_nodes):
        #     nodes_in_community = set()

        #     for node in hyper_node.nodes:
        #         node_to_community_index[node] = i
        #         nodes_in_hyper_node = self.graph.nodes[node].get("nodes", set([node]))
        #         nodes_in_community.update(nodes_in_hyper_node)

        #     # We add a new hyper node to the new graph containing all nodes of the hyper community
        #     new_graph.add_node(i, nodes=nodes_in_community)

        # Add the edges between the hyper nodes based on the current graph
        for hypernode_s, hypernode_t, connection_data in self.hyper_graph.edges(data=True):
            weight = connection_data.get("weight", 1)

            start_community = old_hypernode_id_to_community[hypernode_s]
            target_community = old_hypernode_id_to_community[hypernode_t]

            start_i_in_new_graph = community_to_new_hypernode_id[start_community]
            target_i_in_new_graph = community_to_new_hypernode_id[target_community]

            # start_i_in_new_graph = node_to_community_index[hypernode_s]
            # target_i_in_new_graph = node_to_community_index[hypernode_t]

            current_weight = new_graph.get_edge_data(start_i_in_new_graph, target_i_in_new_graph, default={"weight": 0})["weight"]
            new_weight = current_weight + weight
            new_graph.add_edge(start_i_in_new_graph, target_i_in_new_graph, weight=new_weight)

            # weight = connection_data.get("weight", 1)

            # start_i_in_new_graph = node_to_community_index[hypernode_s]
            # target_i_in_new_graph = node_to_community_index[hypernode_t]

            # current_weight = new_graph.get_edge_data(start_i_in_new_graph, target_i_in_new_graph, default={"weight": 0})["weight"]
            # new_weight = current_weight + weight
            # new_graph.add_edge(start_i_in_new_graph, target_i_in_new_graph, weight=new_weight)

        # Set new hyper graph and nodes and initialize all
        self.hyper_graph = G = new_graph
        self.hypernodes = new_hypernodes
        self.node_to_hypernode.clear()
        self.hypernode_id_to_hypernode.clear()
        for hypernode in new_hypernodes:
            hypernode.init()

        self.hypernode_in_degrees = dict(G.in_degree(weight=weight))
        self.hypernode_out_degrees = dict(G.out_degree(weight=weight))

        # # Print graph
        # print("New graph:")
        # # Print nodes with data
        # for node in new_graph.nodes(data=True):
        #     print(node)

        # for edge in new_graph.edges(data=True):
        #     print(edge)

        # Create new communities object
        # new_communities = Communities(self.origin_graph, new_graph, self.get_communities())
        # return new_communities

    #########################################################
    # Node Getter
    #########################################################

    def get_community_of_node(self, node: str) -> Community:
        return self.node_to_community[node]

    # def get_community_of_hypernode(self, hypernode: str) -> HyperNode:
    def get_hypernode_of_node(self, hypernode: str) -> HyperNode:
        return self.node_to_hypernode[hypernode]

    def get_community_of_hypernode(self, hypernode: HyperNode) -> Community:
        return hypernode.community

    def get_hypernode_from_hypernode_id(self, hypernode_id: str) -> HyperNode:
        return self.hypernode_id_to_hypernode[hypernode_id]

    def get_community_of_hypernode_id(self, hypernode_id: str) -> Community:
        return self.get_hypernode_from_hypernode_id(hypernode_id).community

    # # Allow subscript access to the class
    # def __getitem__(self, node: str) -> int:
    #     return self.hypernode_to_community_index[node]

    def get_communities(self) -> list[Community]:
        # return [c for c in self.communities if c and len(c) > 0]
        return [c for c in self.communities if not c.is_empty()]

    def get_current_hypernodes(self) -> list[HyperNode]:
        # return [c for c in self.hypernodes if c and len(c) > 0]
        return [hn for hn in self.hypernodes if not hn.is_empty()]

    # def get_community_of_node(self, node: str) -> int:
    #     return self.hypernode_to_community_index[node]

    def get_community_hypernodes(self, community: int) -> set[str]:
        return self.hypernodes[community]

    def get_community_nodes(self, community: int) -> set[str]:
        return self.communities[community]

    def out_degree_of_hypernode(self, node: str) -> int:
        return self.hypernode_out_degrees.get(node, 0)

    def in_degree_of_hypernode(self, node: str) -> int:
        return self.hypernode_in_degrees.get(node, 0)

    def get_total_in_of_community(self, community: int) -> int:
        return self.community_total_in_degrees[community]

    def get_total_out_of_community(self, community: int) -> int:
        return self.community_total_out_degrees[community]

    def get_expected_out_edges_prob_from_node_to_community(self, node: str, community: int, resolution: float = 1):
        return self.out_degree_of_hypernode(node) * self.get_total_in_of_community(community) / self.total_edge_count

    def get_expected_in_edges_prob_from_community_to_node(self, node: str, community: int, resolution: float = 1):
        return self.in_degree_of_hypernode(node) * self.get_total_out_of_community(community) / self.total_edge_count

    def get_expected_total_edges_prob_of_node_to_community(self, node: str, community: int, resolution: float = 1):
        out_pro = self.get_expected_out_edges_prob_from_node_to_community(node, community, resolution)
        in_prob = self.get_expected_in_edges_prob_from_community_to_node(node, community, resolution)

        return out_pro + in_prob

    # @lru_cache
    def get_weights_from_community_to_other_communities(self, node: str):
        weights_to_neighbor_communities = defaultdict(float)
        for neighbor_node, weight in self.neighbor_weights[node].items():
            neighbor_community = self[neighbor_node]
            weights_to_neighbor_communities[neighbor_community] += weight
        return weights_to_neighbor_communities

    def get_weight_from_node_to_community(self, node: str, community: int):
        nodes_in_community = self.communities[community]

        weight = 0

        for other_node in nodes_in_community:
            # Check if there is an edge between the nodes in the original graph
            if self.origin_graph.has_edge(node, other_node):
                weight += self.origin_graph[node][other_node].get("weight", 1)
            if self.origin_graph.has_edge(other_node, node):
                weight += self.origin_graph[other_node][node].get("weight", 1)

        # return self.neighbor_weights[node].get(community, 0)
        return weight

    def get_neighbor_communities(self, node: str):
        return self.get_weights_from_community_to_other_communities(node).keys()

    #########################################################
    # ACTIONS #
    #########################################################

    def remove_hypernode_from_its_current_community(self, node: str, resolution: float = 1.0) -> float:
        """Remove the node from its current community and return the removal costs.

        Parameters
        ----------
        node : str
            The node to remove from its current community
        """
        current_community = self[node]

        in_degree = self.in_degree_of_hypernode(node)
        out_degree = self.out_degree_of_hypernode(node)

        self.community_total_in_degrees[current_community] -= in_degree
        self.community_total_out_degrees[current_community] -= out_degree

        comm_weights = self.get_weights_from_community_to_other_communities(node)

        nodes_contribution_to_current_community = comm_weights[current_community]
        # expected_outgoing_prob = self.get_expected_out_edges_prob_from_node_to_community(node, current_community, resolution)
        # expected_incoming_prob = self.get_expected_in_edges_prob_from_community_to_node(node, current_community, resolution)
        expected_total_prob = self.get_expected_total_edges_prob_of_node_to_community(node, current_community, resolution)

        remove_mod_cost = (-nodes_contribution_to_current_community + expected_total_prob) / self.m

        nodes_in_community = self.G.nodes[node].get("nodes", {node})
        self.communities[current_community].difference_update(nodes_in_community)
        self.hypernodes[current_community].remove(node)

        self.hypernode_to_community_index[node] = -1

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
        in_degree = self.in_degree_of_hypernode(node)
        out_degree = self.out_degree_of_hypernode(node)

        self.community_total_in_degrees[community] += in_degree
        self.community_total_out_degrees[community] += out_degree

        # Update the global partition and the inner partition
        self.communities[community].update(nodes_in_community)
        self.hypernodes[community].add(node)

        # Update the node to community index
        self.hypernode_to_community_index[node] = community


class CommGraphCommunityDetector:
    def __init__(self, graph: nx.MultiDiGraph) -> None:
        self.graph = graph

        self.weighted_node_graph = convert_to_weighted_graph(graph)
        self.topic_graph = convert_node_connections_graph_to_topic_graph(graph)
        # self.communities = Communities(self.weighted_node_graph, self.weighted_node_graph, [{n} for n in self.weighted_node_graph.nodes()])
        self.communities = Communities(self.weighted_node_graph)

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

        mod = modularity(self.weighted_node_graph, self.communities.get_communities_as_sets(), weight=weight, resolution=resolution)

        print(f"Start mod: {mod}")

        # Louvain as comparison
        communities = nx.algorithms.community.louvain_communities(self.weighted_node_graph)
        print(f"Louvain: {communities}")

        while True:
            # Create the new graph according to the current hyper communities
            # self.communities = self.communities.generate_new_hypernode_graph()
            self.communities.generate_new_hypernode_graph()

            # Iterate a step to get the new improved communities
            global_communities, inner_communities, improved = self._iterate_one_level()

            new_mod = modularity(self.weighted_node_graph, self.communities.get_communities_as_sets(), weight=weight, resolution=resolution)

            if new_mod - mod < threshold:
                print(f"End mod: {new_mod}")
                break

            mod = new_mod

            if not improved:
                print(f"Did not improve End mod: {mod}")
                break

        return global_communities

    def _iterate_one_level(self) -> None:
        G = self.communities.hyper_graph

        communities = self.communities

        # Take a random order of the nodes
        random_hypernodes = list(G.nodes)
        random.seed(42)
        random.shuffle(random_hypernodes)

        moved_nodes = 1
        improved = False

        # Repeat until no nodes have been moved
        while moved_nodes > 0:
            moved_nodes = 0

            # Iterate over all nodes
            for hypernode_id in random_hypernodes:
                hypernode = self.communities.hypernode_id_to_hypernode[hypernode_id]

                best_gain = 0
                current_community = hypernode.community
                # current_community_index = communities[hypernode_id]
                best_community = current_community

                # First remove the node from its current community and get the removal cost
                remove_cost = hypernode.remove_from_current_community()
                # remove_cost = communities.remove_hypernode_from_its_current_community(hypernode_id)

                # Now for each neighbor community check the gain of adding the node to the community
                for new_community in hypernode.get_neighbor_communities():
                    # for new_community in communities.get_neighbor_communities(hypernode_id):
                    # gain = communities.get_gain_for_adding_node_to_community(hypernode_id, new_community)
                    gain = hypernode.get_gain_for_adding_to_community(new_community)
                    total_gain = remove_cost + gain
                    if total_gain > best_gain:
                        best_gain = total_gain
                        best_community = new_community

                    # Check the connections to the old and the new community
                    # print(f"Current communities: {communities.get_global_communities()}")

                    # nodes = communities.graph.nodes[node].get("nodes", {node})
                    # weights = communities.get_weights_from_community_to_other_communities(node)
                    # current_comm_connections = weights[current_community]
                    # new_comm_connections = weights[new_community]
                    # x = 5

                # Add the node to the best community
                hypernode.add_to_community(best_community)
                # communities.add_node_to_community(hypernode_id, best_community)

                # If the best community is not the current community, move the node
                if best_community != current_community:
                    moved_nodes += 1
                    improved = True

        # # Now we check for each community pair, if there is a node, that can be duplicated to improve modularity
        # for hypernode_id in G.nodes():
        #     current_community_index = communities[hypernode_id]

        #     hyper_comms = communities.hypernodes
        #     for i, other_community in enumerate(hyper_comms):
        #         if i == current_community_index:
        #             continue
        #         if len(other_community) == 0:
        #             continue

        #         # Check if there are nodes that can be moved from one community to the other
        #         comm = communities.get_community_nodes(current_community_index)
        #         other_comm = communities.get_community_nodes(i)
        #         for hypernode_id in comm:
        #             node_to_comm_connection_weight = communities.get_weight_from_node_to_community(hypernode_id, i)
        #             if node_to_comm_connection_weight >= 2:
        #                 x = 5
        #             # Check if the node can be moved to the other community
        #             # gain = communities.get_gain_for_adding_node_to_community(node, i)

        # Filter out empty communities
        global_communities = communities.get_communities()
        inner_communities = communities.get_current_hypernodes()

        print(f"Global communities:")
        for c in global_communities:
            print(c)

        return global_communities, inner_communities, improved
