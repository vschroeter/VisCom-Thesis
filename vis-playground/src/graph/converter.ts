import { Graph } from 'ngraph.graph';
import { CommunicationChannel, CommunicationGraph, CommunicationNode, CommunicationTopic, MessageType } from "./commGraph";

export function convertGraphToCommGraph(graph: Graph): CommunicationGraph {
  const channels = [new CommunicationChannel('PubSub')];
  const commNodes = new Array<CommunicationNode>();
  const commNodesMap = new Map<string, CommunicationNode>();

  let topicId = 0;

  graph.forEachLink((link) => {
    const from = link.fromId.toString();
    const to = link.toId.toString();

    const fromNode = commNodesMap.get(from) ?? new CommunicationNode(from);
    const toNode = commNodesMap.get(to) ?? new CommunicationNode(to);

    const channel = channels[0];
    const topicOut = new CommunicationTopic(
      fromNode.id.toString(),
      topicId.toString(),
      channel,
      'outgoing',
      new MessageType('Message'),
    );
    const topicIn = new CommunicationTopic(
      fromNode.id.toString(),
      topicId.toString(),
      channel,
      'incoming',
      new MessageType('Message'),
    );

    fromNode.topics.push(topicOut);
    toNode.topics.push(topicIn);

    commNodesMap.set(from, fromNode);
    commNodesMap.set(to, toNode);

    topicId++;
  });

  commNodesMap.forEach((node) => {
    commNodes.push(node);
  });

  const commGraph = new CommunicationGraph(commNodes, channels);
  return commGraph;
}
