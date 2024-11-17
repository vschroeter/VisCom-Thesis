import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { Connection2d, Node2d } from "src/graph/graphical";
import { ViscomLayouterSettings } from "./viscomSettings";
import { GraphLayouter } from "../layouter";
import { RadialCurvedConnector, RadialLayouter, RadialPositioner } from "../linear/radial/radialLayouter";
import { RadialLayouterSettings } from "../linear/radial/radialSettings";
import { MouseEvents } from "src/graph/visualizations/interactions";
import { Connection2dData } from "src/graph/graphical/Connection2d";
import { BasicPrecalculator } from "src/graph/visGraph/layouterComponents/precalculator";


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

    weight: number;
}


export class ViscomLayouter extends GraphLayouter<ViscomLayouterSettings> {
// export class ViscomLayouter extends RadialLayouter<ViscomLayouterSettings> {


    hyperNodes: ViscomHyperNode[] = [];

    hyperRadius: number = 0;

    // override getRadius(): number {
    //     return this.hyperRadius;
    // }

    override layout(isUpdate = false) {


        // Transform visgraph to hypergraph
        
        this.visGraph.combineCommunities(this.commGraph.communities.getAsIdLists());
        console.log("Combined communities", this.visGraph, this.commGraph.communities.getAsIdLists());

        this.visGraph.setPrecalculator(new BasicPrecalculator({ sizeMultiplier: 10 }));

        const sorter = this.settings.sorting.getSorter(this.visGraph, this.commonSettings);
        this.visGraph.setSorter(sorter);

        this.visGraph.setPositioner((node) => {
            // const radius = this.settings.size.radius.getValue(this.settings.getContext({ nodes: node.children })) ?? 100;
            // console.log("Radius", node, radius);

            const countChildren = node.children.length;

            // Get the max radius of the child nodes
            const maxChildRadius = Math.max(...node.children.map(n => n.radius));
            const radiusFactor = 2;

            const circumference = countChildren * (maxChildRadius * 2) * radiusFactor;
            const radius = circumference / (2 * Math.PI);

            return new RadialPositioner(radius);
        })

        const forwardBackwardThreshold = this.settings.edges.forwardBackwardThreshold.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 270;
        const straightForwardLineAtDegreeDelta = this.settings.edges.straightForwardLineAtDegreeDelta.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 135;
        const backwardLineCurvature = this.settings.edges.backwardLineCurvature.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 120;

        this.visGraph.setConnector(new RadialCurvedConnector({
            forwardBackwardThreshold,
            straightForwardLineAtDegreeDelta,
            backwardLineCurvature
        }));


        this.visGraph.layout();
        this.emitEvent("end");



        // const hyperNodes: ViscomHyperNode[] = [];
        // // Create a hypernode for each community
        // this.commGraph.communities.communities.forEach((community, i) => {
        //     const nodesInComm = community.nodeIds.map(id => this.commGraph.getNode(id)!);
        //     const hyperNode = new ViscomHyperNode(this, nodesInComm, `__hypernode_${i}`);
        //     hyperNodes.push(hyperNode);
        // });

        // const graph2d = new Graph2d();
        // this.graph2d = graph2d;

        // graph2d.addNode2d(hyperNodes);

        // // Now get the links between the hypernodes
        // const hyperLinks: Connection2d<ViscomHyperLinkData>[] = [];
        // hyperNodes.forEach((hn1, i) => {
        //     hyperNodes.forEach((hn2, j) => {
        //         if (j > i) {

        //             const nodesInHn1 = hn1.layouter.nodes;
        //             const nodesInHn2 = hn2.layouter.nodes;

        //             const externalLinks = this.commGraph.getAllExternalLinksBetweenNodeGroups(nodesInHn1, nodesInHn2, undefined, this.commonSettings.hideLinksThreshold.getValue())
        //             const mergedLinks = CommunicationLink.mergeLinks(externalLinks);
        //             console.log("External links", externalLinks);
        //             mergedLinks.forEach(link => {
        //                 const l2d = graph2d.createLink2d<ViscomHyperLinkData>({ fromId: hn1.id, toId: hn2.id, fromCommNodeId: link.fromId, toCommNodeId: link.toId, weight: link.weight });
        //                 hyperLinks.push(l2d);
        //             })
        //         }
        //     });
        // });

        // // const hyperGraph = CommunicationGraph.createMergedGraph(
        // //     {
        // //         originalGraph: this.commGraph,
        // //         communities: this.commGraph.communities.communities
        // //     }
        // // )

        // // Place hypernodes on a circle
        // const angleStep = 2 * Math.PI / hyperNodes.length;

        // // Circle have the max radius of all hypernodes
        // const maxRadius = Math.max(...hyperNodes.map(hn => hn.radius));
        // const hyperRadius = maxRadius * 2;
        // this.hyperRadius = hyperRadius;

        // console.log("Max radius", maxRadius);

        // hyperNodes.forEach((hn, i) => {
        //     hn.center.x = hyperRadius * Math.cos(i * angleStep);
        //     hn.center.y = hyperRadius * Math.sin(i * angleStep);
        // });

        // // Layout the nodes
        // hyperNodes.forEach(hn => hn.layout());
        // this.hyperNodes = hyperNodes;

        // this.updateStyle();

        // this.emitEvent("update");
        // super.layout(isUpdate);
        // this.emitEvent("end");
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
