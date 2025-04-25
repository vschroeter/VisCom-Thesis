import { Point, Shape } from "2d-geometry";
import { CommunicationChannel, CommunicationGraph, CommunicationLink, CommunicationNode, CommunicationTopic } from "../commGraph";
import { CommonSettings } from "../layouter/settings/commonSettings";

import * as d3 from "d3";
import { LayoutConnection, VisLink } from "./layoutConnection";
import { LayoutNode } from "./layoutNode";
import { Sorter } from "../algorithms/sortings/sorting";
import { Anchor, Connection2d, Node2d } from "../graphical";
import { BasicSizeCalculator } from "./layouterComponents/precalculator";
import { BasePositioner } from "./layouterComponents/positioner";
import { UserInteractions } from "../visualizations/interactions";
import { BaseConnectionLayouter, BaseNodeConnectionLayouter } from "./layouterComponents/connectionLayouter";
import { Renderer } from "./renderer/renderer";
import { LaidOutConnection, LaidOutDataApi, LaidOutNode } from "../metrics/metricsApi";
import { Clusterer } from "../algorithms/clustering";

export type LayoutNodeOrId = LayoutNode | string;

export class NodeScoring {

    range: [number, number] = [0, 1];
    extent: [number, number] = [0, 0];
    colorScheme: (t: number) => string = d3.interpolateRdYlGn;

    getColor(value: number) {
        if (!this.isExtentValid()) {
            return "red";
        }

        const scale = d3.scaleLinear().domain(this.extent).range(this.range);
        return this.colorScheme(scale(value));
    }

    setColorScheme(scheme: string) {
        this.range = [0, 1];

        const rangeForSimpleColors: [number, number] = [0.3, 1];
        const rangeForMultiColors: [number, number] = [0.2, 1];

        switch (scheme.toLowerCase()) {
            case "blue":
                this.range = rangeForSimpleColors;
                this.colorScheme = d3.interpolateBlues;
                break;
            case "green":
                this.range = rangeForSimpleColors;
                this.colorScheme = d3.interpolateGreens;
                break;
            case "orange":
                this.range = rangeForSimpleColors;
                this.colorScheme = d3.interpolateOranges;
                break;
            case "red":
                this.range = rangeForSimpleColors;
                this.colorScheme = d3.interpolateReds;
                break;
            case "purple":
                this.range = rangeForSimpleColors;
                this.colorScheme = d3.interpolatePurples;
                break;
            case "turbo":
                this.colorScheme = d3.interpolateTurbo;
                break;
            case "viridis":
                this.colorScheme = d3.interpolateViridis;
                break;
            case "inferno":
                this.colorScheme = d3.interpolateInferno;
                break;
            case "magma":
                this.colorScheme = d3.interpolateMagma;
                break;
            case "plasma":
                this.colorScheme = d3.interpolatePlasma;
                break;
            case "cividis":
                this.colorScheme = d3.interpolateCividis;
                break;
            case "warm":
                this.colorScheme = d3.interpolateWarm;
                break;
            case "cool":
                this.colorScheme = d3.interpolateCool;
                break;
            case "orange-red":
                this.range = rangeForMultiColors;
                this.colorScheme = d3.interpolateOrRd;
                break;
            case "yellow-green-blue":
                this.range = rangeForMultiColors;
                this.colorScheme = d3.interpolateYlGnBu;
                break;
            case "yellow-green":
                this.range = rangeForMultiColors;
                this.colorScheme = d3.interpolateYlGn;
                break;
            case "yellow-orange-red":
                this.range = rangeForMultiColors;
                this.colorScheme = d3.interpolateYlOrRd;
                break;
            case "red-yellow-green":
                this.colorScheme = d3.interpolateRdYlGn;
                break;
            default:
                // Default scheme if unknown
                this.colorScheme = d3.interpolateRdYlGn;
                break;
        }
    }

    calculateExtent(nodes: LayoutNode[]) {
        this.extent = d3.extent(nodes, d => d.score) as [number, number];
    }

    isExtentValid() {
        // return this.extent[0] !== this.extent[1] && Math.abs(this.extent[0]) !== Infinity && Math.abs(this.extent[1]) !== Infinity;
        return Math.abs(this.extent[0]) !== Infinity && Math.abs(this.extent[1]) !== Infinity;
    }

}

////////////////////////////////////////////////////////////////////////////
// #region VisGraph
////////////////////////////////////////////////////////////////////////////

export class VisGraph {

    commonSettings?: CommonSettings;
    userInteractions: UserInteractions;

    ////////////////////////////////////////////////////////////////////////////
    // Creation methods
    ////////////////////////////////////////////////////////////////////////////

    constructor(commonSettings?: CommonSettings) {
        this.commonSettings = commonSettings;
        this.userInteractions = new UserInteractions(this);

        this.rootNode.hasGraphicalRepresentation = false;
        this.addNode(this.rootNode);
    }

    static fromCommGraph(commGraph: CommunicationGraph, commonSettings: CommonSettings): VisGraph {

        const visGraph = new VisGraph(commonSettings);

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

        console.log("Created vis graph", visGraph);

        return visGraph;
    }



    ////////////////////////////////////////////////////////////////////////////
    // Tree Structure
    ////////////////////////////////////////////////////////////////////////////

