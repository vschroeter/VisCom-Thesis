
import createGraph, { Graph } from 'ngraph.graph';
import { CommunicationGraph } from 'src/graph/commGraph';


export interface ApiLink {
    source: string;
    target: string;
    data?: object;
}

export interface ApiNode {
    id: string;
    data?: object;
}

export interface ApiGraph {
    nodes: ApiNode[];
    links: ApiLink[];
    multigraph: boolean;
    directed: boolean;
}

export function parseGraphData(
    jsonGraph: ApiGraph | string,
): Graph {
    const data: ApiGraph = typeof jsonGraph === 'string' ? JSON.parse(jsonGraph) : jsonGraph;
    console.log('data', data);
    const graph = createGraph({ multigraph: true });

    const dNodes = data.nodes ?? [];
    const dLinks = data.links ?? [];

    dNodes.forEach((node) => {
        const dId = node.id ?? null;
        const dData = node.data ?? null;
        if (dId === null) {
            throw new Error('nodeID not found in node' + JSON.stringify(node));
        }
        graph.addNode(dId, dData);
    });
    dLinks.forEach((link) => {
        const dFrom = link.source ?? null;
        const dTo = link.target ?? null;
        const dData = link.data ?? null;
        if (dFrom === null || dTo === null) {
            throw new Error('linkFrom or linkTo not found in link' + JSON.stringify(link));
        }
        graph.addLink(dFrom, dTo, dData);
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
        links.push({ source: link.fromId, target: link.toId });
    });
    return { nodes, links };
}
