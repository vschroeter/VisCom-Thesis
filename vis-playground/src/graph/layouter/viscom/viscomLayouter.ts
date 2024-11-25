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

        this.resetVisGraph();

        this.visGraph.combineCommunities(this.commGraph.communities.getAsIdLists());
        for (let i = 0; i < (this.settings.algorithm.combiningSteps.getValue() ?? 0); i++) {
            this.visGraph.combineStronglyCoupledNodes();
        }

        this.visGraph.setEdgeVisibility({
            hyperEdges: this.settings.display.showHyperEdges.getValue() ?? true,
            edgesIncludedInHyperEdges: this.settings.display.showIncludedInHyperEdges.getValue() ?? true,
        })

        console.log("Combined communities", this.visGraph, this.commGraph.communities.getAsIdLists());

    }

    override layout(isUpdate = false) {
        this.initVisGraph()

        this.visGraph.setPrecalculator(new BasicSizeCalculator({
            sizeMultiplier: 50,
            marginFactor: 1.1
        }));

        const sorter = this.settings.sorting.getSorter(this.visGraph, this.commonSettings);
        this.visGraph.setSorter(sorter);

        this.visGraph.setPositioner((node) => {
            return new RadialPositionerDynamicDistribution({
                nodeMarginFactor: this.settings.spacing.nodeMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1,
                outerMarginFactor: this.settings.spacing.outerMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1.1,
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
        

        this.visGraph.layout();
        this.emitEvent("end");

    }


}
