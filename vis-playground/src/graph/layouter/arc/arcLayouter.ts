import { GraphLayouter } from "../layouter";
import { Graph2d } from "src/graph/graphical/Graph2d";

import { Point2D, Vector2D } from "src/graph/graphical";
import { ArcLayouterSettings } from "./arcSettings";
import { EllipticArc } from "src/graph/graphical/EllipticArc";
import { CommonSettings } from "../settings/commonSettings";


export class ArcLayouter extends GraphLayouter<ArcLayouterSettings> {

    constructor(graph2d: Graph2d, settings: ArcLayouterSettings, commonSettings: CommonSettings) {
        super(graph2d, settings, commonSettings);
    }

    layout(isUpdate = false) {
        const ctx = this.settings.getContext(this.graph2d);


        // TODO: Get nodes from sorting
        const nodes = this.graph2d.nodes;

        // const sorting = this.settings.sorting.sorting.textValue;
        const sorting = this.settings.sorting.sorting.getValue();
        const reversed = this.settings.sorting.reversed.getValue();

        console.log("ARC", sorting, reversed);

        // Place nodes on a straight line down
        nodes.forEach((node, i) => {
            node.x = 0;
            node.y = i * (this.settings.size.nodeDistance.getValue(ctx) ?? 40);
        })

        // Adapt the links
        const links = this.graph2d.links;
        links.forEach(link => {
            link.curveStyle = "basis";
            const source = link.source;
            const target = link.target;

            const distance = Math.abs(source.y - target.y);
            const xDelta = distance * 0.7;

            const direction = source.y < target.y ? "down" : "up";
            const anchorDirection = direction == "down" ? new Vector2D(1, 0) : new Vector2D(-1, 0);

            const startAnchor = source.getAnchor(anchorDirection);
            const endAnchor = target.getAnchor(anchorDirection);

            const startPoint = startAnchor.anchorPoint.clone();
            const endPoint = endAnchor.anchorPoint.clone();

            link.points = [
                // new Point2D(source.x, source.y),
                startAnchor,
                new EllipticArc()
                    .radius(xDelta / 2)
                    .endPoint(endPoint)
                    // .direction(direction == "down" ? "clockwise" : "counter-clockwise")
                ,
                endAnchor,
            ]

        })

        console.log("Layouted arc layouter", nodes);
        this.emitEvent("update");
        this.emitEvent("end");
    }
}
