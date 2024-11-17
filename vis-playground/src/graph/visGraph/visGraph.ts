import { Point } from "2d-geometry";
import { CommunicationChannel, CommunicationGraph, CommunicationLink, CommunicationNode, CommunicationTopic } from "../commGraph";
import { CommonSettings } from "../layouter/settings/commonSettings";

import * as d3 from "d3";
import { LayoutConnection, VisLink } from "./layoutConnection";
import { LayoutNode } from "./layoutNode";
import { Sorter } from "../algorithms/sortings/sorting";
import { Connection2d, Node2d } from "../graphical";
import { BasicPrecalculator } from "./layouterComponents/precalculator";
import { BasePositioner } from "./layouterComponents/positioner";
import { UserInteractions } from "../visualizations/interactions";
import { BaseConnector } from "./layouterComponents/connector";

export type LayoutNodeOrId = LayoutNode | string;

export class NodeScoring {
    extent: [number, number] = [0, 0];
    colorScheme: (t: number) => string = d3.interpolateRdYlGn;

    getColor(value: number) {
        if (!this.isExtentValid()) {
            return "red";
        }

        const scale = d3.scaleLinear().domain(this.extent).range([0, 1]);
        return this.colorScheme(scale(value));
    }

    calculateExtent(nodes: LayoutNode[]) {
        this.extent = d3.extent(nodes, d => d.score) as [number, number];
    }

    isExtentValid() {
        return this.extent[0] !== this.extent[1] && Math.abs(this.extent[0]) !== Infinity && Math.abs(this.extent[1]) !== Infinity;
    }
}

export class VisGraph {

    commonSettings?: CommonSettings;
    userInteractions?: UserInteractions;

    ////////////////////////////////////////////////////////////////////////////
    // Creation methods
    ////////////////////////////////////////////////////////////////////////////

    constructor(commonSettings?: CommonSettings, userInteractions?: UserInteractions) {
        this.commonSettings = commonSettings;
        this.userInteractions = userInteractions;

        this.rootNode.hasGraphicalRepresentation = false;
        this.addNode(this.rootNode);
    }

    static fromCommGraph(commGraph: CommunicationGraph, commonSettings: CommonSettings, userInteractions?: UserInteractions): VisGraph {

        const visGraph = new VisGraph(commonSettings, userInteractions);

        // At first, add the nodes to the graph
        commGraph.nodes.forEach(commNode => {
            const visNode = new LayoutNode(visGraph, commNode.id);
            visNode.commNode = commNode;
            visNode.score = commNode.score;
            visGraph.addNode(visNode);
        });

        // Then, add the connections
        const commLinks = commGraph.getAllLinks(undefined, commonSettings.hideLinksThreshold.getValue());
        commLinks.forEach(commLink => {
            const visLink = new VisLink(commLink);
            visGraph.addLink(commLink.fromId, commLink.toId, visLink);
        });

        return visGraph;
    }



    ////////////////////////////////////////////////////////////////////////////
    // Tree Structure
    ////////////////////////////////////////////////////////////////////////////

    rootNode: LayoutNode = new LayoutNode(this, "__root__");

    ////////////////////////////////////////////////////////////////////////////
    // Node Management
    ////////////////////////////////////////////////////////////////////////////

    // Id to layout node mapping
    private mapIdToLayoutNode: Map<string, LayoutNode> = new Map();

    /**
     * Get the layout node by id
     * @param id The id of the node
     * @returns The layout node with the given id
     */
    getNode(id: LayoutNodeOrId): LayoutNode {
        if (typeof id === "string") {
            if (!this.mapIdToLayoutNode.has(id)) {
                throw new Error(`Node with id ${id} not found`);
            }
            return this.mapIdToLayoutNode.get(id)!;
        }
        return id;
    }


    /**
     * Get the nodes of the graph in its hierarchical layers.
     * @param reversed If true, the nodes are returned in reversed order (thus, beginning with leaf nodes)
     */
    getLayeredLayoutNodes(reversed: boolean = false): LayoutNode[][] {

        const layers: LayoutNode[][] = [];

        const visit = (node: LayoutNode, layer: number) => {
            if (!layers[layer]) {
                layers[layer] = [];
            }
            layers[layer].push(node);
            node.children.forEach(child => visit(child, layer + 1));
        }

        visit(this.rootNode, 0);

        return reversed ? layers.reverse() : layers;
    }

    get allLayoutNodes(): LayoutNode[] {
        return Array.from(this.mapIdToLayoutNode.values());
    }

    addNode(node: LayoutNode, parentNode?: LayoutNode) {
        const _parentNode = parentNode ?? this.rootNode;
        if (_parentNode !== node) {
            _parentNode.children.push(node);           
            node.parent = _parentNode;
        }
        this.mapIdToLayoutNode.set(node.id, node);
    }

    removeNode(node: LayoutNode, removeChildren = false) {
        if (node.children.length > 0) {
            if (!removeChildren) {
                throw new Error("Cannot remove node with children");
            }
            node.children.forEach(child => this.removeNode(child, true));
        }

        this.mapIdToLayoutNode.delete(node.id);
        node.parent?.children.splice(node.parent.children.indexOf(node), 1);
    }



