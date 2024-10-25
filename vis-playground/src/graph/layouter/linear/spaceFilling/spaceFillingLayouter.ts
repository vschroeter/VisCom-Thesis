import { GraphLayouter } from "../../layouter";
import { Graph2d } from "src/graph/graphical/Graph2d";

import { Node2d } from "src/graph/graphical";
import { EllipticArc } from "src/graph/graphical/";
import { CommonSettings } from "../../settings/commonSettings";
import { LSystem, SpaceFillingCurve } from "./lSystem";
import { SpaceFillingLayouterSettings } from "./spaceFillingSettings";


export class SpaceFillingCurveLayouter extends GraphLayouter<SpaceFillingLayouterSettings> {

    override layout(isUpdate = false) {
        const ctx = this.settings.getContext({ graph2d: this.graph2d });

        const sorter = this.settings.sorting.getSorter(this.commGraph);
        const nodes = sorter.getSorting2dNodes(this.graph2d)

        const order = this.settings.curve.order.getValue(ctx) ?? 2;
        const curveType = this.settings.curve.curveType.getValue() ?? "Hilbert";
        // const order = 2
        // const curveType = "Hilbert";
        const lSystem = LSystem.get(curveType);

        const spaceFillingAlg = new SpaceFillingCurve(lSystem, order);


        const nodeUnitPositions = new Map<Node2d, number>();

        // Assign nodes a number in interval [0, 1]
        nodes.forEach((node, i) => {
            nodeUnitPositions.set(node, i / (nodes.length));
        })

        // Get the positions of the nodes on the curve
        nodes.forEach(node => {
            const position = nodeUnitPositions.get(node)!;
            const point = spaceFillingAlg.getPointAtUnitInterval(position,
                (x) => x * 10 * (this.settings.size.size.getValue() ?? 20),
                (y) => y * 10 * (this.settings.size.size.getValue() ?? 20)
            );
            node.x = point.x;
            node.y = point.y;
        });

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

        // console.log("Layouted arc layouter", nodes);
        this.emitEvent("update");
        this.emitEvent("end");
    }
}
