import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { AbstractConnection2d, AbstractNode2d, Point2D } from "src/graph/graphical";
import { ViscomLayouterSettings } from "./viscomSettings";
import { GraphLayouter } from "../layouter";


class ViscomHyperNode {

    layouter: ViscomLayouter;
    center: Point2D = new Point2D(0, 0);
    nodes: AbstractNode2d[];
    radius: number = 0;

    constructor(layouter: ViscomLayouter, nodes: AbstractNode2d[]) {

        this.layouter = layouter;
        this.nodes = nodes;

        const ctx = this.layouter.settings.getContext({ nodes: this.nodes });

        const radius = this.layouter.settings.size.radius.getValue(ctx) ?? 5;
        this.radius = radius;

        console.log("New hypernode", this);
    }

    layout() {

        const sorter = this.layouter.settings.sorting.getSorter(this.layouter.commGraph);
        const nodes = sorter.getSorting2dNodes(this.layouter.graph2d, this.nodes.map(n => this.layouter.commGraph.getNode(n.id)!));

        // Place nodes on a circle with radius
        const angleStep = 2 * Math.PI / nodes.length;
        nodes.forEach((node, i) => {
            node.x = this.radius * Math.cos(i * angleStep) + this.center.x;
            node.y = this.radius * Math.sin(i * angleStep) + this.center.y;
        });
    }

}


export class ViscomLayouter extends GraphLayouter<ViscomLayouterSettings> {


    layout(isUpdate = false) {

        const hyperNodes: ViscomHyperNode[] = [];
        this.commGraph.communities.communities.forEach(community => {
            const nodesInComm = community.nodeIds.map(id => this.graph2d.getNode(id)!);
            const hyperNode = new ViscomHyperNode(this, nodesInComm);
            hyperNodes.push(hyperNode);
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

        // this.emitEvent("update");
        this.emitEvent("end");
    }
}