    ////////////////////////////////////////////////////////////////////////////
    // Link Methods
    ////////////////////////////////////////////////////////////////////////////
    private mapSourceNodeIdToTargetNodeIdToConnection: Map<string, Map<string, LayoutConnection>> = new Map();

    get allLayoutConnections(): LayoutConnection[] {
        return this.getAllConnections();
    }

    addLink(source: LayoutNodeOrId, target: LayoutNodeOrId, link: VisLink) {

        const sNode = this.getNode(source)
        const tNode = this.getNode(target);
        const sId = sNode.id;
        const tId = tNode.id;

        if (!this.mapSourceNodeIdToTargetNodeIdToConnection.has(sId)) {
            this.mapSourceNodeIdToTargetNodeIdToConnection.set(sId, new Map());
        }

        if (!this.mapSourceNodeIdToTargetNodeIdToConnection.get(sId)!.has(tId)) {
            const newConnection = new LayoutConnection(sNode, tNode);
            this.mapSourceNodeIdToTargetNodeIdToConnection.get(sId)!.set(tId, newConnection);

            // Check if there is a connection from target to source to store the opposite connection
            const oppositeConnection = this.mapSourceNodeIdToTargetNodeIdToConnection.get(tId)?.get(sId);
            if (oppositeConnection) {
                newConnection.opposite = oppositeConnection;
                oppositeConnection.opposite = newConnection;
            }

            // Add the connection to the nodes
            sNode.outConnections.push(newConnection);
            tNode.inConnections.push(newConnection);
        }

        // Add the link
        const connection = this.mapSourceNodeIdToTargetNodeIdToConnection.get(sId)!.get(tId)!;
        // connection.links.push(link);
        connection.addLinks(link);


    }

    getOutgoingConnections(node: LayoutNodeOrId, channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.getNode(node).outConnections;
    }

    getIncomingConnections(node: LayoutNodeOrId, channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.getNode(node).inConnections;
    }

    getAllConnectionsOfNodes(nodes: LayoutNodeOrId[], channels?: CommunicationChannel[]): LayoutConnection[] {
        const connections: LayoutConnection[] = [];
        nodes.forEach(node => {
            connections.push(...this.getOutgoingConnections(node));
        });
        return connections;
    }

    getAllConnections(channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.getAllConnectionsOfNodes(this.allLayoutNodes);
    }

    getConnectionsBetweenNodes(source: LayoutNodeOrId, target: LayoutNodeOrId, channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.getNode(source).outConnections.filter(connection => connection.target === this.getNode(target));
    }


    ////////////////////////////////////////////////////////////////////////////
    // Layout methods
    ////////////////////////////////////////////////////////////////////////////


    setPrecalculator(precalculator: BasicPrecalculator | ((node: LayoutNode) => BasicPrecalculator)) {
        this.allLayoutNodes.forEach(node => {
            node.precalculator = precalculator;
        })
    }

    setPositioner(positioner: BasePositioner | ((node: LayoutNode) => BasePositioner)) {
        this.allLayoutNodes.forEach(node => {
            node.positioner = positioner;
        })
    }

    setConnector(connector: BaseConnector | ((node: LayoutNode) => BaseConnector)) {
        this.allLayoutNodes.forEach(node => {
            node.connector = connector;
        })
    }

    setSorter(sorter: Sorter | ((node: LayoutNode) => Sorter)) {
        this.allLayoutNodes.forEach(node => {
            node.sorter = sorter;
        })
    }

    layout() {
        // We layout the graph bottom-up, beginning with the leaf nodes without children
        // For each layer, we do the following:
        // 1. Calculate the size of the nodes, using the specified precalculators
        // 2. Sort the child nodes, using the specified sorter
        // 3. Position the child nodes, using the specified positioner
        // After everything is finished, we connect the child nodes, using the specified connector

        const layers = this.getLayeredLayoutNodes(true);

        layers.forEach(layer => {
            layer.forEach(node => {

                if (node.children.length > 0) {
                    node.sortChildren();
                    node.positionChildren();
                }

                node.precalculate();
            });
        });

        layers.forEach(layer => {
            layer.forEach(node => {
                if (node.parent) {
                    node.connect();
                }
            });
        });

        // Ensure, that all graphical elements are created
        this.createGraphicalElements();
        this.updateGraphicalLayout();
        this.updateGraphicalStyle();
    }

    ////////////////////////////////////////////////////////////////////////////
    // Rendering methods
    ////////////////////////////////////////////////////////////////////////////

    getAllGraphicalNodes(): Node2d[] {
        return this.allGraphicalNodes;
    }

    get allGraphicalNodes(): Node2d[] {
        return this.allLayoutNodes.map(node => node.node2d).filter(node => node !== undefined) as Node2d[];
    }

    getAllGraphicalConnections(): Connection2d[] {
        const connections: Connection2d[] = [];
        this.allLayoutNodes.forEach(node => {
            connections.push(...node.outConnections.map(connection => connection.connection2d).filter(connection => connection !== undefined) as Connection2d[]);
        });
        return connections;
    }

