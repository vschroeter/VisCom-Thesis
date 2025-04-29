/**
 * The direction of a communication topic on a channel
 * The topic can communicate data on the channel either in outgoing direction (thus, publishing data),
 * in incoming direction (thus, receiving data), or in both directions (thus, bidirectional communication).
 */
export type CommunicationDirection = 'incoming' | 'outgoing' | 'bidirectional';
export const CommunicationDirectionPendant = {
  incoming: 'outgoing' as CommunicationDirection,
  outgoing: 'incoming' as CommunicationDirection,
  bidirectional: 'bidirectional' as CommunicationDirection,
};

/**
 * Class representing a communication channel.
 * Your graph is defined by the channels, on which the nodes communicate via topics.
 * A channel can be of different types, e.g. PubSub, ServiceCall, ActionCall, etc.
 */
export class CommunicationChannel {
  type: string;

  /**
   * Create a new communication channel
   * @param type The type of the channel
   */
  constructor(type: string) {
    this.type = type;
  }

  toString() {
    return this.type;
  }
}
