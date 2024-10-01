from __future__ import annotations

import random
from collections import defaultdict
from functools import lru_cache

import networkx as nx
from networkx.algorithms.community import modularity

from commgraph_backend.commgraph.converter import convert_node_connections_graph_to_topic_graph, convert_to_weighted_graph


class Community:
    def __init__(self, nodes: set[str] = None) -> None:
        """
        Initialize a Community.

        Parameters
        ----------
        nodes : set[str], optional
            A set of node identifiers that belong to this community. Default is an empty set.
        """
        self.nodes = nodes or set()
        self.hypermodes: list[HyperNode] = []
        self.total_in_degree = 0
        self.total_out_degree = 0

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
        self.hyper_graph: nx.DiGraph = origin_graph
        G = self.hyper_graph

        self.node_to_community: dict[str, Community] = {n: Community({n}) for n in G.nodes()}
        self.communities: list[Community] = list(self.node_to_community.values())
        self.node_to_hypernode: dict[str, HyperNode] = {n: HyperNode(n, self, self.node_to_community[n]) for n in self.origin_graph.nodes()}
        self.hypernode_id_to_hypernode: dict[str, HyperNode] = dict(self.node_to_hypernode)
        self.hypernodes = list(self.node_to_hypernode.values())

        self.total_edge_count = self.origin_graph.size(weight=weight)

    def get_communities_as_sets(self) -> list[set[str]]:
        """
        Get the communities as sets of nodes.

        Returns
        -------
        list of set of str
            A list of sets, each containing the nodes of a community.
        """
        return [c.nodes for c in self.communities]

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

class CommGraphCommunityDetector:
    def __init__(self, graph: nx.MultiDiGraph) -> None:
        self.graph = graph

        self.weighted_node_graph = convert_to_weighted_graph(graph)
        self.topic_graph = convert_node_connections_graph_to_topic_graph(graph)
        self.communities = Communities(self.weighted_node_graph)

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

                # Now for each neighbor community check the gain of adding the node to the community
                for new_community in hypernode.get_neighbor_communities():
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
