from __future__ import annotations
from typing import Any, List, Dict, Set, TypeVar

from viscom_backend.commgraph.channel import CommunicationChannel, CommunicationDirection
from viscom_backend.commgraph.node import CommunicationNode
from ngraph.graph import createGraph, Graph

NodeData = TypeVar("NodeData")


class TopicToNodeMap:
    """Helper class representing a mapping of topics to nodes on a specific communication channel.

    Parameters
    ----------
    channel : CommunicationChannel
        The channel for all topics in this mapping.
    """

    def __init__(self, channel: CommunicationChannel) -> None:
        self.channel: CommunicationChannel = channel
        self.outgoing: dict[str, list[CommunicationNode[NodeData]]] = {}
        self.incoming: dict[str, list[CommunicationNode[NodeData]]] = {}
        self.bidirectional: dict[str, list[CommunicationNode[NodeData]]] = {}
        self.all: dict[str, list[CommunicationNode[NodeData]]] = {}

        self.directions: dict[CommunicationDirection, dict[str, list[CommunicationNode[NodeData]]]] = {
            "incoming": self.incoming,
            "outgoing": self.outgoing,
            "bidirectional": self.bidirectional,
        }


class CommunicationChannelGraphs:
    """Helper class representing the graphs on a communication channel.

    Parameters
    ----------
    channel : CommunicationChannel
        The channel for the graphs.
    """

    def __init__(self, channel: CommunicationChannel) -> None:
        self.channel: CommunicationChannel = channel
        self.outgoing: Graph[Any, ChannelGraphLinkData] = createGraph(multigraph=True)
        self.incoming: Graph[Any, ChannelGraphLinkData] = createGraph(multigraph=True)
        self.bidirectional: Graph[Any, ChannelGraphLinkData] = createGraph(multigraph=True)
        self.all: Graph[Any, ChannelGraphLinkData] = createGraph(multigraph=True)

        self.directions: dict[CommunicationDirection, Graph[Any, ChannelGraphLinkData]] = {
            "incoming": self.incoming,
            "outgoing": self.outgoing,
            "bidirectional": self.bidirectional,
        }

    def add_node(self, node: CommunicationNode) -> None:
        """Add a node to all graphs.

        Parameters
        ----------
        node : CommunicationNode
            The node to add.
        """
        self.outgoing.addNode(node.id, node)
        self.incoming.addNode(node.id, node)
        self.bidirectional.addNode(node.id, node)
        self.all.addNode(node.id, node)


class CommunicationGraphCommunity:
    """Class representing a communication graph community."""

    def __init__(self) -> None:
        self.node_ids: list[str] = []

    def node_is_in_community(self, node: str | CommunicationNode) -> bool:
        """Check if a node is part of the community.

        Parameters
        ----------
        node : str | CommunicationNode
            The node to check.

        Returns
        -------
        bool
            True if the node is part of the community, False otherwise.
        """
        node_id = CommunicationGraph.get_node_id(node)
        return node_id in self.node_ids


class CommunicationGraphCommunities:
    """Class representing communication graph communities."""

    def __init__(self) -> None:
        self.communities: list[CommunicationGraphCommunity] = []

    def get_communities_of_node(self, node: str | CommunicationNode | None = None) -> list[int]:
        """Get the communities of a node.

        Parameters
        ----------
        node : str | CommunicationNode, optional
            The node to check, by default None.

        Returns
        -------
        list[int]
            List of community indices where the node is present.
        """
        if node is None:
            return []
        node_id = CommunicationGraph.get_node_id(node)
        return [i for i, community in enumerate(self.communities) if community.node_is_in_community(node_id)]

    def set_communities_by_list(self, community_ids: list[list[str]]) -> None:
        """Set communities based on a list of community IDs.

        Parameters
        ----------
        community_ids : list[list[str]]
            List of node IDs representing each community.
        """
        self.communities = []
        for ids in community_ids:
            community = CommunicationGraphCommunity()
            community.node_ids = ids
            self.communities.append(community)


