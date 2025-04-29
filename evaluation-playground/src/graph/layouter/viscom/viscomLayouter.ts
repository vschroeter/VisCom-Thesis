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
import { FlexConnectionLayouter } from "../connectionLayouter/flexConnections/flexLayouter";
import { ViscomConnectionLayouter } from "../connectionLayouter/viscomConnections/viscomConnectionLayouter";


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
            n: this.visGraph.allLeafLayoutNodes.length,
            m: this.visGraph.allLayoutConnections.length,
            l: this.visGraph.allLayoutConnections.flatMap(c => c.getLinks()).length
        })

        return this.settings.community.fetchCommunities(this.visGraph).then(communities => {
            console.log("Fetched communities", communities);

            // First combine communities
            this.visGraph.combineCommunities(communities);

            // Then group by connected components
            if (this.settings.algorithm.combineConnectedComponents.getValue() ?? false) {
                this.visGraph.combineConnectedComponents();
            }

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
                virtualEdges: this.settings.display.showVirtualPaths.getValue() ?? true,
            })

            console.log("Combined communities", this.visGraph, this.commGraph.communities.getAsIdLists());
        })
    }

    override async layout(isUpdate = false) {
        console.log("Layouting", this.visGraph, this.commGraph.communities.getAsIdLists());
        // this.initVisGraph().then(() => {

        this.visGraph.setPrecalculator(new BasicSizeCalculator({
            sizeMultiplier: 50,
            marginFactor: 1.1,
            adaptRadiusBasedOnScore: this.commonSettings.showNodeScore.getValue() ?? true,
            virtualNodeMultiplier: 0.5
        }));

        const sorter = this.settings.sorting.getSorter(this.visGraph, this.commonSettings);
        // console.log("Sorter", sorter);
        // const sorter = new IdSorter(this.visGraph, this.commonSettings);
        this.visGraph.setSorter(sorter);

        this.visGraph.setPositioner(
            new RadialPositionerDynamicDistribution({
                nodeMarginFactor: this.settings.radial.nodeMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1,
                radiusMarginFactor: this.settings.radial.radiusMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1.1,
                adaptEnclosingCircle: this.settings.radial.adaptEnclosingCircle.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? true,
                rotateBasedOnConnections: this.settings.radial.rotateBasedOnConnections.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? true,
                hyperNodeMarginFactor: this.settings.radial.hyperNodeMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 0.4,
                hyperRadiusMarginFactor: this.settings.radial.hyperRadiusMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1.1,

            })
        )

        this.visGraph.setConnectionLayouter([
            // new DirectCircularConnectionLayouter(),
            // new RadialSplineConnectionLayouter(),
            // new RadialMultiConnectionLayouter(),
            // new FlexConnectionLayouter(),
            new ViscomConnectionLayouter({
                optimizeConnectionAnchors: this.settings.algorithm.optimizeConnectionAnchors.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? true,
                minimumRangeSizeFactor: this.settings.algorithm.minimumRangeSizeFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 0.4,
                rangePaddingFactor: this.settings.algorithm.rangePaddingFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 0.1,
                combinedPathsDistanceFactor: this.settings.algorithm.combinedPathsDistanceFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 0.2,
                combinePaths: this.settings.algorithm.combinePaths.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? true,
                useHierarchicalSubPaths: this.settings.algorithm.useHierarchicalSubPaths.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? true,
                useHyperEdges: this.settings.algorithm.useHyperEdges.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? false,
            }),
        ])

        // console.log("Before layout", this.visGraph);
        await this.visGraph.layout();
        console.log("After layout", this.visGraph);

        // this.visGraph.allLayoutNodes.forEach(node => {
        //     node.debugShapes.push(node.innerCircle);
        // })

        this.emitEvent("end");
        // })
    }


}
