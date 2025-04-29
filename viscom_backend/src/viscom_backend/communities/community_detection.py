from __future__ import annotations

import math
import random
from collections import defaultdict
from functools import lru_cache

import networkx as nx
from networkx.algorithms.community import modularity

from viscom_backend.commgraph.converter import convert_node_connections_graph_to_topic_graph, convert_to_weighted_graph


class Community:
    def __init__(self, communities: Communities, nodes: set[str] = None) -> None:
        """
        Initialize a Community.

        Parameters
        ----------
        nodes : set[str], optional
            A set of node identifiers that belong to this community. Default is an empty set.
        """
        self.nodes = nodes or set()
        self.communities = communities

        self.total_in_degree = 0
        self.total_out_degree = 0

    @property
    def origin_nodes(self) -> set[str]:
        """
        Get the original nodes of the community.

        Returns
        -------
        set of str
            The original nodes of the community.
        """
        return {self.communities.splitted_nodes_to_original_nodes.get(n, n) for n in self.nodes}

    def is_empty(self) -> bool:
        """
        Check if the community is empty.

        Returns
        -------
        bool
            True if the community has no nodes, False otherwise.
        """
        return len(self.nodes) == 0

    def __repr__(self) -> str:
        return f"Community ({len(self.nodes)}) [{self.nodes}]"

    def __str__(self) -> str:
        return self.__repr__()

    def get_edge_nodes(self) -> set[str]:
        """Returns nodes that are connected to nodes outside the community"""

        edge_nodes = set()
        for node in self.nodes:
            for neighbor in self.communities.origin_graph.successors(node):
                if neighbor not in self.nodes:
                    edge_nodes.add(node)
                    break
            for neighbor in self.communities.origin_graph.predecessors(node):
                if neighbor not in self.nodes:
                    edge_nodes.add(node)
                    break

        return edge_nodes


