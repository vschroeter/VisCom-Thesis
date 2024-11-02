import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { Connection2d, Node2d } from "src/graph/graphical";
import { ViscomLayouterSettings } from "./viscomSettings";
import { GraphLayouter } from "../layouter";
import { RadialLayouter } from "../linear/radial/radialLayouter";
import { RadialLayouterSettings } from "../linear/radial/radialSettings";
import { MouseEvents } from "src/graph/visualizations/interactions";
import { Connection2dData } from "src/graph/graphical/Connection2d";


class ViscomHyperNode extends Node2d {

    parentLayouter: ViscomLayouter;
    layouter: RadialLayouter;
    // center: Point2D = new Point2D(0, 0);
    // nodes: Node2d[];
    // radius: number = 0;
    innerRadius: number = 0;

    constructor(parentLayouter: ViscomLayouter, nodes: CommunicationNode[], id: string) {

        super({ id: id })

        this.parentLayouter = parentLayouter;

        this.layouter = new RadialLayouter({
            commGraph: parentLayouter.commGraph,
            // settings: new RadialLayouterSettings("radial"),
            settings: parentLayouter.settings,
            commonSettings: parentLayouter.commonSettings,
            nodes: nodes,
            userInteractions: parentLayouter.userInteractions
        });
        this.layouter.center = this.center;

        this.innerRadius = this.layouter.getRadius();
        this.radius = this.innerRadius * 1.1 + 20;

        this.strokeStyle.stroke = "gray";
        this.strokeStyle.strokeWidth = 4;
        this.filled = false;

        // this.strokeWidth = 4;
        // this.stroke = "gray";
        // this.strokeOpacity = 0.3;
        console.log("New hypernode", this, nodes);
    }

    // get center() {
    //     return this.subLayouter.center;
    // }

    layout() {
        this.layouter.layout();
    }
}

export interface ViscomHyperLinkData extends Connection2dData {
    fromId: string;
    toId: string;

    fromCommNodeId: string;
    toCommNodeId: string;

}


export class ViscomLayouter extends GraphLayouter<ViscomLayouterSettings> {


    hyperNodes: ViscomHyperNode[] = [];

    override layout(isUpdate = false) {

        const hyperNodes: ViscomHyperNode[] = [];
        // Create a hypernode for each community
        this.commGraph.communities.communities.forEach((community, i) => {
            const nodesInComm = community.nodeIds.map(id => this.commGraph.getNode(id)!);
            const hyperNode = new ViscomHyperNode(this, nodesInComm, `__hypernode_${i}`);
            hyperNodes.push(hyperNode);
        });

        const graph2d = new Graph2d();
        this.graph2d = graph2d;

        graph2d.addNode2d(hyperNodes);

        // Now get the links between the hypernodes
        const hyperLinks: Connection2d<ViscomHyperLinkData>[] = [];
        hyperNodes.forEach((hn1, i) => {
            hyperNodes.forEach((hn2, j) => {
                if (j > i) {

                    const nodesInHn1 = hn1.layouter.nodes;
                    const nodesInHn2 = hn2.layouter.nodes;

                    const externalLinks = this.commGraph.getAllExternalLinksBetweenNodeGroups(nodesInHn1, nodesInHn2)
                    console.log("External links", externalLinks);
                    externalLinks.forEach(link => {
                        const l2d = graph2d.createLink2d<ViscomHyperLinkData>({ fromId: hn1.id, toId: hn2.id, fromCommNodeId: link.fromId, toCommNodeId: link.toId });
                        hyperLinks.push(l2d);
                    })
                }
            });
        });


        // Place hypernodes on a circle
        const angleStep = 2 * Math.PI / hyperNodes.length;

        // Circle have the max radius of all hypernodes
        const maxRadius = Math.max(...hyperNodes.map(hn => hn.radius));
        const hyperRadius = maxRadius * 2;

        console.log("Max radius", maxRadius);

        hyperNodes.forEach((hn, i) => {
            hn.center.x = hyperRadius * Math.cos(i * angleStep);
            hn.center.y = hyperRadius * Math.sin(i * angleStep);
        });

        // Layout the nodes
        hyperNodes.forEach(hn => hn.layout());
        this.hyperNodes = hyperNodes;

        this.updateStyle();

        // this.emitEvent("update");
        this.emitEvent("end");

        // Print all nodes and links
        console.log("nodes", this.commGraph.nodes);

        const links = this.commGraph.getAllLinks(undefined, 0.2);
        const merged = CommunicationLink.mergeLinks(links);

        console.log("links", this.commGraph.getAllLinks(undefined, 0.2).map(l => `${l.fromId} -> ${l.toId}: ${l.weight}`));
        console.log("merged", merged.map(l => `${l.fromId} -> ${l.toId}: ${l.weight}`));

        this.getFilteredLinks

    }

    override updateStyle(): void {
        super.updateStyle();
        this.hyperNodes.forEach(hn => hn.layouter.updateStyle());
    }

    override renderAll(events?: { nodesEvents?: MouseEvents<Node2d>; linksEvents?: MouseEvents<Connection2d>; labelsEvents?: MouseEvents<Node2d>; }): void {
        console.log("Render all viscom layouter", this, this.hyperNodes);

        const parent = this.gParent;

        if (!parent) {
            throw new Error("Parent group is not set");
        }

        super.renderAll();

        parent.selectChildren("g.hypernode")
            .data(this.hyperNodes).join("g")
            .classed("hypernode", true)
            .each((hyperNode, i, g) => {
                const a = d3.select(g[i] as SVGGElement);
                hyperNode.layouter.setParentGroup(a);
            })

        this.hyperNodes.forEach(hn => hn.layouter.renderAll(events));

    }

}
