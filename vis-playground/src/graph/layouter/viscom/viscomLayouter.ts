
import { ViscomLayouterSettings } from "./viscomSettings";
import { GraphLayouter } from "../layouter";
import { RadialPositionerDynamicDistribution } from "../linear/radial/radialLayouter";
import { Connection2dData } from "src/graph/graphical/Connection2d";
import { BasicSizeCalculator } from "src/graph/visGraph/layouterComponents/precalculator";
// import { BasicConnectionCombiner } from "../connectionLayouter/connectionCombiner";
import { DirectCircularConnectionLayouter } from "../connectionLayouter/circularArcConnection";
import { IdSorter } from "src/graph/algorithms/sortings/simple";
import { RadialSplineConnectionLayouter } from "../connectionLayouter/splineConnection";
import { RadialMultiConnectionLayouter } from "../connectionLayouter/multiConnection";


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

    override initVisGraph(): Promise<void> {
        // Transform visgraph to hypergraph
        this.resetVisGraph();

        console.log({
            n: this.visGraph.allLayoutNodes.length,
            m: this.visGraph.allLayoutConnections.length,
            l: this.visGraph.allLayoutConnections.flatMap(c => c.getLinks()).length
        })

        return this.settings.community.fetchCommunities(this.visGraph).then(communities => {
            console.log("Fetched communities", communities);
            this.visGraph.combineCommunities(communities);

            if (this.settings.community.addVirtualNodes.getValue() ?? false) {
                this.visGraph.addVirtualCommunityNodes();
            }


        }).then(() => {
            // this.visGraph.combineCommunities(this.commGraph.communities.getAsIdLists());


            for (let i = 0; i < (this.settings.algorithm.combiningSteps.getValue() ?? 0); i++) {
                this.visGraph.combineStronglyCoupledNodes();
            }

            this.visGraph.setEdgeVisibility({
                hyperEdges: this.settings.display.showHyperEdges.getValue() ?? true,
                edgesIncludedInHyperEdges: this.settings.display.showIncludedInHyperEdges.getValue() ?? true,
            })

            console.log("Combined communities", this.visGraph, this.commGraph.communities.getAsIdLists());
        })
    }

    override layout(isUpdate = false) {
        console.log("Layouting", this.visGraph, this.commGraph.communities.getAsIdLists());
        // this.initVisGraph().then(() => {

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
            new RadialMultiConnectionLayouter(),
        ])

        // console.log("Before layout", this.visGraph);
        this.visGraph.layout();
        console.log("After layout", this.visGraph);
        this.emitEvent("end");
        // })
    }


}
