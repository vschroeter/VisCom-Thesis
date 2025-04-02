import { Node2d } from "src/graph/graphical";
import { GraphLayouter } from "../../layouter";
import { LSystem, SpaceFillingCurve } from "./lSystem";

import { SpaceFillingLayouterSettings } from "./spaceFillingSettings";
import { BasePositioner } from "src/graph/visGraph/layouterComponents/positioner";
import { LayoutNode } from "src/graph/visGraph/layoutNode";


export class SpaceFillingNodePositioner extends BasePositioner {

    order: number;
    curveType: string;
    size: number;

    constructor(
        order: number,
        curveType: string,
        size: number,
    ) {

        super();
        this.order = order;
        this.curveType = curveType;

        this.size = size;
    }

    override async positionChildren(parentNode: LayoutNode): Promise<void> {
        // if (parentNode != )

        const nodes = parentNode.children;

        const nodeUnitPositions = new Map<LayoutNode, number>();

        // Assign nodes a number in interval [0, 1]
        nodes.forEach((node, i) => {
            nodeUnitPositions.set(node, i / (nodes.length));
        })

        const lSystem = LSystem.get(this.curveType);

        const spaceFillingAlg = new SpaceFillingCurve(lSystem, this.order);

        // Get the positions of the nodes on the curve
        nodes.forEach(node => {
            const position = nodeUnitPositions.get(node)!;
            const point = spaceFillingAlg.getPointAtUnitInterval(position,
                (x) => x * 10 * (this.size),
                (y) => y * 10 * (this.size)
            );
            node.x = point.x;
            node.y = point.y;
        });

    }

}
export class SpaceFillingCurveLayouter extends GraphLayouter<SpaceFillingLayouterSettings> {

    override async layout(isUpdate = false) {
        const ctx = this.settings.getContext({ visGraph: this.visGraph });

        const sorter = this.settings.sorting.getSorter(this.visGraph, this.commonSettings);
        this.visGraph.setSorter(sorter);

        const order = this.settings.curve.order.getValue(ctx) ?? 2;
        const curveType = this.settings.curve.curveType.getValue() ?? "Hilbert";
        const size = this.settings.size.size.getValue() ?? 20;

        this.visGraph.setPositioner(new SpaceFillingNodePositioner(order, curveType, size));



        // // Adapt the links
        // const links = this.graph2d.links;
        // links.forEach(link => {
        //     link.curveStyle = "basis";
        //     const source = link.source;
        //     const target = link.target;

        //     const distance = Math.abs(source.y - target.y);
        //     const xDelta = distance * 0.7;

        //     const direction = source.y < target.y ? "down" : "up";
        //     const anchorDirection = direction == "down" ? new Vector2D(1, 0) : new Vector2D(-1, 0);

        //     const startAnchor = source.getAnchor(anchorDirection);
        //     const endAnchor = target.getAnchor(anchorDirection);

        //     const startPoint = startAnchor.anchorPoint.clone();
        //     const endPoint = endAnchor.anchorPoint.clone();

        //     link.points = [
        //         // new Point2D(source.x, source.y),
        //         startAnchor,
        //         new EllipticArc()
        //             .radius(xDelta / 2)
        //             .endPoint(endPoint)
        //             // .direction(direction == "down" ? "clockwise" : "counter-clockwise")
        //         ,
        //         endAnchor,
        //     ]

        // })

        await this.visGraph.layout();

        // console.log("Layouted arc layouter", nodes);
        // this.emitEvent("update");
        this.emitEvent("end");
    }
}