    rootNode: LayoutNode = new LayoutNode(this, "__root__");

    ////////////////////////////////////////////////////////////////////////////
    // #region Node Management
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
     * Get the next free id with the given prefix, appending a number to the prefix, e.g., prefix_0, prefix_1, ...
     * @param prefix The prefix of the id
     * @returns The next free id with the given prefix
     */
    getNextFreeId(prefix: string): string {
        let i = 0;
        while (this.mapIdToLayoutNode.has(`${prefix}_${i}`)) {
            i++;
        }
        return `${prefix}_${i}`;
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
        return Array.from(this.getLayeredLayoutNodes(false).flat());
    }

    get allLeafLayoutNodes(): LayoutNode[] {
        return this.allLayoutNodes.filter(node => node.children.length === 0);
    }

    addNode(node: LayoutNode, parentNode?: LayoutNode) {
        const _parentNode = parentNode ?? this.rootNode;
        if (_parentNode !== node) {
            _parentNode.children.push(node);
            node.parent = _parentNode;
        }
        this.mapIdToLayoutNode.set(node.id, node);
    }

    removeNode(node: LayoutNode, removeChildren = false, keepInMap = false) {
        if (node.children.length > 0) {
            if (!removeChildren) {
                throw new Error("Cannot remove node with children");
            }
            node.children.forEach(child => this.removeNode(child, true));
        }

        node.outConnections.forEach(connection => {
            const target = connection.target;
            target.inConnections.splice(target.inConnections.indexOf(connection), 1);
        })

        node.inConnections.forEach(connection => {
            const source = connection.source;
            source.outConnections.splice(source.outConnections.indexOf(connection), 1);
        })

        if (!keepInMap) {
            this.mapIdToLayoutNode.delete(node.id);
        }
        node.parent?.children.splice(node.parent.children.indexOf(node), 1);
    }

