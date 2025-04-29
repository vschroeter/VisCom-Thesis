

import { Point, Shape, Vector } from "2d-geometry";
import { CommunicationChannel, CommunicationGraph, CommunicationLink, CommunicationNode, CommunicationTopic } from "../commGraph";
import { CommonSettings } from "../layouter/settings/commonSettings";

import * as d3 from "d3";
import { LayoutNode } from "./layoutNode";
import { Anchor, Connection2d, EllipticArc } from "../graphical";
import { BaseConnectionLayouter } from "./layouterComponents/connectionLayouter";
import { DefaultPathSegment, PathSegment } from "../graphical/primitives/pathSegments/PathSegment";

export type InstanceOrGetter<T> = T | ((node: LayoutConnection) => T | undefined);


export class VisLink {

    // The topic of the link
    topic: CommunicationTopic;
    // The channel of the link
    channel: CommunicationChannel;
    // The weight of the link
    weight: number = 1;

    constructor(link: CommunicationLink) {
        this.topic = link.topic;
        this.channel = link.channel;
        this.weight = link.weight;
    }
}

export type LayoutConnectionPoint = Point | Anchor | PathSegment;
export type LayoutConnectionPoints = LayoutConnectionPoint[] | { startAnchor?: Anchor, endAnchor?: Anchor, points?: LayoutConnectionPoint[] };

export type CurveStyle = "linear" | "basis" | "natural" | d3.CurveFactory

export class LayoutConnection {
    // layouted: boolean = false;

    get visGraph() {
        return this.source.visGraph;
    }

    get commonSettings(): CommonSettings | undefined {
        return this.visGraph.commonSettings;
    }


    /** The source node of the connection */
    source: LayoutNode;
    /** The target node of the connection */
    target: LayoutNode;

    get id(): string {
        return `${this.fromId}->${this.toId}`;
    }

    debugShapes: (Shape | Anchor)[] = [];

    /** ID of the source node */
    get fromId(): string {
        return this.source.id;
    }

    /** ID of the target node */
    get toId(): string {
        return this.target.id;
    }

    /** The opposite connection, if it exists */
    opposite?: LayoutConnection;

    /** The single links of the connection.
     * A connection itself represents the connection from a start to a target node.
     * One single connection can have multiple links, which are the actual communication links between the nodes.
     */
    private links: VisLink[] = [];

    /**
     * If the connection is a hyperconnection, it can have children connections between the actual nodes.
     */
    children: LayoutConnection[] = [];

    // If the connection is a child of a hyperconnection, this is the parent hyperconnection.
    parent?: LayoutConnection;

    isCalculated: boolean = false;

    get isHyperConnection(): boolean {
        return this.children.length > 0;
    }

    get isPrimaryConnection(): boolean {
        return !!this.parent;
    }

    get hasParentHyperConnection(): boolean {
        return this.parent !== undefined;
    }

    // isThroughVirtualNodes: boolean = false;
    get isThroughVirtualNodes(): boolean {
        return this.getConnectionPathViaHyperAndVirtualNodes().slice(1, -1).some(node => node.isVirtual);
    }

    get isDirectVirtualConnection(): boolean {
        return this.getConnectionPathViaHyperAndVirtualNodes().length == 2 && (this.source.isVirtual || this.target.isVirtual);
    }

    /**
     * After combining links, the opposite links are stored here.
     */
    private oppositeLinks: VisLink[] = [];


    private _weight: number = 0;

    /** The weight of the connection. Is automatically calculated by the existing links. */
    get weight(): number {
        return this._weight;
    }

    get distance(): number {
        return 1 / this.weight ** 2;
    }

    // The object defining the path of the connection
    pathSegment?: PathSegment = undefined;

    get pathOrDefault(): PathSegment {
        return this.pathSegment ?? new DefaultPathSegment(this);
    }

    /** The start anchor of the connection */
    get startAnchor(): Anchor | undefined {
        return this.pathOrDefault.startAnchor;
    }
    /** The end anchor of the connection */
    get endAnchor(): Anchor | undefined {
        return this.pathOrDefault.endAnchor;
    }

    get width(): number {
        const minWeight = 0.1;
        const maxWeight = 2;

        const scale = d3.scaleLinear()
        // const scale = d3.scaleLog()
            .domain([minWeight, maxWeight])
            .range([minWeight, maxWeight])
            .clamp(true);

        const width = scale(this.weight);
        const multiplier = this.commonSettings?.linkWidthMultiplier.getValue() ?? 1;
        return width * multiplier;
    }


    get arrowLength(): number {
        const width = this.width;
        const calculatedLength = (this.commonSettings?.arrowSize.getValue() ?? 5) * width;
        return calculatedLength * 0.8;
    }


    // /** All points combined */
    // get combinedPoints(): LayoutConnectionPoint[] {
    //     const points: LayoutConnectionPoint[] = [];
    //     if (this.points.length > 0 && this.points[0] != this.startAnchor) {
    //         if (this.startAnchor) points.push(this.startAnchor);
    //     }

    //     points.push(...this.points);

