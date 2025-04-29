from __future__ import annotations


class CommunicationDirection:
    """The direction of a communication topic on a channel.

    The topic can communicate data on the channel either in the outgoing direction (thus, publishing data),
    in the incoming direction (thus, receiving data), or in both directions (thus, bidirectional communication).
    """

    INCOMING: str = "incoming"
    OUTGOING: str = "outgoing"
    BIDIRECTIONAL: str = "bidirectional"


CommunicationDirectionPendant: dict[str, str] = {
    "incoming": CommunicationDirection.OUTGOING,
    "outgoing": CommunicationDirection.INCOMING,
    "bidirectional": CommunicationDirection.BIDIRECTIONAL,
}


class CommunicationChannel:
    """Class representing a communication channel.

    Your graph is defined by the channels, on which the nodes communicate via topics.
    A channel can be of different types, e.g. PubSub, ServiceCall, ActionCall, etc.

    Attributes
    ----------
    type : str
        The type of the communication channel.
    """

    def __init__(self, type: str) -> None:
        """
        Create a new communication channel.

        Parameters
        ----------
        type : str
            The type of the channel.
        """
        self.type: str = type

    def __str__(self) -> str:
        """
        Return the string representation of the communication channel.

        Returns
        -------
        str
            The type of the communication channel.
        """
        return self.type
