
import createGraph, { Graph } from 'ngraph.graph';
import { CommunicationGraph } from 'src/graph/commGraph';
import { VisGraph } from 'src/graph/visGraph/visGraph';


export interface ApiLink {
    source: string;
    target: string;

    pub_topic?: string;
    service_name?: string;
    topic_type?: string;
    type?: string;
}

export interface ApiNode {
    id: string;
    commgraph_centrality?: number;
}

export interface ApiGraph {
    nodes: ApiNode[];
    links: ApiLink[];
    multigraph: boolean;
    directed: boolean;
}

export interface ApiGraphData {
    pub_topic?: string;
    service_name?: string;
    weight?: number;
    distance?: number;
    topic_type?: string;
    type?: string;
}

export function parseGraphData(
    jsonGraph: ApiGraph | string,
): Graph<any, ApiGraphData> {
    const data: ApiGraph = typeof jsonGraph === 'string' ? JSON.parse(jsonGraph) : jsonGraph;
    console.log('data', data);
    const graph = createGraph({ multigraph: true });

    const dNodes = data.nodes ?? [];
    const dLinks = data.links ?? [];

    dNodes.forEach((node) => {
        const dId = node.id ?? null;
        const dData = {
            commgraph_centrality: node.commgraph_centrality
        }
        if (dId === null) {
            throw new Error('nodeID not found in node' + JSON.stringify(node));
        }
        graph.addNode(dId, dData);
    });
    dLinks.forEach((link) => {
        const dFrom = link.source ?? null;
        const dTo = link.target ?? null;
        // const dData = link.data ?? null;

        // const data = {
        //     service_name: link.service_name,
        //     pub_topic: link.pub_topic,
        //     data: link
        // }
        // console.log('link', link);
        if (dFrom === null || dTo === null) {
            throw new Error('linkFrom or linkTo not found in link' + JSON.stringify(link));
        }
        graph.addLink(dFrom, dTo, link);
    });
    return graph;
}



export function commGraphToNodeLinkData(commGraph: CommunicationGraph) {
    const nodes: ApiNode[] = [];
    const links: ApiLink[] = [];
    commGraph.nodes.forEach((node) => {
        nodes.push({ id: node.id });
    });
    commGraph.getAllLinks().forEach((link) => {
        // console.log('link', link);
        if (link.channel.type == "PubSub") {
            links.push({ source: link.fromId, target: link.toId, pub_topic: link.topic.id, topic_type: link.topic.messageType.name });
        } else {
            links.push({ source: link.fromId, target: link.toId, service_name: link.topic.id, topic_type: link.topic.messageType.name });
        }
    });
    return { nodes, links };
}

export function visGraphToNodeLinkData(visGraph: VisGraph) {

    const nodes: ApiNode[] = [];
    const links: ApiLink[] = [];
    visGraph.allLayoutNodes.forEach((node) => {
        nodes.push({ id: node.id });
    });
    visGraph.allLayoutConnections.forEach((conn) => {

        conn.getLinks().forEach((link) => {
            // console.log('link', link);
            if (link.channel.type == "PubSub") {
                links.push({ source: conn.fromId, target: conn.toId, pub_topic: link.topic.id });
            } else {
                links.push({ source: conn.fromId, target: conn.toId, service_name: link.topic.id });
            }
        })

    });
    return { nodes, links };
}