    //     if (this.points.length > 0 && this.points[this.points.length - 1] != this.endAnchor) {
    //         if (this.endAnchor) points.push(this.endAnchor);
    //     }

    //     return points;
    // }

    // setPoints(points: LayoutConnectionPoints) {
    //     if (Array.isArray(points)) {
    //         this.points = points;
    //     } else {
    //         this.startAnchor = points.startAnchor;
    //         this.endAnchor = points.endAnchor;
    //         this.points = points.points ?? [];
    //     }
    // }

    finishedLayouting: boolean = false;

    /** The style of the curve */
    curveStyle: CurveStyle = "linear"

    connector?: InstanceOrGetter<BaseConnectionLayouter>;

    /** The graphical representation of the connection */
    connection2d?: Connection2d;

    isRendered: boolean = true;

    ////////////////////////////////////////////////////////////////////////////
    // #region Constructor
    ////////////////////////////////////////////////////////////////////////////

    constructor(source: LayoutNode, target: LayoutNode) {
        this.source = source;
        this.target = target;
    }

    /**
     * Creates a new connection copied from an existing connection.
     * @param connection The connection to copy from.
     * @returns A new connection copied from the existing connection.
     */
    static copyFromConnection(connection: LayoutConnection): LayoutConnection {
        const newConnection = new LayoutConnection(connection.source, connection.target);
        // newConnection.layouted = connection.layouted;
        newConnection._weight = connection._weight;
        newConnection.links = Array.from(connection.links);
        newConnection.oppositeLinks = Array.from(connection.oppositeLinks);
        newConnection.children = Array.from(connection.children.map(child => child.clone()));
        return newConnection;
    }

    /**
     * Creates a new connection from a communication link.
     * @returns The cloned connection.
     */
    clone(): LayoutConnection {
        return LayoutConnection.copyFromConnection(this);
    }

    /**
     * Combines the list of connections. This means combining links in opposite directions and returning the combined direction with the greater weight.
     * @param connections The connections to combine.
     * @returns The combined connections.
     */
    static combineConnections(connections: LayoutConnection[]): LayoutConnection[] {

        const combinedConnections: LayoutConnection[] = [];

        connections.forEach(connection => {
            const opposite = connection.opposite;
            const newConnection = LayoutConnection.copyFromConnection(connection);
            if (opposite) {
                newConnection.addOppositeLinks(opposite.getLinks());
            }
            combinedConnections.push(newConnection);
        });

        return combinedConnections.filter(connection => connection._weight > 0.001);
    }

