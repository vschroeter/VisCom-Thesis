
import { ViscomLayouterSettings } from "./viscomSettings";
import { GraphLayouter } from "../layouter";
import { RadialPositionerDynamicDistribution } from "../linear/radial/radialLayouter";
import { Connection2dData } from "src/graph/graphical/Connection2d";
import { BasicSizeCalculator } from "src/graph/visGraph/layouterComponents/precalculator";
import { RadialSplineConnectionLayouter, RadialSubConnectionLayouter } from "../connectionLayouter/splineConnection";
import { BasicConnectionCombiner } from "../connectionLayouter/connectionCombiner";
import { DirectCircularConnectionLayouter } from "../connectionLayouter/circularArcConnection";
import { IdSorter } from "src/graph/algorithms/sortings/simple";


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

        console.log({
            n: this.visGraph.allLayoutNodes.length,
            m: this.visGraph.allLayoutConnections.length,
            l: this.visGraph.allLayoutConnections.flatMap(c => c.getLinks()).length
        })

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
        console.log("Layouting", this.visGraph, this.commGraph.communities.getAsIdLists());
        this.initVisGraph()

        this.visGraph.setPrecalculator(new BasicSizeCalculator({
            sizeMultiplier: 50,
            marginFactor: 1.1,
            adaptRadiusBasedOnScore: this.commonSettings.showNodeScore.getValue() ?? true,
        }));

        const sorter = this.settings.sorting.getSorter(this.visGraph, this.commonSettings);
        // const sorter = new IdSorter(this.visGraph, this.commonSettings);
        this.visGraph.setSorter(sorter);

        this.visGraph.setPositioner((node) => {
            return new RadialPositionerDynamicDistribution({
                nodeMarginFactor: this.settings.spacing.nodeMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1,
                outerMarginFactor: this.settings.spacing.outerMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1.1,
            });
        })
        
        this.visGraph.setConnectionLayouter([
            new DirectCircularConnectionLayouter(),
            new RadialSplineConnectionLayouter(),
            new RadialSubConnectionLayouter(),
            new BasicConnectionCombiner()
        ])
        
        console.log("Before layout", this.visGraph);
        this.visGraph.layout();
        console.log("After layout", this.visGraph);
        this.emitEvent("end");

    }


}
