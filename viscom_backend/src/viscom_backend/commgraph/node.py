from __future__ import annotations
from typing import Any, List, Dict, Set, Union


class CommunicationNode:
    """Class representing a node in a communication graph.
    A node can have multiple topics on different communication channels.

    Parameters
    ----------
    id : str
        The id of the node.
    data : NodeData | None, optional
        Additional data of the node.
    """

    def __init__(self, id: str, data: NodeData | None = None):
        self.id: str = id
        self.topics: list[CommunicationTopic] = []
        self.data: NodeData | None = data
        self.graph: CommunicationGraph[NodeData] | None = None

    @property
    def degree(self) -> int:
        """Calculate the total degree of the node."""
        return self.in_degree + self.out_degree

    @property
    def in_degree(self) -> int:
        """Calculate the in-degree of the node."""
        return len(self.get_predecessors())

    @property
    def out_degree(self) -> int:
        """Calculate the out-degree of the node."""
        return len(self.get_successors())

    def add_topic(self, topic: CommunicationTopic, ignore_existing: bool = True) -> None:
        """Add a topic to the node.

        Parameters
        ----------
        topic : CommunicationTopic
            The topic to add.
        ignore_existing : bool, optional
            Whether to ignore if the topic already exists, by default True.

        Raises
        ------
        ValueError
            If the topic does not belong to the node.
        ValueError
            If the topic already exists and `ignore_existing` is False.
        """
        if topic.node_id != self.id:
            raise ValueError("Topic does not belong to the node")

        for existing_topic in self.topics:
            if existing_topic.id == topic.id and existing_topic.channel == topic.channel and existing_topic.direction == topic.direction:
                if ignore_existing:
                    return
                raise ValueError(f"Topic with id {topic.id} ({topic.channel.type}, {topic.direction}) already exists")

        self.topics.append(topic)

    def get_connected_nodes(
        self, direction: CommunicationDirection, channels: str | list[str] | list[CommunicationChannel] | None = None
    ) -> list[CommunicationNode[NodeData]]:
        """Get a list of connected nodes according to the direction and the channels.

        Parameters
        ----------
        direction : CommunicationDirection
            The direction of the connections.
        channels : str | list[str] | list[CommunicationChannel], optional
            The channels of the connections, by default None.

        Returns
        -------
        list[CommunicationNode[NodeData]]
            The list of connected nodes.

        Raises
        ------
        ValueError
            If the graph is not set.
        """
        if self.graph is None:
            raise ValueError("Graph not set")
        return self.graph.get_successors_according_to_direction(self, direction, channels)

    def get_successors(self, channels: Union[str, list[str], list[CommunicationChannel]] | None = None) -> list[CommunicationNode[NodeData]]:
        """Get a list of successors of the node.

        Parameters
        ----------
        channels : str | list[str] | list[CommunicationChannel], optional
            The channels of the connections, by default None.

        Returns
        -------
        list[CommunicationNode[NodeData]]
            The list of successors.
        """
        return self.get_connected_nodes("outgoing", channels)

    def get_predecessors(self, channels: Union[str, list[str], list[CommunicationChannel]] | None = None) -> list[CommunicationNode[NodeData]]:
        """Get a list of predecessors of the node.

        Parameters
        ----------
        channels : str | list[str] | list[CommunicationChannel], optional
            The channels of the connections, by default None.

        Returns
        -------
        list[CommunicationNode[NodeData]]
            The list of predecessors.
        """
        return self.get_connected_nodes("incoming", channels)

    def get_links(self, direction: CommunicationDirection, channels: Union[str, list[str], list[CommunicationChannel]] | None = None) -> list:
        """Get a list of links according to the direction and the channels.

        Parameters
        ----------
        direction : CommunicationDirection
            The direction of the links.
        channels : str | list[str] | list[CommunicationChannel], optional
            The channels of the links, by default None.

        Returns
        -------
        list
            The list of links.

        Raises
        ------
        ValueError
            If the graph is not set.
        """
        if self.graph is None:
            raise ValueError("Graph not set")
        return self.graph.get_links_according_to_direction(self, direction, channels)

    def get_outgoing_links(self, channels: Union[str, list[str], list[CommunicationChannel]] | None = None) -> list:
        """Get a list of outgoing links of the node.

        Parameters
        ----------
        channels : str | list[str] | list[CommunicationChannel], optional
            The channels of the links, by default None.

        Returns
        -------
        list
            The list of outgoing links.
        """
        return self.get_links("outgoing", channels)

    def get_incoming_links(self, channels: Union[str, list[str], list[CommunicationChannel]] | None = None) -> list:
        """Get a list of incoming links of the node.

        Parameters
        ----------
        channels : str | list[str] | list[CommunicationChannel], optional
            The channels of the links, by default None.

        Returns
        -------
        list
            The list of incoming links.
        """
        return self.get_links("incoming", channels)
