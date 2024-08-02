/**
 * Class representing a message type for messages sent over a topic in a communication channel.
 */
export class MessageType {
  name: string;
  definition: string | undefined;

  constructor(name: string, definition?: string) {
    this.name = name;
    this.definition = definition;
  }

  toString() {
    return this.name;
  }
}
