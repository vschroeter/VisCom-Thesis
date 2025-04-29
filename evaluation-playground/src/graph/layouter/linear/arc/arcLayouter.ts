import { GraphLayouter } from "../../layouter";

import { ArcLayouterSettings } from "./arcSettings";
import { EllipticArc } from "src/graph/graphical";
import { Vector } from "2d-geometry";
import { BasePositioner } from "src/graph/visGraph/layouterComponents/positioner";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { VisGraph } from "src/graph/visGraph/visGraph";
import { BaseConnectionLayouter, BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";


export class LinearPositioner extends BasePositioner {

    settings: ArcLayouterSettings;
    visGraph: VisGraph;

    isVertical = true;
    get isHorizontal() { return !this.isVertical; }
    set isHorizontal(val) { this.isVertical = !val; }

    constructor(settings: ArcLayouterSettings, visGraph: VisGraph) {
        super();
        this.visGraph = visGraph;
        this.settings = settings;
    }

    setDirection(dir: "vertical" | "horizontal") {
        this.isVertical = dir == "vertical";
    }

    override async positionChildren(parentNode: LayoutNode): Promise<void> {
        const ctx = this.settings.getContext({ visGraph: this.visGraph });

        const children = parentNode.children;

        if (this.isHorizontal) {
            children.forEach((child, i) => {
                child.x = i * (this.settings.size.nodeDistance.getValue(ctx) ?? 40);
                child.y = 0;
            })
        } else {
            children.forEach((child, i) => {
                child.x = 0;
                child.y = i * (this.settings.size.nodeDistance.getValue(ctx) ?? 40);
            })
        }
    }
}

export class ArcConnector extends BaseNodeConnectionLayouter {

    isVertical = true;
    get isHorizontal() { return !this.isVertical; }
    set isHorizontal(val) { this.isVertical = !val; }

    override layoutConnectionsOfNode(node: LayoutNode): void {
        node.outConnections.forEach((connection) => {

            connection.curveStyle = "basis";
            const source = connection.source;
            const target = connection.target;

            const coordGetter = this.isVertical ? "y" : "x";
            const distance = Math.abs(source[coordGetter] - target[coordGetter]);
            const xDelta = distance * 0.7;

            const direction = source[coordGetter] < target[coordGetter] ? "down" : "up";
            const anchorDirection = ((isVertical) => {
                if (isVertical) {
                    return direction == "down" ? new Vector(1, 0) : new Vector(-1, 0);
                }
                return direction == "down" ? new Vector(0, -1) : new Vector(0, 1);
            })(this.isVertical)

            const startAnchor = source.getAnchor(anchorDirection);
            const endAnchor = target.getAnchor(anchorDirection);

            const startPoint = startAnchor.anchorPoint.clone();
            const endPoint = endAnchor.anchorPoint.clone();

            connection.pathSegment = new EllipticArc(connection)
                .radius(xDelta / 2)
                .startPoint(startPoint)
                .endPoint(endPoint)
            // .direction(direction == "down" ? "clockwise" : "counter-clockwise")
        });

    }
}

export class ArcLayouter extends GraphLayouter<ArcLayouterSettings> {

    override async layout(isUpdate = false) {
        const ctx = this.settings.getContext({ visGraph: this.visGraph });

        const sorter = this.settings.sorting.getSorter(this.visGraph, this.commonSettings);
        const positioner = new LinearPositioner(this.settings, this.visGraph);
        const connector = new ArcConnector();

        const isVertical = this.settings.size.verticalOrientation.getValue(ctx) ?? true;
        positioner.isVertical = isVertical;
        connector.isVertical = isVertical;

        this.visGraph.setPositioner(positioner);
        this.visGraph.setSorter(sorter);
        this.visGraph.setConnectionLayouter(connector);

        await this.visGraph.layout();

        // console.log("Layouted arc layouter", nodes);
        this.emitEvent("update");
        this.emitEvent("end");
    }
}
