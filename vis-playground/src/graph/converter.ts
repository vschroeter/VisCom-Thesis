import { Graph } from 'ngraph.graph';
import { CommunicationChannel, CommunicationGraph, CommunicationNode, CommunicationTopic, MessageType } from "./commGraph";
import { ApiGraphData } from 'src/api/graphDataApi';

export function convertGraphToCommGraph(graph: Graph<any, ApiGraphData>): CommunicationGraph {
    const channels = [new CommunicationChannel('PubSub'), new CommunicationChannel('Services')];
    const commNodes = new Array<CommunicationNode>();
    const commNodesMap = new Map<string, CommunicationNode>();

    let topicIdCounter = 0;

    graph.forEachNode((node) => {
        const commNode = new CommunicationNode(node.id.toString());
        commNode.score = node.data.commgraph_centrality ?? 0;
        commNodesMap.set(node.id.toString(), commNode);
    });

    graph.forEachLink((link) => {
        const from = link.fromId.toString();
        const to = link.toId.toString();

        const fromNode = commNodesMap.get(from) ?? new CommunicationNode(from);
        const toNode = commNodesMap.get(to) ?? new CommunicationNode(to);

        const pubTopic = link.data.pub_topic;
        const serviceName = link.data.service_name;

        const channel = pubTopic ? channels[0] : channels[1];
        const topicId = (pubTopic ? pubTopic : serviceName) ?? (topicIdCounter++).toString();

        const messageType = new MessageType(link.data.topic_type ?? link.data.type ?? 'Message');

        // const channel = channels[0];

        // console.log({
        //   from,
        //   to,
        //   pubTopic,
        //   serviceName,
        //   channel,
        //   topicId,
        //   w: link.data.weight,
        //   d: link.data.distance,
        //   link
        // });

        const topicOut = new CommunicationTopic(
            fromNode.id.toString(),
            topicId,
            channel,
            'outgoing',
            messageType,
            link.data.weight,
        );
        const topicIn = new CommunicationTopic(
            toNode.id.toString(),
            topicId,
            channel,
            'incoming',
            messageType,
            link.data.weight,
        );

        fromNode.addTopic(topicOut);
        toNode.addTopic(topicIn);

        commNodesMap.set(from, fromNode);
        commNodesMap.set(to, toNode);
    });

    commNodesMap.forEach((node) => {
        commNodes.push(node);
    });

    const commGraph = new CommunicationGraph(commNodes, channels);
    console.log('commGraph', commGraph);
    return commGraph;
}
