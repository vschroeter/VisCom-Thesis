import { LinearSortingSettings } from "../../settings/linearSettings";
import { Setting, ParamWithLinkContext, ParamWithNodeContext, Param, GraphLayouterSettings } from "../../settings/settings";

// export class SizeSettings extends Setting {
//     radius = new Param({
//         key: "radius",
//         optional: false,
//         defaultValue: "10 * n",
//     });

//     constructor() {
//         super({
//             key: "size",
//             label: "Size",
//             description: "Size settings for the radial layout.",
//             optional: false,
//         });
//     }
// }

export class RadialLayoutingSettings extends Setting {
    nodeMarginFactor = new Param<number>({
        key: "nodeMarginFactor",
        label: "Margin factor between nodes",
        description: "The factor to multiply the node radius with to get the margin between the nodes inside a circle.",
        optional: false,
        defaultValue: 0.7,
        type: "number",
    });

    hyperNodeMarginFactor = new Param<number>({
        key: "hyperNodeMarginFactor",
        label: "Margin factor between hypernodes",
        description: "The factor to multiply the node radius with to get the margin between nodes when placing hypernodes.",
        optional: false,
        defaultValue: 0.4,
        type: "number",
    });


    radiusMarginFactor = new Param<number>({
        key: "radiusMarginFactor",
        label: "Margin fac. for outer r of hypernodes",
        optional: false,
        defaultValue: 1.2,
        type: "number",
    });


    hyperRadiusMarginFactor = new Param<number>({
        key: "hyperRadiusMarginFactor",
        label: "Margin fac. for outer r of hypernodes",
        description: "The margin factor for the radius of nodes within nested hypernodes.",
        optional: false,
        defaultValue: 1.1,
        type: "number",
        enabled: false
    });

    adaptEnclosingCircle = new Param<boolean>({
        key: "adaptEnclosingCircle",
        label: "Adapt Enclosing Circle",
        description: "Adapt the enclosing circle to the size of the nodes.",
        optional: false,
        defaultValue: true,
        type: "boolean",
    });

    rotateBasedOnConnections = new Param<boolean>({
        key: "rotateBasedOnConnections",
        label: "Rotate children based on connections",
        description: "Rotate the nodes based on their connections.",
        optional: false,
        defaultValue: true,
        type: "boolean",
    });

    // gapBetweenStartAndEnd = new Param<number>({
    //     key: "gapBetweenStartAndEnd",
    //     label: "Gap between start and end",
    //     description: "The gap between the start and end node in the radial layout.",
    //     optional: false,
    //     defaultValue: 0.1,
    //     type: "number",
    // });
}


export class EdgeSettings extends Setting {
    forwardBackwardThreshold = new Param({
        key: "forwardBackwardThreshold",
        label: "Forw.-Back. Edge ° Thresh.",
        description: "The threshold angle in the radial layout for edges to be handled as backward edges (in degree).",
        optional: false,
        defaultValue: 270,
    });

    straightForwardLineAtDegreeDelta = new Param({
        key: "straightForwardLineAtDegreeDelta",
        label: "Straight Line @ Delta°",
        description: "The threshold angle in the radial layout for forward edges to be drawn as straight lines (in degree). Lines above this threshold will be drawn as concave curves, lines below this threshold will be drawn as convex curves.",
        optional: false,
        defaultValue: 135,
    });

    backwardLineCurvature = new Param({
        key: "backwardLineCurvature",
        label: "Backward Line Curvature°",
        description: "The curvature of the backward edges (between 0° and 180°).",
        optional: false,
        defaultValue: 120,
    });

    // combineEdges = new Param<boolean>({
    //     key: "combineEdges",
    //     optional: false,
    //     defaultValue: false,
    //     type: "boolean",
    // })
}


export class RadialLayouterSettings extends GraphLayouterSettings {
    spacing = new RadialLayoutingSettings({
        key: "spacing",
        label: "Spacing",
        description: "Spacing settings for the radial layout.",
        optional: false,
    });

    sorting = new LinearSortingSettings();


    edges = new EdgeSettings({
        key: "edges",
        label: "Edges",
        description: "Settings for the edges.",
        optional: false,
    });

    constructor(type: string, name?: string) {
        super(type, name);
    }
}

