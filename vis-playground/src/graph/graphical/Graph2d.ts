import { CommunicationGraph, CommunicationLink, CommunicationNode } from "../commGraph";
import { GraphLayouter } from "../layouter/layouter";
import { GraphLayouterSettings } from "../layouter/settings/settings";
import { VisGraph } from "../visGraph/visGraph";
import { LayoutNode } from "../visGraph/layoutNode";
import { MouseEvents } from "../visualizations/interactions";
import { Connection2d, Connection2dData } from "./Connection2d";
import { Node2d, Node2dData } from "./Node2d";

import * as d3 from 'd3';

export class Graph2d {

    layouter?: GraphLayouter<GraphLayouterSettings>;

    nodes: Node2d[] = [];
    links: Connection2d[] = [];
    // labels: AbstractLabel2d[] = [];

    mapIdToNode2d: Map<string, Node2d> = new Map();

    constructor(layouter?: GraphLayouter<GraphLayouterSettings>) {
        this.layouter = layouter;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Static graph creation methods
    ////////////////////////////////////////////////////////////////////////////

    static createEmptyGraph(): Graph2d {
        return new Graph2d();
    }

    static createFromCommGraph(commGraph: CommunicationGraph, layouter?: GraphLayouter<any>): Graph2d {
        return this.createFromCommNodes(commGraph, commGraph.nodes, layouter);
    }

    static createFromCommNodes(commGraph: CommunicationGraph, commNodes: CommunicationNode[], layouter?: GraphLayouter<any>): Graph2d {
        const graph = new Graph2d(layouter);

        // Create nodes
        commNodes.forEach(node => graph.createNode2d(node));

        // Create links
        const links = commGraph.getAllInternalLinksOfNodes(commNodes, undefined, layouter?.commonSettings.hideLinksThreshold.getValue() ?? 0)
        const mergedLinks = CommunicationLink.mergeLinks(links);
        // const filteredLinks = mergedLinks.filter(link => {
        //     return link.weight > (layouter?.commonSettings.hideLinksThreshold.getValue(link) ?? 0);  
        // })
        // console.log("Links", links, mergedLinks, filteredLinks);
        // console.log("Links", links, mergedLinks);
        mergedLinks.forEach(link => graph.createLink2d(link));
        // filteredLinks.forEach(link => graph.createLink2d(link));

        return graph;
    }

    static createFromVisGraph(visGraph: VisGraph) {

        const graph = new Graph2d();

        visGraph.nodes.forEach(node => graph.createNode2dFromVisNode(node));

        visGraph.getAllConnections().forEach(connection => graph.createLink2d(connection));

        return graph;

    }

    static createFromNodesAndLinks(nodes: Node2dData[], links: Connection2dData[], layouter?: GraphLayouter<any>): Graph2d {

        const graph = new Graph2d(layouter);

        nodes.forEach(node => graph.createNode2d(node));

        links.forEach(link => graph.createLink2d(link));

        return graph;

    }

    ////////////////////////////////////////////////////////////////////////////
    // Node and link creation
    ////////////////////////////////////////////////////////////////////////////

    addNode2d(node: Node2d | Node2d[]): void {
        if (Array.isArray(node)) {
            node.forEach(n => this.addNode2d(n));
            return;
        }
        this.nodes.push(node);
        this.mapIdToNode2d.set(node.id, node);
    }

    addLink2d(link: Connection2d | Connection2d[]): void {
        if (Array.isArray(link)) {
            link.forEach(l => this.addLink2d(l));
            return;
        }
        this.links.push(link);
    }

    createNode2d<T extends Node2dData>(node: T): Node2d<T> {
        const node2d = new Node2d(node);
        // node2d.score = commGraph.ranking.getScoreOfNode(node) ?? 0;
        node2d.score = node.score ?? 0;
        node2d.communities = node.communities;
        
        this.addNode2d(node2d);
        return node2d;
    }

    createNode2dFromVisNode(node: LayoutNode): Node2d<LayoutNode> {
        const node2d = new Node2d(node);
        // node2d.score = commGraph.ranking.getScoreOfNode(node) ?? 0;
        node2d.score = node.score ?? 0;
        node2d.radius = node.radius ?? 10;

        // node2d.communities = node.communities;
        
        this.addNode2d(node2d);
        return node2d;
    }

    createLink2d<T extends Connection2dData>(link: T): Connection2d<T> {
        const source = this.mapIdToNode2d.get(link.fromId);
        const target = this.mapIdToNode2d.get(link.toId);

        if (!source || !target) {
            throw new Error("Source or target not found");
        }

        const conn = new Connection2d<T>(source, target, link);
        this.addLink2d(conn);
        return conn;
    }


    getNodeID(node: string | Node2d): string {
        return typeof node === "string" ? node : (node.data.id ?? "");
    }

    getNode(nodeID: string | Node2d): Node2d | undefined {
        if (typeof nodeID === "string") {
            return this.mapIdToNode2d.get(nodeID);
        }
        return nodeID;
    }
}