class HyperNode:
    def __init__(self, hypernode_id: str | int, communities: Communities, community: Community) -> None:
        """
        Initialize a HyperNode.

        Parameters
        ----------
        hypernode_id : str or int
            The identifier for the hypernode.
        communities : Communities
            The Communities object to which this hypernode belongs.
        community : Community
            The initial community of this hypernode.
        """
        self.community: Community = community
        self.hypernode_id = hypernode_id
        self.communities = communities
        self.nodes = list(community.nodes)
        self.total_in_degree = 0
        self.total_out_degree = 0
        self.weights_to_other_hypernodes: dict[str, float] = defaultdict(float)

    @property
    def G(self):
        """
        Get the hyper graph.

        Returns
        -------
        nx.DiGraph
            The hyper graph.
        """
        return self.communities.hyper_graph

    @property
    def m(self):
        """
        Get the total edge count of the original graph.

        Returns
        -------
        float
            The total edge count.
        """
        return self.communities.m

    def init(self, weight="weight"):
        """
        Initialize the hypernode by setting up degrees and weights.

        Parameters
        ----------
        weight : str, optional
            The edge attribute to use as weight. Default is "weight".
        """
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

        # If there are multiple nodes in the hypernode, that have been splitted from
        # the same original node, we merge them to one node
        splitted_node_occurrences: dict[str, list[str]] = dict()
        for node in self.nodes:
            original_node = self.communities.splitted_nodes_to_original_nodes.get(node, node)
            if original_node not in splitted_node_occurrences:
                splitted_node_occurrences[original_node] = []
            splitted_node_occurrences.get(original_node).append(node)

        for original_node, occurrences in splitted_node_occurrences.items():
            if len(occurrences) > 1:
                keep_node = original_node if original_node in occurrences else occurrences[0]
                other_nodes = [n for n in occurrences if n != keep_node]
                origin_G = self.communities.origin_graph

                # For all other nodes, we add the weights to the keep node
                # and remove the node from the hypernode and the graph
                for node_to_remove in other_nodes:
                    print(f"[MERGING] {node_to_remove} to {keep_node}")
                    for start_node, target_node, connection_data in origin_G.out_edges(node_to_remove, data=True):
                        if start_node == target_node:
                            continue

                        weight = connection_data.get("weight", 1)
                        if origin_G.has_edge(keep_node, target_node):
                            origin_G[keep_node][target_node]["weight"] += weight
                        else:
                            origin_G.add_edge(keep_node, target_node, weight=weight)

                    for start_node, target_node, connection_data in origin_G.in_edges(node_to_remove, data=True):
                        if start_node == target_node:
                            continue

                        weight = connection_data.get("weight", 1)
                        if origin_G.has_edge(target_node, keep_node):
                            origin_G[target_node][keep_node]["weight"] += weight
                        else:
                            origin_G.add_edge(target_node, keep_node, weight=weight)

                    self.communities.remove_node(node_to_remove)
                    # self.nodes.remove(node_to_remove)
                    # self.communities.get_community_of_node(node_to_remove).nodes.remove(node_to_remove)
                    # origin_G.remove_node(node_to_remove)

    def __repr__(self) -> str:
        return f"HyperNode {self.hypernode_id} ({len(self.nodes)}) [{self.nodes}]"

    def __str__(self) -> str:
        return self.__repr__()

    def is_empty(self) -> bool:
        """
        Check if the hypernode is empty.

        Returns
        -------
        bool
            True if the hypernode has no nodes, False otherwise.
        """
        return len(self.nodes) == 0

    def get_neighbor_communities(self) -> list[Community]:
        """
        Get the neighboring communities of the hypernode.

        Returns
        -------
        list of Community
            A list of neighboring communities.
        """
        return list(self.get_weights_to_communities().keys())

    def get_weight_to_hypernode(self, hypernode: str) -> float:
        """
        Get the weight to another hypernode.

        Parameters
        ----------
        hypernode : str
            The identifier of the other hypernode.

        Returns
        -------
        float
            The weight to the other hypernode.
        """
        return self.weights_to_other_hypernodes.get(hypernode, 0)

    def get_expected_out_edges_prob_to_community(self, community: Community, resolution: float = 1) -> float:
        """
        Get the expected probability of outgoing edges to a community.

        Parameters
        ----------
        community : Community
            The target community.
        resolution : float, optional
            The resolution parameter. Default is 1.

        Returns
        -------
        float
            The expected probability of outgoing edges to the community.
        """
        return resolution * (self.total_out_degree * community.total_in_degree / self.communities.m)

    def get_expected_in_edges_prob_from_community(self, community: Community, resolution: float = 1) -> float:
        """
        Get the expected probability of incoming edges from a community.

        Parameters
        ----------
        community : Community
            The target community.
        resolution : float, optional
            The resolution parameter. Default is 1.

        Returns
        -------
        float
            The expected probability of incoming edges from the community.
        """
        return resolution * (self.total_in_degree * community.total_out_degree / self.communities.m)

    def get_expected_total_edges_prob_to_community(self, community: Community, resolution: float = 1) -> float:
        """
        Get the expected total probability of edges to a community.

        Parameters
        ----------
        community : Community
            The target community.
        resolution : float, optional
            The resolution parameter. Default is 1.

        Returns
        -------
        float
            The expected total probability of edges to the community.
        """
        out_prob = self.get_expected_out_edges_prob_to_community(community, resolution)
        in_prob = self.get_expected_in_edges_prob_from_community(community, resolution)

        return out_prob + in_prob

    def get_weights_to_communities(self) -> dict[Community, float]:
        """
        Get the weights to neighboring communities.

        Returns
        -------
        dict of Community to float
            A dictionary mapping neighboring communities to their respective weights.
        """
        weights_to_communities = defaultdict(float)

        for other_hypernode_id, weight in self.weights_to_other_hypernodes.items():
            neighbor_community = self.communities.get_community_of_hypernode_id(other_hypernode_id)
            weights_to_communities[neighbor_community] += weight
        return weights_to_communities

    def remove_from_current_community(self, resolution: float = 1.0) -> float:
        """
        Remove the hypernode from its current community and return the removal costs.

        Parameters
        ----------
        resolution : float, optional
            The resolution parameter. Default is 1.0.

        Returns
        -------
        float
            The modularity cost of removing the hypernode from its current community.
        """
        comm = self.community

        in_degree = self.total_in_degree
        out_degree = self.total_out_degree

        comm.total_in_degree -= in_degree
        comm.total_out_degree -= out_degree

        comm_weights = self.weights_to_other_hypernodes
        comm_weights = self.get_weights_to_communities()

        nodes_contribution_to_current_community = comm_weights[comm]
        expected_total_prob = self.get_expected_total_edges_prob_to_community(comm, resolution)

        remove_mod_cost = (-nodes_contribution_to_current_community + expected_total_prob) / self.m

        comm.nodes.difference_update(self.nodes)
        self.community = None

        return remove_mod_cost

    def get_gain_for_adding_to_community(self, community: Community, resolution: float = 1.0) -> float:
        """
        Get the modularity gain for adding the hypernode to a community.

        Parameters
        ----------
        community : Community
            The target community.
        resolution : float, optional
            The resolution parameter. Default is 1.0.

        Returns
        -------
        float
            The modularity gain for adding the hypernode to the community.
        """
        weights_to_neighbor_communities = self.get_weights_to_communities()
        weight_to_community = weights_to_neighbor_communities[community]
        expected_total_prob = self.get_expected_total_edges_prob_to_community(community, resolution)
        gain = (weight_to_community - expected_total_prob) / self.m
        return gain

    def get_edges_to_community(self, community: Community) -> list[tuple[str, str, int]]:
        """
        Get the edges to a community.

        Parameters
        ----------
        community : Community
            The target community.

        Returns
        -------
        list of tuple of str
            A list of tuples, each containing the start node, target node, and weight of an edge to the community.
        """
        edges: list[tuple[str, str, int]] = []
        for start_node, target_node, connection_data in self.G.out_edges(self.hypernode_id, data=True):
            if start_node == target_node:
                continue

            weight = connection_data.get("weight", 1)
            if self.communities.get_community_of_hypernode_id(target_node) == community:
                edges.append((start_node, target_node, weight))

        for start_node, target_node, connection_data in self.G.in_edges(self.hypernode_id, data=True):
            if start_node == target_node:
                continue

            weight = connection_data.get("weight", 1)
            if self.communities.get_community_of_hypernode_id(start_node) == community:
                edges.append((start_node, target_node, weight))

        return edges

    def get_gain_for_splitting_node_to_communities(self, community1: Community, community2: Community, resolution: float = 1.0, splitting_penalty=1.0) -> float:
        """
        Get the modularity gain for adding the hypernode to a community.

        Parameters
        ----------
        community : Community
            The target community.
        resolution : float, optional
            The resolution parameter. Default is 1.0.

        Returns
        -------
        float
            The modularity gain for adding the hypernode to the community.
        """
        weights_to_neighbor_communities = self.get_weights_to_communities()
        weight_to_community1 = weights_to_neighbor_communities[community1]
        weight_to_community2 = weights_to_neighbor_communities[community2]

        edges_to_community1 = self.get_edges_to_community(community1)
        edges_to_community2 = self.get_edges_to_community(community2)

        expected_total_prob1 = self.get_expected_total_edges_prob_to_community(community1, resolution)
        expected_total_prob2 = self.get_expected_total_edges_prob_to_community(community2, resolution)

        expected_total_prob1 = 0
        expected_total_prob2 = 0

        weight_to_communities = weight_to_community1 + weight_to_community2
        expected_total_prob = expected_total_prob1 + expected_total_prob2
        gain = (weight_to_communities - splitting_penalty - expected_total_prob) / self.m
        return gain

    def add_to_community(self, community: Community) -> None:
        """
        Add the hypernode to a community.

        Parameters
        ----------
        community : Community
            The target community.
        """
        community.total_in_degree += self.total_in_degree
        community.total_out_degree += self.total_out_degree
        community.nodes.update(self.nodes)
        community.communities.node_to_community.update({n: community for n in self.nodes})
        self.community = community


