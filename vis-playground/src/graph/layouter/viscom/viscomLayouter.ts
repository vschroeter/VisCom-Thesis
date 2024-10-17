import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { Connection2d, Node2d, Point2D } from "src/graph/graphical";
import { ViscomLayouterSettings } from "./viscomSettings";
import { GraphLayouter } from "../layouter";
import { RadialLayouter } from "../linear/radial/radialLayouter";
import { RadialLayouterSettings } from "../linear/radial/radialSettings";
import { MouseEvents } from "src/graph/visualizations/interactions";


class ViscomHyperNode {

    layouter: ViscomLayouter;
    subLayouter: RadialLayouter;
    // center: Point2D = new Point2D(0, 0);
    // nodes: Node2d[];
    radius: number = 0;

    constructor(layouter: ViscomLayouter, nodes: CommunicationNode[]) {

        this.layouter = layouter;
        this.subLayouter = new RadialLayouter({
            commGraph: layouter.commGraph,
            settings: new RadialLayouterSettings("radial"),
            commonSettings: layouter.commonSettings,
            nodes: nodes,
            userInteractions: layouter.userInteractions
        });

        this.radius = this.subLayouter.getRadius();
        console.log("New hypernode", this, nodes);
    }

    get center() {
        return this.subLayouter.center;
    }

    layout() {
        this.subLayouter.layout();
    }

}


export class ViscomLayouter extends GraphLayouter<ViscomLayouterSettings> {


    hyperNodes: ViscomHyperNode[] = [];

    layout(isUpdate = false) {

        const hyperNodes: ViscomHyperNode[] = [];
        // Create a hypernode for each community
        this.commGraph.communities.communities.forEach(community => {
            const nodesInComm = community.nodeIds.map(id => this.commGraph.getNode(id)!);
            const hyperNode = new ViscomHyperNode(this, nodesInComm);
            hyperNodes.push(hyperNode);
        });

        // this.commGraph.communities.communities.forEach(community => {
        //     const nodesInComm = community.nodeIds.map(id => this.graph2d.getNode(id)!);
        //     const hyperNode = new ViscomHyperNode(this, nodesInComm);
        //     hyperNodes.push(hyperNode);
        // });


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

        // this.emitEvent("update");
        this.emitEvent("end");
    }


    renderAll(selection: d3.Selection<SVGGElement | any, any, any, any>, events?: { nodesEvents?: MouseEvents<Node2d>; linksEvents?: MouseEvents<Node2d>; labelsEvents?: MouseEvents<Node2d>; }): void {
        console.log("Render all viscom layouter", this, this.hyperNodes);
        // Create a group for each hypernode
        selection.selectAll("g.hypernode")
            .data(this.hyperNodes)
            .join("g")
            .classed("hypernode", true)
            .each((hyperNode, i, g) => {
                hyperNode.subLayouter.renderAll(d3.select(g[i]), events);
            })
    }

}
