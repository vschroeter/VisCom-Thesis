from __future__ import annotations
from typing import TYPE_CHECKING

# if TYPE_CHECKING:
#     from .channel import CommunicationChannel, CommunicationDirection
#     from .messageType import MessageType


class CommunicationTopic:
    """Class representing a communication topic on a communication channel.

    Example
    -------
    - Node `n1` has a topic `t1` that communicates on channel `PubSub` in `outgoing` direction (so it publishes data)
    - Node `n2` has a topic `t1` that communicates on channel `PubSub` in `incoming` direction (so it receives data)

    Parameters
    ----------
    node_id : str
        The node that the topic belongs to.
    topic_id : str
        The name of the topic.
    channel : CommunicationChannel
        The channel of the topic.
    message_type : MessageType
        The type of the message.
    direction : CommunicationDirection
        The direction of the topic.
    """

    def __init__(self, node_id: str, topic_id: str, channel: CommunicationChannel, direction: CommunicationDirection, message_type: MessageType) -> None:
        self.node_id: str = node_id
        self.id: str = topic_id
        self.channel: CommunicationChannel = channel
        self.message_type: MessageType = message_type
        self.direction: CommunicationDirection = direction
