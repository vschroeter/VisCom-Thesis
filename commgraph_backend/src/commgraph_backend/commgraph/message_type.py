from __future__ import annotations


class MessageType:
    """Class representing a message type for messages sent over a topic in a communication channel.

    Attributes
    ----------
    name : str
        The name of the message type.
    definition : str | None, optional
        The definition of the message type, if provided.
    """

    def __init__(self, name: str, definition: str | None = None) -> None:
        """
        Initialize a new message type.

        Parameters
        ----------
        name : str
            The name of the message type.
        definition : str | None, optional
            The definition of the message type.
        """
        self.name: str = name
        self.definition: str | None = definition

    def __str__(self) -> str:
        """
        Return the string representation of the message type.

        Returns
        -------
        str
            The name of the message type.
        """
        return self.name
