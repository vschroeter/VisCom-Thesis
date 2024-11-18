

import { Point } from "2d-geometry";
import { CommunicationChannel, CommunicationGraph, CommunicationLink, CommunicationNode, CommunicationTopic } from "../commGraph";
import { CommonSettings } from "../layouter/settings/commonSettings";

import * as d3 from "d3";
import { LayoutNode } from "./layoutNode";
import { Anchor, Connection2d, EllipticArc } from "../graphical";
import { BaseConnector } from "./layouterComponents/connector";

export type InstanceOrGetter<T> = T | ((node: LayoutConnection) => T);


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

export type LayoutConnectionPoint = Point | EllipticArc | Anchor;

export type CurveStyle = "linear" | "basis" | "natural" | d3.CurveFactory

export class LayoutConnection {
    // layouted: boolean = false;

    /** The source node of the connection */
    source: LayoutNode;
    /** The target node of the connection */
    target: LayoutNode;

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
     * After combining links, the opposite links are stored here.
     */
    private oppositeLinks: VisLink[] = [];


    private _weight: number = 0;

    /** The weight of the connection. Is automatically calculated by the existing links. */
    get weight(): number {
        return this._weight;
    }

    /** The points that define the connection layout */
    points: (Point | EllipticArc | Anchor)[] = []

    /** The style of the curve */
    curveStyle: CurveStyle = "linear"

    connector?: InstanceOrGetter<BaseConnector>;

    /** The graphical representation of the connection */
    connection2d?: Connection2d;



    ////////////////////////////////////////////////////////////////////////////
    // Creation methods
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
        return newConnection;
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

    ////////////////////////////////////////////////////////////////////////////
    // Link methods
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

    ////////////////////////////////////////////////////////////////////////////
    // Graphical methods
    ////////////////////////////////////////////////////////////////////////////

    protected getInstance<T>(instanceOrGetter: InstanceOrGetter<T>): T {
        if (instanceOrGetter instanceof Function) {
            return instanceOrGetter(this);
        }
        return instanceOrGetter;
    }

    connect(connector?: BaseConnector) {
        const _connector = this.getInstance(connector ?? this.connector);
        if (!_connector) {
            return;
        }
        _connector.layoutConnection(this);
    }

    createGraphicalElements() {
        this.connection2d = new Connection2d(this);
    }

    updatePoints() {
        this.connection2d?.updatePath();
    }



    // totalWeight(): number {
    //     return this.links.reduce((acc, link) => acc + link.weight, 0);
    // }

}
