import { Graph } from "ngraph.graph";
import { CommunicationChannel, CommunicationGraph, CommunicationNode, CommunicationTopic, MessageType } from "./graph";


function convertGraphToCommGraph(graph: Graph): CommunicationGraph {

    const channels = [new CommunicationChannel("PubSub")] 
    const commNodes = new Array<CommunicationNode>()
    const commNodesMap = new Map<string, CommunicationNode>()

    let topicId = 0

    graph.forEachLink((link) => {
        const from = link.fromId.toString()
        const to = link.toId.toString()
        
        const fromNode = commNodesMap.get(from) ?? new CommunicationNode(from)
        const toNode = commNodesMap.get(to) ?? new CommunicationNode(to)
        
        const channel = channels[0]
        const topicOut = new CommunicationTopic((topicId++).toString(), channel, new MessageType("Message"), "outgoing");
        const topicIn = new CommunicationTopic((topicId++).toString(), channel, new MessageType("Message"), "incoming");

        fromNode.topics.push(topicOut)
        toNode.topics.push(topicIn)

        commNodesMap.set(from, fromNode)
        commNodesMap.set(to, toNode)
    });
    
    const commGraph = new CommunicationGraph(commNodes, channels)
    return commGraph
}