    remove() {
        this.source.visGraph.removeConnection(this);
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Link methods
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Adds links to the connection.
     * @param link The link to add to the connection.
     */
    addLinks(link: VisLink | VisLink[]) {
        const links = Array.isArray(link) ? link : [link];
        links.forEach(link => {
            this.links.push(link);
            this._weight += link.weight;
        });
    }

    /**
     * Adds child connections to the connection.
     */
    addChildren(connections: LayoutConnection | LayoutConnection[]) {
        const children = Array.isArray(connections) ? connections : [connections];
        children.forEach(connection => {
            this.children.push(connection);
            if (connection.parent) {
                console.error("Connection already has a parent. This should not happen.");
            }
            connection.parent = this;
            this._weight += connection.weight;
        });
    }

    /**
     * Adds links as opposite links. TODO: At the moment, this is only used by the `combineConnections` method.
     * @param link The link to add as opposite link.
     */
    addOppositeLinks(link: VisLink | VisLink[]) {
        const links = Array.isArray(link) ? link : [link];
        links.forEach(link => {
            this.oppositeLinks.push(link)
            this._weight -= link.weight;
        });
    }

    /**
     * Gets the links of the connection.
     * @returns The links of the connection.
     */
    getLinks(): VisLink[] {
        return this.links;
    }


    /**
     * The opposite links of the connection. TODO: At the moment, these only exist after calling the `combineConnections` method.
     */
    getOppositeLinks(): VisLink[] {
        return this.oppositeLinks;
    }

    getSubNodePathViaHypernodes(): LayoutNode[] {
        const parentHyperConnection = this.parent!;
        const hyperStart = parentHyperConnection.source;
        const hyperEnd = parentHyperConnection.target;

        const nodes: LayoutNode[] = [];

        let currentNode: LayoutNode | undefined = this.source;

        nodes.push(this.source);
        while (currentNode?.parent && currentNode != hyperStart) {
            currentNode = currentNode.parent;
            nodes.push(currentNode);
        }

        currentNode = this.target;
        const endNodes: LayoutNode[] = [];
        endNodes.push(this.target);
        while (currentNode?.parent && currentNode != hyperEnd) {
            currentNode = currentNode.parent;
            endNodes.push(currentNode);
        }

        nodes.push(...endNodes.reverse());

        return nodes;
    }

    getConnectionPathViaHyperAndVirtualNodes(): LayoutNode[] {
        const startNode = this.source;
        const endNode = this.target;

        const nodes: LayoutNode[] = [];

        const parentHyperConnection = this.parent;

        if (!parentHyperConnection) {
            return [startNode, endNode];
        }

        const hyperStart = parentHyperConnection.source;
        const hyperEnd = parentHyperConnection.target;

        let currentNode: LayoutNode | undefined = this.source;

        nodes.push(startNode);
        while (currentNode?.parent && currentNode != hyperStart) {
            const virtualNode = currentNode.parent?.existingVirtualChildren.get(endNode.id);
            if (virtualNode) {
                // console.log("Virtual node found", {
                //     virtualNode: virtualNode.id,
                //     startNode: startNode.id,
                //     endNode: endNode.id,
                // });
                nodes.push(virtualNode);
            }
            currentNode = currentNode.parent;
            nodes.push(currentNode);
        }

        currentNode = this.target;
        const endNodes: LayoutNode[] = [];
        endNodes.push(this.target);
        while (currentNode?.parent && currentNode != hyperEnd) {
            const virtualNode = currentNode.parent?.existingVirtualChildren.get(startNode.id);
            if (virtualNode) {
                // console.log("Virtual node found", {
                //     virtualNode: virtualNode.id,
                //     startNode: startNode.id,
                //     endNode: endNode.id,
                // });
                endNodes.push(virtualNode);
            }
            currentNode = currentNode.parent;
            endNodes.push(currentNode);
        }

        nodes.push(...endNodes.reverse());

        return nodes;
    }

    static combineInAndOutLinks(connections: LayoutConnection[]): LayoutConnection[] {

        const combinedConnections: LayoutConnection[] = [];

        const mapFromIdToToIdToLink = new Map<string, Map<string, LayoutConnection>>();
        connections.forEach(connection => {
            if (!mapFromIdToToIdToLink.has(connection.fromId)) {
                mapFromIdToToIdToLink.set(connection.fromId, new Map());
            }
            const mapToIdToLink = mapFromIdToToIdToLink.get(connection.fromId)!;
            if (!mapToIdToLink.has(connection.toId)) {
                mapToIdToLink.set(connection.toId, connection.cloneSimple());
            } else {
                const existingLink = mapToIdToLink.get(connection.toId)!;
                existingLink._weight += connection._weight;
            }
        })

        const mergedConns: LayoutConnection[] = [];
        mapFromIdToToIdToLink.forEach(mapToIdToLink => {
            mapToIdToLink.forEach(link => {
                mergedConns.push(link);
            });
        });

        const combinedLinksMap = new Map<string, Map<string, LayoutConnection>>();

        mergedConns.forEach(conn => {
            if (!combinedLinksMap.has(conn.fromId)) {
                combinedLinksMap.set(conn.fromId, new Map());
            }

            combinedLinksMap.get(conn.fromId)!.set(conn.toId, conn.cloneSimple());
        })


        const epsilon = 0.001;
        mergedConns.forEach(_conn => {
            const conn = combinedLinksMap.get(_conn.fromId)?.get(_conn.toId);
            const oppositeConn = combinedLinksMap.get(_conn.toId)?.get(_conn.fromId);

            if (!conn && !oppositeConn) {
                return;
            }

            if (conn && oppositeConn) {

                const weight = conn.weight - oppositeConn.weight;

                if (weight > epsilon) {
                    conn._weight = weight;
                    combinedConnections.push(conn);
                } else if (weight < -epsilon) {
                    oppositeConn._weight = -weight;
                    combinedConnections.push(oppositeConn);
                }

                combinedLinksMap.get(conn.fromId)?.delete(conn.toId);
                combinedLinksMap.get(conn.toId)?.delete(conn.fromId);
                return;
            }

            if (!conn && oppositeConn) {
                combinedConnections.push(oppositeConn!);
                combinedLinksMap.get(oppositeConn.fromId)?.delete(oppositeConn.toId);
                return;
            }

            if (!oppositeConn && conn) {
                combinedConnections.push(conn);
                combinedLinksMap.get(conn.fromId)?.delete(conn.toId);
                return;
            }
        });

        return combinedConnections;
    }

    cloneSimple(): LayoutConnection {
        const newConnection = new LayoutConnection(this.source, this.target);
        newConnection._weight = this._weight;
        return newConnection;
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Graphical methods
    ////////////////////////////////////////////////////////////////////////////

    protected getInstance<T>(instanceOrGetter: InstanceOrGetter<T>): T | undefined {
        if (instanceOrGetter instanceof Function) {
            return instanceOrGetter(this);
        }
        return instanceOrGetter;
    }

    calculateLayoutPoints(layouterOverride?: BaseConnectionLayouter) {
        const _connector = this.getInstance(layouterOverride ?? this.connector);
        if (!_connector) {
            return;
        }
        _connector.layoutConnection(this);
    }

    createGraphicalElements() {
        if (!this.connection2d) {
            this.connection2d = new Connection2d(this);
        }
    }

    updatePoints() {
        this.connection2d?.updatePath();
    }

    resetPoints() {
        // this.pathSegment = new DefaultPathSegment(this);
        this.pathSegment = undefined;

        this.finishedLayouting = false;
    }





    // totalWeight(): number {
    //     return this.links.reduce((acc, link) => acc + link.weight, 0);
    // }

}