class Communities:
    def __init__(self, origin_graph: nx.MultiDiGraph, weight="weight") -> None:
        """
        Initialize Communities.

        Parameters
        ----------
        origin_graph : nx.MultiDiGraph
            The original graph with connections between single nodes.
        weight : str, optional
            The edge attribute to use as weight. Default is "weight".
        """
        self.origin_graph = origin_graph

        # The current graph with hyper nodes
        self.hyper_graph: nx.DiGraph = self.origin_graph
        G = self.hyper_graph

        self.node_to_community: dict[str, Community] = {n: Community(self, {n}) for n in G.nodes()}
        self.communities: list[Community] = list(self.node_to_community.values())
        self.node_to_hypernode: dict[str, HyperNode] = {n: HyperNode(n, self, self.node_to_community[n]) for n in self.origin_graph.nodes()}
        self.hypernode_id_to_hypernode: dict[str, HyperNode] = dict(self.node_to_hypernode)
        self.hypernodes = list(self.node_to_hypernode.values())

        self.total_edge_count = self.origin_graph.size(weight=weight)

        self.splitted_nodes_to_original_nodes: dict[str, str] = dict()

    def remove_node(self, node: str) -> None:
        """
        Remove a node from the graph and the community tracking.

        Parameters
        ----------
        node : str
            The node identifier.
        """

        if node in self.node_to_community:
            comm_of_node = self.node_to_community[node]
            if node in comm_of_node.nodes:
                comm_of_node.nodes.remove(node)

        if node in self.node_to_hypernode:
            hypernode = self.node_to_hypernode[node]
            if node in hypernode.nodes:
                hypernode.nodes.remove(node)

        self.origin_graph.remove_node(node)
        self.node_to_community.pop(node, None)
        self.node_to_hypernode.pop(node, None)

        self.splitted_nodes_to_original_nodes.pop(node, None)

    def add_node(self, node: str, community: Community, hypernode: HyperNode) -> None:
        """
        Add a node to the graph and the community tracking.

        Parameters
        ----------
        node : str
            The node identifier.
        community : Community
            The community to which the node belongs.
        hypernode : HyperNode
            The hypernode to which the node belongs.
        """

        if node not in community.nodes:
            community.nodes.add(node)
        if node not in hypernode.nodes:
            hypernode.nodes.append(node)

        self.node_to_community[node] = community
        self.node_to_hypernode[node] = hypernode

    def get_communities_as_sets(self) -> list[set[str]]:
        """
        Get the communities as sets of nodes.

        Returns
        -------
        list of set of str
            A list of sets, each containing the nodes of a community.
        """
        return [c.nodes for c in self.communities if not c.is_empty()]

    @property
    def m(self) -> float:
        """
        Get the total edge count of the original graph.

        Returns
        -------
        float
            The total edge count.
        """
        return self.total_edge_count

    def generate_new_hypernode_graph(self) -> Communities:
        """
        Update the current graph according to the current hyper communities.

        Returns
        -------
        Communities
            The updated Communities object.
        """
        new_graph = nx.DiGraph()

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

        # Add the edges between the hyper nodes based on the current graph
        for hypernode_s, hypernode_t, connection_data in self.hyper_graph.edges(data=True):
            weight = connection_data.get("weight", 1)

            start_community = old_hypernode_id_to_community[hypernode_s]
            target_community = old_hypernode_id_to_community[hypernode_t]

            start_i_in_new_graph = community_to_new_hypernode_id[start_community]
            target_i_in_new_graph = community_to_new_hypernode_id[target_community]

            current_weight = new_graph.get_edge_data(start_i_in_new_graph, target_i_in_new_graph, default={"weight": 0})["weight"]
            new_weight = current_weight + weight
            new_graph.add_edge(start_i_in_new_graph, target_i_in_new_graph, weight=new_weight)

        # Set new hyper graph and nodes and initialize all
        self.hyper_graph = G = new_graph
        self.hypernodes = new_hypernodes
        self.node_to_hypernode.clear()
        self.hypernode_id_to_hypernode.clear()
        for hypernode in new_hypernodes:
            hypernode.init()

        self.hypernode_in_degrees = dict(G.in_degree(weight=weight))
        self.hypernode_out_degrees = dict(G.out_degree(weight=weight))

    #########################################################
    # Getter
    #########################################################

    def get_community_of_node(self, node: str) -> Community:
        """
        Get the community of a node.

        Parameters
        ----------
        node : str
            The node identifier.

        Returns
        -------
        Community
            The community to which the node belongs.
        """
        return self.node_to_community[node]

    def get_hypernode_of_node(self, hypernode: str) -> HyperNode:
        """
        Get the hypernode of a node.

        Parameters
        ----------
        hypernode : str
            The hypernode identifier.

        Returns
        -------
        HyperNode
            The hypernode to which the node belongs.
        """
        return self.node_to_hypernode[hypernode]

    def get_community_of_hypernode(self, hypernode: HyperNode) -> Community:
        """
        Get the community of a hypernode.

        Parameters
        ----------
        hypernode : HyperNode
            The hypernode object.

        Returns
        -------
        Community
            The community to which the hypernode belongs.
        """
        return hypernode.community

    def get_hypernode_from_hypernode_id(self, hypernode_id: str) -> HyperNode:
        """
        Get the hypernode from its identifier.

        Parameters
        ----------
        hypernode_id : str
            The hypernode identifier.

        Returns
        -------
        HyperNode
            The hypernode object.
        """
        return self.hypernode_id_to_hypernode[hypernode_id]

    def get_community_of_hypernode_id(self, hypernode_id: str) -> Community:
        """
        Get the community of a hypernode by its identifier.

        Parameters
        ----------
        hypernode_id : str
            The hypernode identifier.

        Returns
        -------
        Community
            The community to which the hypernode belongs.
        """
        return self.get_hypernode_from_hypernode_id(hypernode_id).community

    def get_communities(self) -> list[Community]:
        """
        Get all non-empty communities.

        Returns
        -------
        list of Community
            A list of non-empty communities.
        """
        return [c for c in self.communities if not c.is_empty()]

    def get_current_hypernodes(self) -> list[HyperNode]:
        """
        Get all non-empty hypernodes.

        Returns
        -------
        list of HyperNode
            A list of non-empty hypernodes.
        """
        return [hn for hn in self.hypernodes if not hn.is_empty()]

    def get_weight_from_node_to_community(self, node: str, community: Community) -> float:
        """
        Get the weight from a node to a community.

        Parameters
        ----------
        node : str
            The node identifier.
        community : Community
            The target community.

        Returns
        -------
        float
            The weight from the node to the community.
        """

        weight = 0
        for other_node in community.nodes:
            if self.origin_graph.has_edge(node, other_node):
                weight += self.origin_graph[node][other_node].get("weight", 1)
            if self.origin_graph.has_edge(other_node, node):
                weight += self.origin_graph[other_node][node].get("weight", 1)

        return weight

    def split_node_to_communities(self, node: str, community1: Community, community2: Community, penalty=1.0) -> None:
        """
        Split a node to two communities.

        Parameters
        ----------
        node : str
            The node identifier.
        community1 : Community
            The first community.
        community2 : Community
            The second community.
        penalty : float, optional
            The penalty for splitting the node. Default is 1.0.
        """

        before_weight = self.origin_graph.size(weight="weight")
        before_weight_hyper = self.hyper_graph.size(weight="weight")

        # Get initial information
        current_hypernode = self.node_to_hypernode[node]
        current_community = current_hypernode.community
        other_community = community1 if current_hypernode.community == community2 else community2

        # Create new nodes for the node to split
        counter = 0
        split_node = f"{node}__split_{counter}"
        while split_node in self.origin_graph.nodes():
            counter += 1
            split_node = f"{node}__split_{counter}"

        split_hypernode = HyperNode(split_node, self, other_community)
        split_hypernode.nodes = [split_node]

        # Add the node to the map of splitted nodes
        original_node = self.splitted_nodes_to_original_nodes.get(node, node)
        self.splitted_nodes_to_original_nodes[split_node] = original_node

        # Add penalty edges to the new split node
        self.origin_graph.add_edge(node, split_node, weight=penalty / 2)
        self.origin_graph.add_edge(split_node, node, weight=penalty / 2)

        # Add penalty edges to the new split hyper node
        self.hyper_graph.add_edge(current_hypernode.hypernode_id, split_node, weight=penalty / 2)
        self.hyper_graph.add_edge(split_node, current_hypernode.hypernode_id, weight=penalty / 2)

        # Check edges in original graph between nodes of other community and the node to split
        # Add these edges to the new split node and remove them from the old node
        # Also store the sum of these weights as in and out weights for the hypenode connections
        weights_from_node_to_hypernodes: dict[str, float] = defaultdict(float)
        weights_from_hypernodes_to_node: dict[str, float] = defaultdict(float)

        for other_node in other_community.nodes:
            if self.origin_graph.has_edge(other_node, node):
                weight = self.origin_graph[other_node][node].get("weight", 1)
                self.origin_graph.add_edge(other_node, split_node, weight=weight)
                self.origin_graph.remove_edge(other_node, node)

                hypernode = self.node_to_hypernode[other_node]
                weights_from_hypernodes_to_node[hypernode.hypernode_id] += weight

            if self.origin_graph.has_edge(node, other_node):
                weight = self.origin_graph[node][other_node].get("weight", 1)
                self.origin_graph.add_edge(split_node, other_node, weight=weight)
                self.origin_graph.remove_edge(node, other_node)

                hypernode = self.node_to_hypernode[other_node]
                weights_from_node_to_hypernodes[hypernode.hypernode_id] += weight

        # Add the weights to the new split hyper node and remove (or lower) them from the old hyper node
        for hypernode_id, weight in weights_from_node_to_hypernodes.items():
            self.hyper_graph.add_edge(split_node, hypernode_id, weight=weight)

            # Get current weight of existing edge
            existing_weight = self.hyper_graph[current_hypernode.hypernode_id][hypernode_id].get("weight", 0)
            if existing_weight > weight:
                self.hyper_graph[current_hypernode.hypernode_id][hypernode_id]["weight"] -= weight
            else:
                self.hyper_graph.remove_edge(current_hypernode.hypernode_id, hypernode_id)

        for hypernode_id, weight in weights_from_hypernodes_to_node.items():
            self.hyper_graph.add_edge(hypernode_id, split_node, weight=weight)

            # Get current weight of existing edge
            existing_weight = self.hyper_graph[hypernode_id][current_hypernode.hypernode_id].get("weight", 0)
            if existing_weight > weight:
                self.hyper_graph[hypernode_id][current_hypernode.hypernode_id]["weight"] -= weight
            else:
                self.hyper_graph.remove_edge(hypernode_id, current_hypernode.hypernode_id)

        after_weight = self.origin_graph.size(weight="weight")
        after_weight_hyper = self.hyper_graph.size(weight="weight")

        diff = after_weight - (before_weight + penalty)
        diff_hyper = after_weight_hyper - (before_weight_hyper + penalty)

        assert math.isclose(diff, 0, abs_tol=1e-6)
        assert math.isclose(diff_hyper, 0, abs_tol=1e-6)

        # Init new hyper node and add it
        split_hypernode.init()
        self.hypernodes.append(split_hypernode)
        # # Add new node to the other community
        # other_community.nodes.add(split_node)
        self.add_node(split_node, community=other_community, hypernode=split_hypernode)