    get allGraphicalConnections(): Connection2d[] {
        return this.getAllGraphicalConnections();
    }

    protected createGraphicalElements() {
        this.allLayoutNodes.forEach(node => {
            node.createGraphicalElements();
        });
    }

    updateGraphicalLayout() {
        this.allLayoutNodes.forEach(node => {
            node.updateGraphicalLayout();
        });
    }

    updateGraphicalStyle() {

        // Get the node score extent
        const scoring = new NodeScoring();
        scoring.calculateExtent(this.allLayoutNodes)
        const validScores = scoring.isExtentValid();

        // Set the score colors of the nodes
        this.allGraphicalNodes.forEach(node => {
            // node.updateStyleFill((n) => this.commonSettings.nodeColor.getValue(n), this.nodeScoring.extent);

            if (!validScores) {
                const v = this.commonSettings?.nodeColor.getValue(node.layoutNode)?.toString() ?? "red";
                node.updateStyleFill(v);
                return;
            }
            const v = scoring.getColor(node.score);
            node.updateStyleFill(v);
        })

        // Update the node stroke based on the communities
        this.allGraphicalNodes.forEach(node => {
            if (!node.communities) {
                return;
            }

            const communities = node.communities.getCommunitiesOfNode(node.id);

            if (communities.length === 0) {
                return;
            }

            const totalCommunityCount = node.communities.countOfCommunities;
            if (totalCommunityCount === 0) {
                return;
            }

            const colors = communities.map(community => {
                const positionOfNodeCommunity = community / totalCommunityCount;
                return d3.hsl(d3.interpolateSinebow(positionOfNodeCommunity));
            });

            // Get the average color of all communities
            const averageColor = d3.hsl(d3.mean(colors, c => c.h)!, d3.mean(colors, c => c.s)!, d3.mean(colors, c => c.l)!);
            node.updateStyleStroke(averageColor.formatRgb());
        })

        // Update the opacities based on the user interactions
        const userInteractions = this.userInteractions;
        this.allGraphicalNodes.forEach(node => {
            let opacity = 1;
            if (userInteractions && userInteractions.somethingIsSelectedOrFocusedOrHovered) {
                if (userInteractions.isHovered(node)) {
                    opacity = 1;
                } else {
                    opacity = 0.2;
                }
            }
            node.updateStyleOpacity(opacity);
        })

        // Update the links opacity based on the user interactions and
        // the width based on the weight

        const minW = 0.1;
        const maxW = 5;
        const wMultiplier = 2;

        const stroke = this.commonSettings?.linkColor.getValue()?.toString() ?? "black";
        const strokeWithoutAlpha = d3.color(stroke)?.copy({ opacity: 1 })?.toString() ?? "black";
        const alpha = d3.color(stroke)?.opacity ?? 1;

        this.allGraphicalConnections.forEach(link => {
            const weight = link.weight;
            let opacity = Math.min(Math.max(0.01, weight), 1) * alpha;
            const width = Math.min(maxW, Math.max(minW, weight * wMultiplier));

            if (userInteractions && userInteractions.somethingIsSelectedOrFocusedOrHovered) {
                const startNode = link.source;
                const endNode = link.target;

                if (userInteractions.isHovered(startNode) || userInteractions.isHovered(endNode)) {
                    opacity = alpha;
                } else {
                    opacity *= 0.2;
                }
            }
            link.updateStyleOpacity(opacity);
            link.updateStyleStroke(strokeWithoutAlpha, width);
        })

    }


    ////////////////////////////////////////////////////////////////////////////
    // Hierarchy methods
    ////////////////////////////////////////////////////////////////////////////
    private _hyperNodeId = 0;

    getNewHyperNodeId() {
        return `__hypernode_${this._hyperNodeId++}`;
    }

    moveNodesToParent(nodes: LayoutNode[], parentNode: LayoutNode) {
        nodes.forEach(node => {
            const oldParent = node.parent;
            if (oldParent) {
                oldParent.children.splice(oldParent.children.indexOf(node), 1);
            }
            node.parent = parentNode;
            parentNode.children.push(node);
        });        
    }

    combineNodesIntoHyperNode(nodes: LayoutNode[], parentNode: LayoutNode = this.rootNode) {
        const hyperNode = new LayoutNode(this, this.getNewHyperNodeId());
        this.addNode(hyperNode, parentNode);
        this.moveNodesToParent(nodes, hyperNode);
    }

    // The given communities are combined into hypernodes
    combineCommunities(communityNodeIds: (LayoutNode | string)[][], parentNode: LayoutNode = this.rootNode) {
        const communities = communityNodeIds.map(community => community.map(node => this.getNode(node)));
        
        communities.forEach(nodes => {
            this.combineNodesIntoHyperNode(nodes, parentNode);
        });
    }

    // If a node only has connections to a single other node in this layer, we can add it as subnode
    combineStronglyCoupledNodes() {

    }

    // If a node is broadcasting to every other node in this layer, we can add it to each node as subnode
    combineBroadcastingNodes() {

    }

    // Groups of nodes, that are connected to the same predecessor and successor nodes, are combined
    combineBySimilarConnections() {

    }




}