    getCommunitiesOfConnectionsOfNode(node: LayoutNode): LayoutNode[] {
        const communities = new Set<LayoutNode>();

        node.outConnections.forEach(connection => {
            const target = connection.target;
            if (!target.parent) return;

            if (target.parent !== node.parent) {
                communities.add(target.parent);
            }
        });

        node.inConnections.forEach(connection => {
            const source = connection.source;
            if (!source.parent) return;

            if (source.parent !== node.parent) {
                communities.add(source.parent);
            }
        });

        return Array.from(communities);
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Link Methods
    ////////////////////////////////////////////////////////////////////////////
    private mapSourceNodeIdToTargetNodeIdToConnection: Map<string, Map<string, LayoutConnection>> = new Map();

    get allLayoutConnections(): LayoutConnection[] {
        return this.getAllConnections();
    }

    addLink(source: LayoutNodeOrId, target: LayoutNodeOrId, links: VisLink | VisLink[]) {

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
        connection.addLinks(links);

        return connection;
    }

    addHyperConnection(source: LayoutNode, target: LayoutNode, connection: LayoutConnection | LayoutConnection[], isExplicit = false) {
        const sNode = this.getNode(source)
        const tNode = this.getNode(target);
        const sId = sNode.id;
        const tId = tNode.id;

        if (!this.mapSourceNodeIdToTargetNodeIdToConnection.has(sId)) {
            this.mapSourceNodeIdToTargetNodeIdToConnection.set(sId, new Map());
        }

        if (!this.mapSourceNodeIdToTargetNodeIdToConnection.get(sId)!.has(tId)) {
            const newHyperConnection = new LayoutConnection(sNode, tNode);
            this.mapSourceNodeIdToTargetNodeIdToConnection.get(sId)!.set(tId, newHyperConnection);

            // Check if there is a connection from target to source to store the opposite connection
            const oppositeConnection = this.mapSourceNodeIdToTargetNodeIdToConnection.get(tId)?.get(sId);
            if (oppositeConnection) {
                newHyperConnection.opposite = oppositeConnection;
                oppositeConnection.opposite = newHyperConnection;
            }

            // Add the connection to the nodes
            sNode.outConnections.push(newHyperConnection);
            tNode.inConnections.push(newHyperConnection);
        }

        // Add the link
        const hyperConnection = this.mapSourceNodeIdToTargetNodeIdToConnection.get(sId)!.get(tId)!;
        hyperConnection.isCalculated = !isExplicit;
        // connection.links.push(link);
        hyperConnection.addChildren(connection);
    }

    removeConnection(connection: LayoutConnection) {
        const source = connection.source;
        const target = connection.target;
        source.outConnections = source.outConnections.filter(c => c !== connection);
        target.inConnections = target.inConnections.filter(c => c !== connection);
        this.mapSourceNodeIdToTargetNodeIdToConnection.get(source.id)!.delete(target.id);
    }

    moveConnectionsBetweenNodes(oldSource: LayoutNode, oldTarget: LayoutNode, newSource: LayoutNode, newTarget: LayoutNode, deleteInstantly = true): { newConnections: LayoutConnection[], connectionsToDelete: LayoutConnection[] } {
        const connections = [this.getConnectionBetweenNodes(oldSource, oldTarget)];
        const newConnections: LayoutConnection[] = [];
        const connectionsToDelete: LayoutConnection[] = [];
        connections.forEach(connection => {
            if (!connection) return;
            console.log("Move connection", `${oldSource.id} -> ${oldTarget.id}`, "to", `${newSource.id} -> ${newTarget.id}`);
            if (deleteInstantly) {
                this.removeConnection(connection);
            } else {
                connectionsToDelete.push(connection);
            }
            // this.removeConnection(connection);
            const nc = this.addLink(newSource, newTarget, connection.getLinks());
            newConnections.push(nc);
        });

        return {
            newConnections,
            connectionsToDelete
        }
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

    getConnectionBetweenNodes(source: LayoutNodeOrId, target: LayoutNodeOrId, channels?: CommunicationChannel[]): LayoutConnection | undefined {
        return this.mapSourceNodeIdToTargetNodeIdToConnection.get(this.getNode(source).id)?.get(this.getNode(target).id);
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Layout methods
    ////////////////////////////////////////////////////////////////////////////


    setPrecalculator(precalculator: BasicSizeCalculator | ((node: LayoutNode) => BasicSizeCalculator)) {
        this.allLayoutNodes.forEach(node => {
            node.precalculator = precalculator;
        })
    }

    setPositioner(positioner: BasePositioner | ((node: LayoutNode) => BasePositioner)) {
        this.allLayoutNodes.forEach(node => {
            node.positioner = positioner;
        })
    }

    // setConnectionLayouter(connector: BaseConnectionLayouter | ((connection: LayoutConnection) => BaseConnectionLayouter | undefined)) {
    //     // this.allLayoutNodes.forEach(node => {
    //     //     node.connector = connector;
    //     // })
    //     this.allLayoutConnections.forEach(connection => {
    //         connection.connector = connector;
    //     })
    // }

    // setNodeConnectionLayouter(layouter: BaseNodeConnectionLayouter | ((node: LayoutNode) => BaseNodeConnectionLayouter)) {
    setConnectionLayouter(layouter: BaseNodeConnectionLayouter | BaseNodeConnectionLayouter[]) {
        this.allLayoutNodes.forEach(node => {
            node.connectionLayouter = layouter;
        })
    }

    setSorter(sorter: Sorter | ((node: LayoutNode) => Sorter)) {
        this.allLayoutNodes.forEach(node => {
            node.sorter = sorter;
        })
    }

    async layout() {
        // We layout the graph bottom-up, beginning with the leaf nodes without children
        // For each layer, we do the following:
        // 1. Calculate the size of the nodes, using the specified precalculators
        // 2. Sort the child nodes, using the specified sorter
        // 3. Position the child nodes, using the specified positioner

        // Before we start connecting the nodes, we need to propagate the position of parent nodes,
        // as each positioner positions the child nodes relative to (0,0).
        // If a parent is placed at a specific position, this position is applied to each child node.
        // After everything is finished, we connect the child nodes, using the specified connector.



        const botUpLayers = this.getLayeredLayoutNodes(true);
        const topDownLayers = Array.from(botUpLayers).reverse();

        const layerCount = botUpLayers.length;

        // Set the layers of the nodes
        topDownLayers.forEach((layer, i) => {
            layer.forEach(node => {
                node.setLayer(i, layerCount);
            });
        })

        // Position the nodes and calculate the size
        await Promise.all(botUpLayers.map(async layer => {
            await Promise.all(layer.map(async node => {

                if (node.children.length > 0) {
                    node.sortChildren();
                    await node.calculatePositionOfChildren();
                }

                await node.calculateNodeSize();
            }));
        }));

        // Propagate the sizes and positions of the parent nodes
        topDownLayers.forEach(layer => {
            layer.forEach(node => {
                node.propagateSizeToChildNodes();
                node.propagatePositionToChildNodes();
            });
        });

        // If the layouter has some refinement steps, we do them now
        botUpLayers.forEach((layer, i) => {
            layer.forEach(node => {
                node.refinePositionOfChildren();
            });
        });

        // Reset and init the connection layouts
        botUpLayers.flat().forEach(node => {
            node.initConnectionLayouter();
        })

        // Calculate the connection layouts based on a node's edge groups (node focused)
        let connectionChanged = true;
        while (connectionChanged) {
            connectionChanged = false;
            botUpLayers.forEach(layer => {
                try {
                    layer.forEach(node => {
                        // node.calculateConnections();
                        const changed = node.iterateConnectionLayouter();
                        connectionChanged = connectionChanged || changed;
                    });
                } catch (e) {
                    console.error(e);
                }
            });
        }

        // Update the smallest node size of the graph
        const smallestExistingNodeSize = d3.min(this.allLayoutNodes.map(node => node.radius)) ?? 0;
        this.smallestExistingNodeSize = d3.min(this.allLayoutNodes.filter(node => !node.isVirtual).map(node => node.radius)) ?? smallestExistingNodeSize;

        // Ensure, that all graphical elements are created
        this.createGraphicalElements();
        this.updateGraphicalLayout();
        this.updateGraphicalStyle();
    }

    getLaidOutApiData(): LaidOutDataApi {

        const nodes: LaidOutNode[] = this.allGraphicalLeafNodes.map(node => {
            return {
                id: node.id,
                x: node.x,
                y: node.y,
                score: node.score,
                radius: node.radius
                // radius: node.layoutNode.outerRadius
                // radius: node.layoutNode.outerRadius
            }
        });

        const links: LaidOutConnection[] = this.allGraphicalConnections.map(connection => {
            return {
                source: connection.source.id,
                target: connection.target.id,
                weight: connection.weight,
                distance: connection.distance,
                path: connection.getSvgPath()
            }

        });

        return { nodes, links };
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Rendering methods
    ////////////////////////////////////////////////////////////////////////////

    renderer: Renderer = new Renderer(this);

    getAllGraphicalNodes(): Node2d[] {
        return this.allGraphicalNodes;
    }

    get allGraphicalNodes(): Node2d[] {
        return this.allLayoutNodes.map(node => node.node2d).filter(node => node !== undefined) as Node2d[];
    }

    get allGraphicalLeafNodes(): Node2d[] {
        return this.allLayoutNodes.filter(node => node.children.length === 0)
            .map(node => node.node2d).filter(node => node !== undefined) as Node2d[];
    }

    getAllGraphicalConnections(ignoreNonRendered = true): Connection2d[] {
        const connections: Connection2d[] = [];
        this.allLayoutNodes.forEach(node => {
            connections.push(...node.outConnections
                .map(connection => connection.connection2d as Connection2d)
                .filter(connection => connection !== undefined)
                .filter(connection => !(ignoreNonRendered && !connection.layoutConnection.isRendered))
            );
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

    get debugShapes(): (Shape | Anchor)[] {
        const shapes: (Shape | Anchor)[] = [];
        this.allGraphicalNodes.forEach(n => {
            if (n.layoutNode.debugShapes.length > 0) {
                shapes.push(...n.layoutNode.debugShapes);
            }
        });

        this.allGraphicalConnections.forEach(l => {
            if (l.layoutConnection.debugShapes.length > 0) {
                shapes.push(...l.layoutConnection.debugShapes);
            }
        });

        shapes.push(...this.rootNode.debugShapes);

        return shapes;
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Style methods
    ////////////////////////////////////////////////////////////////////////////

    smallestExistingNodeSize: number = 0;

    updateGraphicalStyle() {

        // Get the node score extent
        const scoring = new NodeScoring();
        scoring.calculateExtent(this.allLayoutNodes)
        scoring.setColorScheme(this.commonSettings?.nodeScoreColorScheme.getValue() ?? "red-yellow-green");
        const validScores = scoring.isExtentValid();

        // Set the score colors of the nodes
        this.allGraphicalNodes.forEach(node => {

            if (!(this.commonSettings?.showNodeScore.getValue() ?? true)) {
                const v = scoring.getColor(0.5);
                node.updateStyleFill(v);
            } else {


                // node.updateStyleFill((n) => this.commonSettings.nodeColor.getValue(n), this.nodeScoring.extent);

                // if (!validScores) {
                //     const v = this.commonSettings?.nodeColor.getValue(node.layoutNode)?.toString() ?? "red";
                //     node.updateStyleFill(v);
                //     return;
                // }
                const v = scoring.getColor(node.score);
                // node.updateStyleFill(v);
                // const v = this.commonSettings?.nodeColor.getValue(node.layoutNode)?.toString() ?? "red";

                const color = (this.commonSettings?.showCommunityColors.getValue() ? node.layoutNode.color : v) ?? v;
                node.updateStyleFill(color);
            }

        })
        const userInteractions = this.userInteractions;


        const showHyperNodeEdges = this.commonSettings?.showHyperNodeEdges.getValue() ?? true;

        // Update the node stroke based on the communities
        this.allGraphicalNodes.forEach(node => {

            if (node.layoutNode.isHyperNode) {
                if (!showHyperNodeEdges) node.updateStyleStroke(undefined, undefined, 0);
                else node.updateStyleStroke(undefined, undefined, 1);
            }


            if (userInteractions.somethingIsSelectedOrFocusedOrHovered) {
                if (userInteractions.isHovered(node)) {
                    node.updateStyleStroke("black");
                    return;
                }
            }

            if (node.layoutNode.stroke) {
                node.updateStyleStroke(node.layoutNode.stroke);
                return;
            }

            if (!node.communities) {
                node.updateStyleStroke("white");
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
        this.allGraphicalNodes.forEach(node => {
            let opacity = 1;
            if (userInteractions.somethingIsSelectedOrFocusedOrHovered) {
                if (userInteractions.isHovered(node)) {
                    opacity = 1;
                } else if (userInteractions.isAdjacentToHovered(node.id)) {
                    opacity = 0.8;
                }
                else {
                    opacity = 0.1;
                }
            }
            node.updateStyleOpacity(opacity);
        })

        // Update the links opacity based on the user interactions and
        // the width based on the weight

        const wMultiplier = this.commonSettings?.linkWidthMultiplier.getValue() ?? 1;

        const stroke = this.commonSettings?.linkColor.getValue()?.toString() ?? "black";
        let strokeWithoutAlpha = d3.color(stroke)?.copy({ opacity: 1 })?.toString() ?? "black";
        const alpha = d3.color(stroke)?.opacity ?? 1;

        const showLinkScore = this.commonSettings?.showLinkScore.getValue() ?? true;

        this.allGraphicalConnections.forEach(connection => {
            if (!showLinkScore) {
                connection.updateStyleOpacity(alpha);
                connection.updateStyleStroke(strokeWithoutAlpha, wMultiplier);
                return;
            }
            const weight = connection.weight;
            const connWidth = connection.layoutConnection.width;
            let opacity = Math.min(Math.max(0.01, weight), 1) * alpha;

            if (!(this.commonSettings?.enableLinkOpacity.getValue() ?? true)) {

                // opacity = Math.max(0.6, opacity);

                // If we cannot display opacity, we have to adapt the stroke color by mixing it with white
                const c: d3.RGBColor = d3.color(stroke)!.rgb();

                const blend = (channel: number) => Math.round(channel * opacity + 255 * (1 - opacity));
                const r = blend(c.r);
                const g = blend(c.g);
                const b = blend(c.b);

                opacity = 1;
                strokeWithoutAlpha = d3.rgb(r, g, b).toString();
            }

            const startNode = connection.source;
            const endNode = connection.target;
            // const sizeMultiplier = Math.max(startNode.parent?.sizeFactor ?? 1, endNode.parent?.sizeFactor ?? 1);
            // const sizeMultiplier = 1;
            // const width = Math.min(maxW, Math.max(minW, weight * wMultiplier * sizeMultiplier));


            if (userInteractions.somethingIsSelectedOrFocusedOrHovered) {
                const startNode = connection.source;
                const endNode = connection.target;

                if (userInteractions.isHovered(connection.layoutConnection)) {
                    opacity = alpha;
                } else if (userInteractions.isHovered(startNode) || userInteractions.isHovered(endNode)) {
                    opacity = alpha;
                } else {
                    opacity *= 0.05;
                    // opacity *= 0.0;
                }
            }


            // if (connection.layoutConnection.isHyperConnection && connection.layoutConnection.children.length == 1) {
            //     opacity = 0;
            // }
            
            connection.updateStyleOpacity(opacity);
            connection.updateStyleStroke(strokeWithoutAlpha, connWidth);
        })

        this.allGraphicalNodes.forEach(node => {
            const showNodeNames = this.commonSettings?.displayNodeLabels.getValue() ?? false;
            if (showNodeNames) {


                if (node.id.startsWith("p")) {
                    node.updateLabelVisibility(false);
                } else {
                    node.updateLabelVisibility(node.layoutNode.showLabel);
                }

            } else {
                node.updateLabelVisibility(false);
            }
        })

    }

    setEdgeVisibility({ hyperEdges = true, edgesIncludedInHyperEdges = true, virtualEdges = false }) {
        this.allLayoutConnections.forEach(connection => {
            if (connection.isHyperConnection) {
                connection.isRendered = hyperEdges;
            } else if (connection.isPrimaryConnection) {
                connection.isRendered = edgesIncludedInHyperEdges;
            }

            if (connection.isThroughVirtualNodes) {
                connection.isRendered = virtualEdges;
            }
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Hierarchy methods
    ////////////////////////////////////////////////////////////////////////////
    private _hyperNodeId = 0;

    getNewHyperNodeId() {
        return `__hypernode_${this._hyperNodeId++}`;
    }

    moveNodesToParent(nodes: LayoutNode[], parentNode: LayoutNode) {
        LayoutNode.moveNodesToParent(nodes, parentNode);
    }

    combineNodesIntoHyperNode(nodes: LayoutNode[], parentNode: LayoutNode = this.rootNode) {
        const hyperNode = new LayoutNode(this, this.getNewHyperNodeId());
        this.addNode(hyperNode, parentNode);
        this.moveNodesToParent(nodes, hyperNode);
        return hyperNode;
    }

    combineConnectedComponents() {
        // Create a clusterer instance to identify connected components
        const clusterer = new Clusterer(this);

        // Get only top-level nodes (nodes directly under the root) for connected component analysis
        // This is important when called after combineCommunities, as we want to group hypernodes
        const topLevelNodes = this.rootNode.children;

        // Get connected components from these top-level nodes
        const connectedComponents = clusterer.getConnectedComponents(topLevelNodes);

        // If there's only one connected component, no need to combine
        if (connectedComponents.length <= 1) {
            console.log("Only one connected component found, no grouping needed");
            return;
        }

        console.log(`Found ${connectedComponents.length} separate connected components`);

        // Create a hypernode for each connected component
        connectedComponents.forEach((component, index) => {
            // Only create a hypernode if there are multiple nodes in the component
            if (component.length > 1) {
                const hyperNode = new LayoutNode(this, `__connected_component_${index}`);
                this.addNode(hyperNode, this.rootNode);

                // Move all nodes in this component to the new hypernode
                this.moveNodesToParent(component, hyperNode);

                // Set some styling for the hypernode
                hyperNode.filled = false;
                hyperNode.stroke = "darkgray";
                hyperNode.strokeWidth = 2;
                hyperNode.showLabel = false;
            }
        });

        // Update hyperconnections
        this.updateHyperConnections();
    }

    combineCommunities(communityNodeIds: (LayoutNode | string)[][], parentNode: LayoutNode = this.rootNode) {

        // Knoten aufsplitten, die zu mehreren Communities gehören
        // - Die Verbindungen werden kopiert und gefiltert, jeder Teilknoten behält nur folgende Verbindungen:
        //   - Verbindungen innerhalb des eigenen Hypernodes
        //   - Verbindungen zu den anderen Teilknoten (werden implizit angezeigt)
        //   - Verbindungen zu externen Knoten, die nicht innerhalb von anderen Hypernodes liegen, die durch einen anderen Teilknoten abgedeckt werden

        const communities = communityNodeIds.map(community => community.map(node => this.getNode(node)));

        const nodesHavingMultipleCommunities = this.allLayoutNodes.filter(node => {
            return communities.filter(community => community.includes(node)).length > 1;
        });

        // console.warn("Communities", communityNodeIds)
        console.log("Nodes having multiple communities", nodesHavingMultipleCommunities);

        nodesHavingMultipleCommunities.forEach(node => {
            if (node.children.length > 0) {
                console.error("Node having multiple communities has children, this should not happen");
            }
            let i = 0;

            const communitiesWithNode = communities.filter(community => community.includes(node));

            communitiesWithNode.forEach(community => {
                const allNodeIdsInCommunitiesWithNode = new Set(communitiesWithNode.flat().map(node => node.id));

                const splitNode = node.clone(node.id + `_${i++}`);
                node.addSplitChild(splitNode);

                // Remove the old node from this community and add the split node
                community.splice(community.indexOf(node), 1, splitNode);

                const nodeIdsInThisCommunity = community.map(node => node.id);
                // In this community, there are also implicitly all nodes of other communities having this split (child-)node in it
                const nodeIdsInOtherCommunitiesConnectedWithSplitNode = communitiesWithNode.filter(c => c !== community).flat().map(node => node.id);
                const setNodeIdsInOtherCommunitiesConnectedWithSplitNode = new Set(nodeIdsInOtherCommunitiesConnectedWithSplitNode);

                const setNodeIdsInThisCommunity = new Set(nodeIdsInThisCommunity);
                const nodesNotInThisCommunity = Array.from(allNodeIdsInCommunitiesWithNode).filter(id => !setNodeIdsInThisCommunity.has(id));
                const setNodesNotInThisCommunity = new Set(nodesNotInThisCommunity);

                // console.log({
                //     id: splitNode.id,
                //     splitNode,
                //     nodeIdsInThisCommunity,
                //     nodesNotInThisCommunity,
                //     nodeIdsInOtherCommunitiesConnectedWithSplitNode
                // })

                // Filter connections
                splitNode.removeConnections(connection => {
                    // return false;
                    const sourceId = connection.source.id;
                    const targetId = connection.target.id;
                    // const otherNode = sourceId === node.id ? connection.target : connection.source;

                    if (setNodeIdsInThisCommunity.has(sourceId) && setNodeIdsInThisCommunity.has(targetId)) {
                        return false;
                    }

                    if (setNodesNotInThisCommunity.has(sourceId) || setNodesNotInThisCommunity.has(targetId)) {
                        return true;
                    }

                    if (setNodeIdsInOtherCommunitiesConnectedWithSplitNode.has(sourceId) || setNodeIdsInOtherCommunitiesConnectedWithSplitNode.has(targetId)) {
                        return true;
                    }

                    return false;
                })


            })

            this.removeNode(node);
        });

        // console.log("Communities after splitting", communities);

        const colorScheme = d3.interpolateRainbow;
        const normalRange = [0, 1];
        const splitRange = [0, 1]
        if (nodesHavingMultipleCommunities.length > 0) {
            normalRange[1] = 0.6;
            splitRange[0] = 0.6;
        }

        const normalRangeDiff = normalRange[1] - normalRange[0];
        const splitRangeDiff = splitRange[1] - splitRange[0];

        // Combine the nodes into hypernodes
        communities.forEach((nodes, i, arr) => {

            // if (nodes.length <= 1) return;

            const hypernode = this.combineNodesIntoHyperNode(nodes, parentNode);


            // Set style of the hypernode
            const startPositionInScheme = i / arr.length;
            const interval = 1 / arr.length;
            const intervalPadding = 0.2;
            const start = normalRange[0] + normalRangeDiff * (startPositionInScheme + intervalPadding / 2);
            const end = normalRange[0] + normalRangeDiff * (startPositionInScheme + interval - intervalPadding / 2);
            // const color = colorScheme(i / arr.length);

            // hypernode.childrenColorScheme = colorScheme;
            // hypernode.childrenColorSchemeRange = [start, end];
            hypernode.applyChildrenColorScheme(colorScheme, [start, end]);
            hypernode.filled = false;
            hypernode.stroke = colorScheme(startPositionInScheme + interval / 2);
            hypernode.strokeWidth = nodes.length;
            hypernode.showLabel = false;
        });

        // Adapt the colors of split children, so that they have a common color
        nodesHavingMultipleCommunities.forEach((node, i) => {
            const splitChildren = node.splitChildren;

            const startPositionInScheme = i / nodesHavingMultipleCommunities.length;
            const interval = 1 / nodesHavingMultipleCommunities.length;
            const intervalPadding = 0.2;
            const start = splitRange[0] + splitRangeDiff * (startPositionInScheme + intervalPadding / 2);
            const end = splitRange[0] + splitRangeDiff * (startPositionInScheme + interval - intervalPadding / 2);

            splitChildren.forEach((child, j) => {
                const color = colorScheme(start + (end - start) * (j / splitChildren.length));
                child.color = color;
                child.stroke = color;
            });
        })

        this.updateHyperConnections();
    }

    addVirtualCommunityNodes() {

        // Detect nodes, that have connections to other communities
        // We assume, that in this stage communities are represented by first layer hypernodes

        const connectionsToDelete: LayoutConnection[] = [];

        this.allLeafLayoutNodes.forEach(node => {
            const connectedComms = this.getCommunitiesOfConnectionsOfNode(node);
            if (connectedComms.length > 0) {
                // nodesWithOtherCommunityConnections.set(node, connectedComms);
                console.log("Node", node.id, "is connected to communities", connectedComms.map(c => c.id));

                // For each node n, with n being in community c_n:
                // For each other community c_i n has connections to, create a virtual node n_i in c_i
                // Connect all nodes in c_i that have connections to n with n_i
                // Connect n with n_i

                connectedComms.forEach(comm => {

                    // Create a virtual node in the other community

                    const virtualNode = node.clone(`${node.id}_in_${comm.id}`, {
                        cloneConnections: false,
                        parent: comm
                    });
                    virtualNode.label = node.label ?? node.id;
                    // node.addSplitChild(virtualNode);
                    node.addVirtualChild(virtualNode);

                    // Connect all nodes in the other community that are connected to the node with the virtual node
                    comm.children.forEach(node_in_comm => {
                        if (node_in_comm === node) return;
                        // console.log("Move connection of node", node_in_comm.id, "from", node.id, "to", virtualNode.id);
                        const toDelete1 = this.moveConnectionsBetweenNodes(node_in_comm, node, node_in_comm, virtualNode, false);
                        const toDelete2 = this.moveConnectionsBetweenNodes(node, node_in_comm, virtualNode, node_in_comm, false);

                        connectionsToDelete.push(...toDelete1.connectionsToDelete);
                        connectionsToDelete.push(...toDelete2.connectionsToDelete);
                    });

                    const lOut = virtualNode.outConnections.length;
                    const lIn = virtualNode.inConnections.length;

                    // Connect the node with the virtual node
                    // if (lOut > 0) {
                    //     this.addHyperConnection(node, virtualNode, virtualNode.outConnections, true);
                    // }
                    // if (lIn > 0) {
                    //     this.addHyperConnection(virtualNode, node, virtualNode.inConnections, true);
                    // }

                })
            }
        })

        // connectionsToDelete.forEach(connection => {
        //     console.log("Remove connection", `${connection.source.id} -> ${connection.target.id}`);
        //     this.removeConnection(connection);
        // });



    }


    updateHyperConnections() {

        // Create new connections between the hypernodes.
        // For this, each connection between nodes that have different parents is replaced by a connection between hypernodes with the same parent.

        // // First reset all parent connections

        // First reset all hyper connections
        this.allLayoutNodes.forEach(node => {
            node.removeCalculatedHyperConnections();
        });
        this.allLayoutConnections.forEach(connection => {
            connection.parent = undefined;
        });

        this.getLayeredLayoutNodes(true).forEach(layer => {
            layer.forEach(node => {
                node.outConnections.forEach(connection => {
                    const source = connection.source;
                    const target = connection.target;
                    if (!source.parent || !target.parent) return;

                    const firstCommonParent = LayoutNode.firstCommonParent(source, target);

                    if (source.parent !== target.parent) {
                        const sourceParent = source.parent;
                        const targetParent = target.parent;

                        const sourceHypernode = source.getFirstParentByCondition((p) => p.parent == firstCommonParent) ?? source
                        const targetHypernode = target.getFirstParentByCondition((p) => p.parent == firstCommonParent) ?? target

                        this.addHyperConnection(sourceHypernode, targetHypernode, connection, false);

                        // connection.visible = false;
                    }
                });

            });
        })

        // console.log("Connections", this.allLayoutConnections.length, this.allLayoutConnections);
    }

    // If a node only has connections to a single other node in this layer, we can add it as subnode
    combineStronglyCoupledNodes() {

        const nodeToSingleParent = new Map<LayoutNode, LayoutNode>();

        // 1. Phase: Strongly coupling
        // - Every node with exactly one connected node is assigned to this node
        // - The nodes from Phase 1 are grouped together

        /**
         * Returns a single connected node, if the node has exactly one parent or child node.
         * @param node The node to check
         * @param filterOutNodes These nodes are not considered as connected nodes
         * @returns The single connected node, if it exists, undefined otherwise
         */
        const getSingleConnectedNode = (node: LayoutNode, filterOutNodes: LayoutNode[] = [], onlyWithSameParent = true) => {
            const outConnections = node.outConnections;
            const inConnections = node.inConnections;

            // Set of parent nodes to the node
            const sourceNodes = new Set([...inConnections.map(c => c.source)]);
            // Set of child nodes to the node
            const targetNodes = new Set([...outConnections.map(c => c.target)]);

            // Remove nodes that should be filtered out
            filterOutNodes.forEach(node => sourceNodes.delete(node));
            filterOutNodes.forEach(node => targetNodes.delete(node));

            if (onlyWithSameParent) {
                Array.from(sourceNodes).filter(n => n.parent !== node.parent).forEach(n => sourceNodes.delete(n));
                Array.from(targetNodes).filter(n => n.parent !== node.parent).forEach(n => targetNodes.delete(n));
            }

            // Nodes that are children of the node, but not parents
            const onlyTargetNodes = new Set([...targetNodes].filter(node => !sourceNodes.has(node)));
            // Nodes that are parents of the node, but not children
            const onlySourceNodes = new Set([...sourceNodes].filter(node => !targetNodes.has(node)));

            let _node: LayoutNode | undefined = undefined;

            // If there is a single source node and no other target nodes (that are not also the source node)
            if (sourceNodes.size === 1 && onlyTargetNodes.size === 0) {
                const source = sourceNodes.values().next().value!;
                _node = source;
            }
            // If there is a single target node and no other source nodes (that are not also the target node)
            else if (targetNodes.size === 1 && onlySourceNodes.size === 0) {
                const target = targetNodes.values().next().value!;
                _node = target;
            }

            if (onlyWithSameParent && _node && _node.parent !== node.parent) {
                return undefined;
            }

            return _node;
        }

        this.allLayoutNodes.forEach(node => {
            const singleParent = getSingleConnectedNode(node);
            if (singleParent) {
                nodeToSingleParent.set(node, singleParent);
            }
        });

        type Group = { anchor: LayoutNode, nodes: Set<LayoutNode> };
        const groups: Group[] = [];
        const nodeToGroup = new Map<LayoutNode, Group>();

        // Create the groups as result from phase 1
        nodeToSingleParent.forEach((parent, node) => {
            const group = nodeToGroup.get(parent) ?? { anchor: parent, nodes: new Set([parent]) };
            if (!nodeToGroup.has(parent)) {
                groups.push(group);
            }
            group.nodes.add(node);
            nodeToGroup.set(parent, group);
            nodeToGroup.set(node, group);
        })

        // 2. Phase: Pipelining
        // Every of these parent nodes is processed in a queue:
        // - If the parent node has exactly one parent, it is assigned to this parent
        //   --> this parent is added to the process queue
        // - If the parent node has multiple parents, it is not further processed
        // - If a node is parent of multiple nodes, it is not further processed
        // The existing groups are extended by parents from Phase 2, if these parents have only 1 child

        let changedGroups = Array.from(groups);
        // changedGroups = [];
        while (changedGroups.length > 0) {
            const nodeToChildren = new Map<LayoutNode, LayoutNode[]>();

            // Get the parents of each anchor node
            changedGroups.forEach(group => {
                const anchor = group.anchor;
                // Ignore the nodes of the group for the single connected node check
                const parentOfAnchor = getSingleConnectedNode(anchor, Array.from(group.nodes));
                if (parentOfAnchor) {
                    nodeToChildren.set(parentOfAnchor, [...(nodeToChildren.get(parentOfAnchor) ?? []), anchor]);
                }
            })

            changedGroups = [];

            // For each group, in which the anchor has only one parent, assign the anchor to the parent
            nodeToChildren.forEach((children, parent) => {
                if (children.length === 1) {


                    const child = children[0];
                    const group = nodeToGroup.get(child);
                    if (!group) {
                        console.error("Group not found for child", child, groups, nodeToGroup);
                        return;
                    }

                    // Special case: If the child is also parent of the current parent, the both groups are merged
                    if (nodeToChildren.has(child)) {
                        const childrenOfChild = nodeToChildren.get(child)!;
                        if (childrenOfChild.length === 1 && childrenOfChild[0] === parent) {
                            const parent1 = parent;
                            const parent2 = child;
                            const otherGroup = nodeToGroup.get(parent1);

                            const _parent = parent1.score > parent2.score ? parent1 : parent2;

                            // Move the nodes of the other group to the new group
                            otherGroup?.nodes.forEach(node => {
                                nodeToGroup.set(node, group);
                            })
                            nodeToGroup.set(_parent, group);

                            (otherGroup?.nodes ?? []).forEach(node => group.nodes.add(node));
                            group.anchor = _parent;

                            // Remove the other group
                            groups.splice(groups.indexOf(otherGroup!), 1);

                            changedGroups.push(group);
                            return;
                        }
                    }

                    group.anchor = parent;
                    group.nodes.add(parent);
                    nodeToGroup.set(parent, group);
                    changedGroups.push(group);
                }
            })
        }

        console.log("Groups", groups);

        // Combine the nodes into hypernodes
        groups.forEach(group => {
            const nodes = Array.from(group.nodes);
            const anchorNode = group.anchor;

            const hypernode = this.combineNodesIntoHyperNode(nodes, anchorNode?.parent);
            hypernode.anchorNode = anchorNode;
            hypernode.filled = false;
            hypernode.showLabel = false;
            hypernode.stroke = "gray"
            hypernode.strokeWidth = nodes.length;
        });

        // Update the hyper connections
        this.updateHyperConnections();
    }

    // If a node is broadcasting to every other node in this layer, we can add it to each node as subnode
    combineBroadcastingNodes() {

    }

    // Groups of nodes, that are connected to the same predecessor and successor nodes, are combined
    combineBySimilarConnections() {

    }




}
