import { CommunicationChannel, CommunicationDirection } from "./channel";
import { MessageType } from "./messageType";

/**
 * Class representing a communication topic on a communication channel.
 * Example:
 * - Node `n1` has a topic `t1` that communicates on channel `PubSub` in `outgoing` direction (so it publishes data)
 * - Node `n2` has a topic `t1` that communicates on channel `PubSub` in `incoming` direction (so it receives data)
 */
export class CommunicationTopic {
  /** The name of the topic */
  id: string;

  /** The node that the topic belongs to */
  nodeID: string;

  /** The channel of the topic */
  channel: CommunicationChannel;

  /** The type of the message */
  messageType: MessageType;

  /** The direction of the topic */
  direction: CommunicationDirection;

  /** The weight of the topic */
  weight: number = 1;

  /**
   * Create a new communication topic
   * @param nodeID The node that the topic belongs to
   * @param topicId The name of the topic
   * @param channel The channel of the topic
   * @param messageType The type of the message
   * @param direction The direction of the topic
   * @param weight The weight of the topic
   */
  constructor(
    nodeID: string,
    topicId: string,
    channel: CommunicationChannel,
    direction: CommunicationDirection,
    messageType: MessageType,
    weight = 1
  ) {
    this.nodeID = nodeID;
    this.id = topicId;
    this.channel = channel;
    this.messageType = messageType;
    this.direction = direction;
    this.weight = weight;
  }

  get distance() {
    return 1 / (this.weight**2);
  }
}