class CommunicationGraph:
    """Class representing a communication graph.

    Parameters
    ----------
    nodes : list[CommunicationNode[NodeData]]
        The nodes of the graph.
    channels : list[CommunicationChannel]
        The channels of the communication graph.
    """

    def __init__(self, nodes: list[CommunicationNode[NodeData]], channels: list[CommunicationChannel]) -> None:
        self.nodes: list[CommunicationNode[NodeData]] = []
        self.nodes_by_id: dict[str, CommunicationNode[NodeData]] = {}
        self.channels_by_type: dict[str, CommunicationChannel] = {}
        self.topic_to_node_maps_by_channel_type: dict[str, TopicToNodeMap[NodeData]] = {}
        self.graphs_by_channel_type: dict[str, CommunicationChannelGraphs] = {}
        self.communities: CommunicationGraphCommunities = CommunicationGraphCommunities()
        self.hidden_topics: list[re.Pattern] = []

        # Initialize channels and nodes
        for channel in channels:
            self.channels_by_type[channel.type] = channel
            self.topic_to_node_maps_by_channel_type[channel.type] = TopicToNodeMap(channel)

        self.add_nodes(nodes)

    def add_nodes(self, nodes: list[CommunicationNode[NodeData]]) -> None:
        """Add nodes to the communication graph.

        Parameters
        ----------
        nodes : list[CommunicationNode[NodeData]]
            The nodes to add.
        """
        for node in nodes:
            node.graph = self
            self.nodes.append(node)
            self.nodes_by_id[node.id] = node

            # Add node to the topic map of the channel type
            for topic in node.topics:
                channel_type = topic.channel.type
                topic_map = self.get_topic_to_node_map_by_channel_type(channel_type)
                directed_topic_map = topic_map.directions[topic.direction]
                if topic.id not in directed_topic_map:
                    directed_topic_map[topic.id] = []
                directed_topic_map[topic.id].append(node)

        self._update_links()

    def get_topic_to_node_map_by_channel_type(self, channel_type: str) -> TopicToNodeMap[NodeData]:
        """Get the topic-to-node map for a specific channel type.

        Parameters
        ----------
        channel_type : str
            The type of the channel.

        Returns
        -------
        TopicToNodeMap[NodeData]
            The topic-to-node map for the specified channel type.
        """
        self._check_if_channel_type_exists(channel_type)
        return self.topic_to_node_maps_by_channel_type[channel_type]

    def _check_if_channel_type_exists(self, channel_type: str) -> None:
        """Check if a channel type exists in the graph.

        Parameters
        ----------
        channel_type : str
            The type of the channel.

        Raises
        ------
        ValueError
            If the channel type does not exist.
        """
        if channel_type not in self.channels_by_type:
            raise ValueError(f"Channel type {channel_type} not found")

    def _update_links(self) -> None:
        """Update the links between nodes in the graph."""
        for channel in self.channels_by_type.values():
            self.graphs_by_channel_type[channel.type] = CommunicationChannelGraphs(channel)

        for node in self.nodes:
            for graph in self.graphs_by_channel_type.values():
                graph.add_node(node)

            # Add links between nodes
            for topic in node.topics:
                channel_type = topic.channel.type
                graphs = self.graphs_by_channel_type[channel_type]
                topic_map = self.get_topic_to_node_map_by_channel_type(channel_type)
                direction_topic_map = topic_map.directions[CommunicationDirectionPendant[topic.direction]].get(topic.id, [])

                for destination_node in direction_topic_map:
                    graphs[topic.direction].addLink(node.id, destination_node.id, ChannelGraphLinkData(topic, topic.channel))

    @staticmethod
    def get_node_id(node: str | CommunicationNode[Any]) -> str:
        """Get the ID of a node.

        Parameters
        ----------
        node : str | CommunicationNode[Any]
            The node.

        Returns
        -------
        str
            The ID of the node.
        """
        return node if isinstance(node, str) else node.id
