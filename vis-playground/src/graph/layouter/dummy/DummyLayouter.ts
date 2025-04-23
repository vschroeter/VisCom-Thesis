import { GraphLayouter } from "../layouter";

import { EllipticArc } from "src/graph/graphical";
import { Point, Vector } from "2d-geometry";
import { BasePositioner as NodePositioner } from "src/graph/visGraph/layouterComponents/positioner";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { VisGraph } from "src/graph/visGraph/visGraph";
import { BaseConnectionLayouter, BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";


import { Setting, ParamWithLinkContext, ParamWithNodeContext, Param, GraphLayouterSettings } from "../settings/settings";
import { LinearSortingSettings } from "../settings/linearSettings";
import { StraightLineSegment } from "src/graph/graphical/primitives/pathSegments/LineSegment";
import { CombinedPathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";

// Setting subclass, can contain multiple parameters.
// These parameters are automatically rendered in the frontend.
export class SizeSetting extends Setting {
    // Distance between nodes
    nodeDistance = new Param({
        key: "nodeDistance", label: "Distance between the nodes.",
        defaultValue: "40",
    });

    constructor() {
        // Defining the information about this setting subclass
        super({
            key: "size", label: "Size",
            description: "Size settings for the layout.",
        });
    }
}

// Settings subclass, can contain multiple setting collections
export class MyLayouterSettings extends GraphLayouterSettings {
    // Size setting subclass
    size = new SizeSetting();
}

// Positioner subclass taking care of the node positions.
export class MyPositioner extends NodePositioner {
    constructor(public settings: MyLayouterSettings) {
        super();
    }

    // Overridden method to position nodes.
    override async positionChildren(parentNode: LayoutNode) {
        parentNode.children.forEach((child, i) => {
            // Use the settings information
            const distance =
                this.settings.size.nodeDistance.getValue() ?? 40;
            // Place the nodes
            child.x = i * distance;
            child.y = i * distance;
        })
    }
}

// The layouter subclass.
// Combines settings, positioner, sorter and connection layouter.
// Settings subclass is passed as generic argument.
export class MyLayouter extends GraphLayouter<MyLayouterSettings> {
    override async layout() {
        // Instantiate positioner and pass the settings
        const positioner = new MyPositioner(this.settings);

        // Set the positioner for the graph
        this.visGraph.setPositioner(positioner);

        // The layout method uses the defined objects
        // like the positioner
        await this.visGraph.layout();
        this.emitEvent("end");
    }
}