class CommGraphCommunityDetector:

    @staticmethod
    def detect_communities(graph: nx.MultiDiGraph, split_penalty=1.5, weight="weight", resolution=1, threshold=0.0000001, seed=None) -> list[set[str]]:
        detector = CommGraphCommunityDetector(graph)
        comms = detector.calculate_commgraph_communities(split_penalty=split_penalty, weight=weight, resolution=resolution, threshold=threshold, seed=seed)
        return comms

    def __init__(self, graph: nx.MultiDiGraph) -> None:
        self.graph = graph

        self.weighted_node_graph = self._convert_multigraph(convert_to_weighted_graph(graph))
        self.topic_graph = convert_node_connections_graph_to_topic_graph(graph)
        self.communities = Communities(self.weighted_node_graph)

    def _convert_multigraph(self, G: nx.MultiDiGraph, weight="weight"):
        """Convert a Multigraph to normal Graph"""
        H = nx.DiGraph() if G.is_directed() else nx.Graph()
        H.add_nodes_from(G)
        for u, v, wt in G.edges(data=weight, default=1):
            if H.has_edge(u, v):
                H[u][v][weight] += wt
            else:
                H.add_edge(u, v, weight=wt)
        return H

    def calculate_commgraph_communities(self, split_penalty: float = 1.5, weight="weight", resolution=1, threshold=0.0000001, seed=None) -> list[set[str]]:
        """
        Get communities from a graph using a adapted Louvain algorithm
        """

        mod = modularity(self.weighted_node_graph, self.communities.get_communities_as_sets(), weight=weight, resolution=resolution)

        print(f"Start mod: {mod}")

        # Louvain as comparison
        communities = nx.algorithms.community.louvain_communities(self.weighted_node_graph)
        print(f"Louvain:")
        for c in communities:
            print(c)

        while True:
            # Create the new graph according to the current hyper communities
            self.communities.generate_new_hypernode_graph()

            # Iterate a step to get the new improved communities
            global_communities, inner_communities, improved = self._iterate_one_level(split_penalty)

            new_mod = modularity(self.weighted_node_graph, self.communities.get_communities_as_sets(), weight=weight, resolution=resolution)

            if new_mod - mod < threshold:
                print(f"End mod: {new_mod}")
                break

            mod = new_mod

            if not improved:
                print(f"Did not improve End mod: {mod}")
                break

        return [c.origin_nodes for c in global_communities if not c.is_empty()]

    def _iterate_one_level(self, split_penalty=1.5) -> tuple[list[Community], list[HyperNode], bool]:
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

                # Now for each neighbor community check the gain of adding the node to the community
                for new_community in hypernode.get_neighbor_communities():
                    gain = hypernode.get_gain_for_adding_to_community(new_community)
                    total_gain = remove_cost + gain
                    if total_gain > best_gain:
                        best_gain = total_gain
                        best_community = new_community

                # Add the node to the best community
                hypernode.add_to_community(best_community)

                # If the best community is not the current community, move the node
                if best_community != current_community:
                    moved_nodes += 1
                    improved = True

        # Filter out empty communities
        global_communities = communities.get_communities()
        inner_communities = communities.get_current_hypernodes()

        for i, community in enumerate(global_communities):
            edge_nodes = community.get_edge_nodes()

            for node in edge_nodes:
                weight_from_node_to_community = communities.get_weight_from_node_to_community(node, community)

                for j, other_community in enumerate(global_communities):
                    if i == j:
                        continue

                    weight_from_node_to_other_community = communities.get_weight_from_node_to_community(node, other_community)

                    if weight_from_node_to_other_community - split_penalty > 0:
                        # Print all edges
                        # print(f"\n\nEdges from {node} to {community}: {weight_from_node_to_community}")
                        # for n in self.communities.origin_graph.nodes():
                        #     print("Edges from", n)
                        #     for neighbor in self.communities.origin_graph.successors(n):
                        #         try:
                        #             # w = self.communities.origin_graph[n][neighbor]["weight"]
                        #             w = self.communities.origin_graph.get_edge_data(n, neighbor)

                        #         except:
                        #             w = -1

                        #         print(f"  {neighbor}: {self.communities.origin_graph[n][neighbor]} ({w}) ")
                        #         # print(f"  {neighbor}: {self.communities.origin_graph[node][neighbor]['weight']}")

                        # print("Splitting node", node, "to", community, "and", other_community)
                        print("Splitting node", node, "having weight", weight_from_node_to_other_community)
                        weight_from_node_to_other_community = communities.get_weight_from_node_to_community(node, other_community)
                        communities.split_node_to_communities(node, community, other_community, penalty=split_penalty)

            if len(edge_nodes) > 0:
                x = 5

        # print(f"Global communities:")
        # for c in global_communities:
        #     print(c)

        return global_communities, inner_communities, improved
