from __future__ import annotations


class CommunicationLink:
    """
    Represents a communication link between two nodes.

    Parameters
    ----------
    from_id : str
        The id of the source node.
    to_id : str
        The id of the target node.
    channel : CommunicationChannel
        The channel of the communication.
    direction : CommunicationDirection
        The direction of the communication.
    graph : CommunicationGraph
        Reference to the communication graph.
    """

    def __init__(
        self, 
        from_id: str, 
        to_id: str, 
        channel: CommunicationChannel, 
        direction: CommunicationDirection, 
        graph: CommunicationGraph
    ) -> None:
        self.from_id: str = from_id
        self.to_id: str = to_id
        self.channel: CommunicationChannel = channel
        self.direction: CommunicationDirection = direction
        self._graph: CommunicationGraph = graph

    @property
    def from_node(self) -> CommunicationNode:
        """
        Returns
        -------
        CommunicationNode
            The source node of the link.
        """
        return self._graph.nodes_by_id[self.from_id]

    @property
    def to_node(self) -> CommunicationNode:
        """
        Returns
        -------
        CommunicationNode
            The target node of the link.
        """
        return self._graph.nodes_by_id[self.to_id]


class ChannelGraphLinkData:
    """
    Stores data about a communication link's topic and channel.

    Parameters
    ----------
    topic : CommunicationTopic
        The topic of the communication.
    channel : CommunicationChannel
        The channel of the communication.
    """

    def __init__(self, topic: CommunicationTopic, channel: CommunicationChannel) -> None:
        self.topic: CommunicationTopic = topic
        self.channel: CommunicationChannel = channel
