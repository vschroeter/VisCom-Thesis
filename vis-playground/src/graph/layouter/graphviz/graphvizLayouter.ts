
import { Point, PointLike, Vector } from "2d-geometry";
import { BasePositioner } from "src/graph/visGraph/layouterComponents/positioner";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { BasicSizeCalculator } from "src/graph/visGraph/layouterComponents/precalculator";
import { RadialCircularArcConnectionLayouter } from "../connectionLayouter/radialConnections";
import { GraphLayouter } from "../layouter";
import { RadialPositionerDynamicDistribution } from "../linear/radial/radialLayouter";
import { GraphvizLayouterSettings } from "./graphvizSettings";
import { commGraphToDOT, visGraphToDOT } from "src/api/graphDataApi";



// export class RadialPositioner extends BasePositioner {

//     // The radius to place the child nodes
//     radius: number;

//     // The outer radius that the parent node gets
//     outerRadius: number;

//     // The center of the circle
//     center: Point;

//     constructor({
//         radius = 100,
//         outerRadius,
//     }: {
//         radius?: number;
//         outerRadius?: number;
//     } = {}) {
//         super();
//         this.radius = radius;
//         this.outerRadius = outerRadius ?? radius;
//         this.center = new Point(0, 0);
//     }

//     getPositionOnCircleAtAngleRad(rad: number, radius?: number, centerTranslation?: PointLike): Point {
//         return RadialUtils.positionOnCircleAtRad(rad, radius ?? this.radius, centerTranslation ?? this.center);
//     }

//     override positionChildren(parentNode: LayoutNode): void {
//         const nodes = parentNode.children;
//         const continuumMap = new Map<LayoutNode, number>();
//         nodes.forEach((node, i) => {
//             continuumMap.set(node, i / nodes.length);
//         });


//         // Place nodes on a circle with radius
//         const angleRadMap = new Map<LayoutNode, number>();
//         // const angleRadStep = 2 * Math.PI / nodes.length;
//         nodes.forEach((node, i) => {
//             const placement = continuumMap.get(node)!;
//             const angle = placement * 2 * Math.PI;
//             angleRadMap.set(node, angle);
//             const pos = this.getPositionOnCircleAtAngleRad(angle);
//             node.x = pos.x;
//             node.y = pos.y;
//             // console.log("Set node position", node.id, pos, node.circle);
//         });

//         parentNode.radius = this.outerRadius;
//         parentNode.innerRadius = this.radius;
//     }
// }


// export


export class GraphvizLayouter<T extends GraphvizLayouterSettings = GraphvizLayouterSettings> extends GraphLayouter<T> {

    override layout(isUpdate = false) {

        const dotString = visGraphToDOT(this.visGraph);
        console.log("Graphviz DOT string:", dotString);

        // this.visGraph.setPrecalculator(new BasicSizeCalculator({
        //     sizeMultiplier: 50,
        //     adaptRadiusBasedOnScore: this.commonSettings.showNodeScore.getValue() ?? true,

        // }));
        // // this.visGraph.setPositioner(new RadialPositioner({ radius: this.getRadius() }));
        // this.visGraph.setPositioner(new RadialPositionerDynamicDistribution({
        //     nodeMarginFactor: this.settings.spacing.nodeMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1,
        //     radiusMarginFactor: this.settings.spacing.radiusMarginFactor.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 1.1,

        // }));

        // const sorter = this.settings.sorting.getSorter(this.visGraph, this.commonSettings);
        // this.visGraph.setSorter(sorter);

        // const forwardBackwardThreshold = this.settings.edges.forwardBackwardThreshold.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 270;
        // const straightForwardLineAtDegreeDelta = this.settings.edges.straightForwardLineAtDegreeDelta.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 135;
        // const backwardLineCurvature = this.settings.edges.backwardLineCurvature.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 120;

        // this.visGraph.setConnectionLayouter(new RadialCircularArcConnectionLayouter({
        //     forwardBackwardThreshold,
        //     straightForwardLineAtDegreeDelta,
        //     backwardLineCurvature
        // }));

        this.visGraph.layout();

        this.markConnectionsAsUpdateRequired();
        // this.emitEvent("update");
        this.emitEvent("end");

        return;
    }
}
