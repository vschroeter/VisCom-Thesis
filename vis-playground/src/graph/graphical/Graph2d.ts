import { CommunicationGraph, CommunicationLink, CommunicationNode } from "../commGraph";
import { GraphLayouter } from "../layouter/layouter";
import { GraphLayouterSettings } from "../layouter/settings/settings";
import { MouseEvents } from "../visualizations/interactions";
import { Connection2d, Connection2dData } from "./Connection2d";
import { Node2d } from "./Node2d";

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
        const links = commGraph.getAllInternalLinksOfNodes(commNodes)
        const mergedLinks = CommunicationLink.mergeLinks(links);
        const filteredLinks = mergedLinks.filter(link => {
            return link.weight > (layouter?.commonSettings.hideLinksThreshold.getValue(link) ?? 0);  
        })
        // console.log("Links", links, mergedLinks, filteredLinks);
        mergedLinks.forEach(link => graph.createLink2d(link));

        return graph;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Node and link creation
    ////////////////////////////////////////////////////////////////////////////

    createNode2d(node: CommunicationNode): Node2d {
        const node2d = new Node2d(node);
        // node2d.score = commGraph.ranking.getScoreOfNode(node) ?? 0;
        node2d.score = node.score ?? 0;
        node2d.communities = node.graph?.communities;
        this.mapIdToNode2d.set(node.id, node2d);
        this.nodes.push(node2d);

        return node2d;
    }

    createLink2d(link: Connection2dData): Connection2d {
        const source = this.mapIdToNode2d.get(link.fromId);
        const target = this.mapIdToNode2d.get(link.toId);

        if (!source || !target) {
            throw new Error("Source or target not found");
        }

        const conn = new Connection2d(source, target, link);
        this.links.push(conn);
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
