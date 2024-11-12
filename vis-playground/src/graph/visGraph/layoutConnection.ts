

import { Point } from "2d-geometry";
import { CommunicationChannel, CommunicationGraph, CommunicationLink, CommunicationNode, CommunicationTopic } from "../commGraph";
import { CommonSettings } from "../layouter/settings/commonSettings";

import * as d3 from "d3";
import { LayoutNode } from "./layoutNode";
import { Connection2d } from "../graphical";

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

export class LayoutConnection {
    // layouted: boolean = false;

    source: LayoutNode;
    target: LayoutNode;

    connection2d?: Connection2d;

    get fromId(): string {
        return this.source.id;
    }

    get toId(): string {
        return this.target.id;
    }

    opposite?: LayoutConnection;

    private links: VisLink[] = [];
    private oppositeLinks: VisLink[] = [];

    weight: number = 0;

    constructor(source: LayoutNode, target: LayoutNode) {
        this.source = source;
        this.target = target;
    }

    addLinks(link: VisLink | VisLink[]) {
        const links = Array.isArray(link) ? link : [link];
        links.forEach(link => {
            this.links.push(link);
            this.weight += link.weight;
        });
    }

    addOppositeLinks(link: VisLink | VisLink[]) {
        const links = Array.isArray(link) ? link : [link];
        links.forEach(link => {
            this.oppositeLinks.push(link)
            this.weight -= link.weight;
        });
    }

    getLinks(): VisLink[] {
        return this.links;
    }

    getOppositeLinks(): VisLink[] {
        return this.oppositeLinks;
    }

    createGraphicalElements() {
        this.connection2d = new Connection2d(this);
    }


    static copyFromConnection(connection: LayoutConnection): LayoutConnection {
        const newConnection = new LayoutConnection(connection.source, connection.target);
        // newConnection.layouted = connection.layouted;
        newConnection.weight = connection.weight;
        newConnection.links = connection.links;
        newConnection.oppositeLinks = connection.oppositeLinks;
        return newConnection;
    }

    // totalWeight(): number {
    //     return this.links.reduce((acc, link) => acc + link.weight, 0);
    // }

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

        return combinedConnections.filter(connection => connection.weight > 0.001);
    }
}
