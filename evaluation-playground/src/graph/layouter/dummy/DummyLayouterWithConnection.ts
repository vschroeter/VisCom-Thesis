import { GraphLayouter } from "../layouter";

import { EllipticArc } from "src/graph/graphical";
import { Point, Vector } from "2d-geometry";
import { BasePositioner } from "src/graph/visGraph/layouterComponents/positioner";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { VisGraph } from "src/graph/visGraph/visGraph";
import { BaseConnectionLayouter, BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";


import { Setting, ParamWithLinkContext, ParamWithNodeContext, Param, GraphLayouterSettings } from "../settings/settings";
import { LinearSortingSettings } from "../settings/linearSettings";
import { StraightLineSegment } from "src/graph/graphical/primitives/pathSegments/LineSegment";
import { CombinedPathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";

export class SizeSettings extends Setting {
    nodeDistances = new Param({
        key: "nodeDistance", label: "Node distance",
        defaultValue: "40",
    });

    constructor() {
        super({
            key: "size", label: "Size",
            description: "Size settings for the layout.",
        });
    }
}

export class DummyLayouterSettings extends GraphLayouterSettings {
    size = new SizeSettings();

    constructor(type: string, name?: string) {
        super(type, name);
    }
}

export class DummyPositioner extends BasePositioner {
    constructor(public settings: DummyLayouterSettings) {
        super();
    }

    override async positionChildren(parentNode: LayoutNode): Promise<void> {
        parentNode.children.forEach((child, i) => {
            child.x = i * (this.settings.size.nodeDistances.getValue() ?? 40);
            child.y = i * (this.settings.size.nodeDistances.getValue() ?? 40);
        })
    }
}

export class DummyConnector extends BaseNodeConnectionLayouter {
    override layoutConnectionsOfNode(node: LayoutNode): void {
        node.outConnections.forEach((connection) => {

            // Connect by step line
            const source = connection.source;
            const target = connection.target;

            // Get the anchor to the right touching the source node
            const startAnchor = source.getAnchor(new Vector(1, 0));
            // Get the anchor to the bottom touching the target node
            const targetAnchor = target.getAnchor(new Vector(0, 1));

            const startX = startAnchor.x;
            const startY = startAnchor.y;

            const targetX = targetAnchor.x;
            const targetY = targetAnchor.y;

            // First segment of the step connection
            const segment1 = new StraightLineSegment(
                connection, new Point(startX, startY), new Point(targetX, startY)
            )

            // Second segment of the step connection
            const segment2 = new StraightLineSegment(
                connection, new Point(targetX, startY), new Point(targetX, targetY)
            )

            // Combined path segment
            connection.pathSegment =
                new CombinedPathSegment(connection, [segment1, segment2]);
        });

    }
}

export class DummyLayouter extends GraphLayouter<DummyLayouterSettings> {
    override async layout(isUpdate = false) {
        const positioner = new DummyPositioner(this.settings);
        const connector = new DummyConnector();

        this.visGraph.setPositioner(positioner);
        this.visGraph.setConnectionLayouter(connector);

        await this.visGraph.layout();
        this.emitEvent("end");
    }
}
