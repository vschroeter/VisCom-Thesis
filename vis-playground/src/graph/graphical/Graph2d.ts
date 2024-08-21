import { CommunicationGraph, CommunicationLink, CommunicationNode } from "../commGraph";
import { AbstractConnection2d } from "./AbstractConnection2d";
import { AbstractNode2d } from "./AbstractNode2d";


export class Graph2d {

    /** The underlying communication graph */
    commGraph: CommunicationGraph;
    /** Node ID to graphical node map */
    mapIdToNode: Map<string, AbstractNode2d> = new Map();

    // /** Link ID to graphical link map */
    // mapIdToLink: Map<string, AbstractConnection2d> = new Map();

    /** The graphical nodes of the graph */
    get nodes(): AbstractNode2d[] {
        return Array.from(this.mapIdToNode.values());
    }

    /** The graphical links of the graph */
    links: AbstractConnection2d[] = [];

    constructor(commGraph: CommunicationGraph) {
        this.commGraph = commGraph;
        this.updateGraph();
    }

    createNode2d(node: CommunicationNode): AbstractNode2d {
        return new AbstractNode2d(null, node);
    }

    createLink2d(link: CommunicationLink): AbstractConnection2d {
        const source = this.mapIdToNode.get(link.fromId);
        const target = this.mapIdToNode.get(link.toId);

        if (!source || !target) {
            throw new Error("Source or target not found");
        }

        return new AbstractConnection2d(source, target, link);
    }

    updateGraph(commGraph?: CommunicationGraph) {
        if (commGraph) {
            this.commGraph = commGraph;
        }

        if (!this.commGraph) {
            return;
        }

        console.log("Updating graph", this.commGraph);
        // Update nodes
        this.commGraph.nodes.forEach(node => {
            if (!this.mapIdToNode.has(node.id)) {
                this.mapIdToNode.set(node.id, this.createNode2d(node));
            } else {
                this.mapIdToNode.get(node.id)!.data = node;
            }
        });

        // Update links
        this.commGraph.getAllLinks().forEach(link => {
            this.links.push(this.createLink2d(link));
        });
    }

    getNodeID(node: string | AbstractNode2d): string {
        return typeof node === "string" ? node : (node.data?.id ?? "");
    }

    getNode(nodeID: string | AbstractNode2d): AbstractNode2d | undefined {
        if (typeof nodeID === "string") {
            return this.mapIdToNode.get(nodeID);
        }
        return nodeID;        
    }






}


