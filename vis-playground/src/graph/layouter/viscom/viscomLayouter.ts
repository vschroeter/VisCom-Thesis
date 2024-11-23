import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";

import * as d3 from "d3";
import { Connection2d, Node2d } from "src/graph/graphical";
import { ViscomLayouterSettings } from "./viscomSettings";
import { GraphLayouter } from "../layouter";
import { RadialCircularArcConnectionLayouter, RadialLayouter, RadialPositioner, RadialPositionerDynamicDistribution } from "../linear/radial/radialLayouter";
import { RadialLayouterSettings } from "../linear/radial/radialSettings";
import { MouseEvents } from "src/graph/visualizations/interactions";
import { Connection2dData } from "src/graph/graphical/Connection2d";
import { BasicSizeCalculator } from "src/graph/visGraph/layouterComponents/precalculator";
import { LinearPositioner } from "../linear/arc/arcLayouter";
import { RadialSplineConnectionAnchorPointCalculator, RadialSplineConnectionLayouter } from "../connectionLayouter/splineConnection";
import { BasicConnectionCombiner } from "../connectionLayouter/connectionCombiner";
import { DirectCircularConnectionLayouter } from "../connectionLayouter/circularArcConnection";


export interface ViscomHyperLinkData extends Connection2dData {
    fromId: string;
    toId: string;

    fromCommNodeId: string;
    toCommNodeId: string;

    weight: number;
}


export class ViscomLayouter extends GraphLayouter<ViscomLayouterSettings> {
    // export class ViscomLayouter extends RadialLayouter<ViscomLayouterSettings> {


    hyperRadius: number = 0;

    // override getRadius(): number {
    //     return this.hyperRadius;
    // }

    override initVisGraph() {
        // Transform visgraph to hypergraph



        this.visGraph.combineCommunities(this.commGraph.communities.getAsIdLists());
        this.visGraph.combineStronglyCoupledNodes();

        console.log("Combined communities", this.visGraph, this.commGraph.communities.getAsIdLists());

    }

    override layout(isUpdate = false) {



        this.visGraph.setPrecalculator(new BasicSizeCalculator({
            sizeMultiplier: 50,
            marginFactor: 1.1
        }));

        const sorter = this.settings.sorting.getSorter(this.visGraph, this.commonSettings);
        this.visGraph.setSorter(sorter);

        this.visGraph.setPositioner((node) => {
            // const radius = this.settings.size.radius.getValue(this.settings.getContext({ nodes: node.children })) ?? 100;
            // console.log("Radius", node, radius);

            // if (node.layerFromBot == 1) {
            //     return new LinearPositioner()
            // }

            const countChildren = node.children.length;

            // Get the max radius of the child nodes
            const maxChildRadius = Math.max(...node.children.map(n => n.radius));
            const radiusFactor = 2;
            const marginFactor = 1.1;

            const circumference = countChildren * (maxChildRadius * 2) * radiusFactor;
            const radius = circumference / (2 * Math.PI);
            const outerRadius = (radius + maxChildRadius) * marginFactor;

            // return new RadialPositioner({ radius, outerRadius });
            return new RadialPositionerDynamicDistribution({
                nodeMarginFactor: 1.1,
                outerMarginFactor: 1.1,
            });
        })

        const forwardBackwardThreshold = this.settings.edges.forwardBackwardThreshold.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 270;
        const straightForwardLineAtDegreeDelta = this.settings.edges.straightForwardLineAtDegreeDelta.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 135;
        const backwardLineCurvature = this.settings.edges.backwardLineCurvature.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 120;

        this.visGraph.setConnectionLayouter([
            new DirectCircularConnectionLayouter(),
            new RadialSplineConnectionAnchorPointCalculator(),
            new RadialSplineConnectionLayouter(),
            new BasicConnectionCombiner()
        ])
        // this.visGraph.setConnectionLayouter(new BasicConnectionCombiner());

        // this.visGraph.setConnector((connection) => {

        //     const startNode = connection.source;
        //     const endNode = connection.target;

        //     if (connection.isSubConnection) {

        //     }

        //     const startLayer = startNode.layerFromBot;
        //     const endLayer = endNode.layerFromBot;

        //     // If the nodes have the same parent, use the radial connector
        //     if (startNode.parent === endNode.parent) {
        //         return new RadialCurvedConnector({
        //             forwardBackwardThreshold,
        //             straightForwardLineAtDegreeDelta,
        //             backwardLineCurvature
        //         })
        //     }

        //     return undefined;
        //     // return new RadialCurvedConnector({
        //     //     forwardBackwardThreshold,
        //     //     straightForwardLineAtDegreeDelta,
        //     //     backwardLineCurvature
        //     // })
        // });


        this.visGraph.layout();
        this.emitEvent("end");

    }


}
