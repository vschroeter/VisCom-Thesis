import { LinearSortingSettings } from "../../settings/linearSettings";
import { Setting, ParamWithLinkContext, ParamWithNodeContext, Param, GraphLayouterSettings } from "../../settings/settings";

export class SizeSettings extends Setting {
    radius = new Param({
        key: "radius",
        optional: false,
        defaultValue: "10 * n",
    });

    constructor() {
        super({
            key: "size",
            label: "Size",
            description: "Size settings for the radial layout.",
            optional: false,
        });
    }
}

export class EdgeSettings extends Setting {
    forwardBackwardThreshold = new Param({
        key: "forwardBackwardThreshold",
        description: "The threshold angle in the radial layout for edges to be handled as backward edges (in degree).",
        optional: false,
        defaultValue: 270,
    });

    straightForwardLineAtDegreeDelta = new Param({
        key: "straightForwardLineAtDegreeDelta",
        description: "The threshold angle in the radial layout for forward edges to be drawn as straight lines (in degree). Lines above this threshold will be drawn as concave curves, lines below this threshold will be drawn as convex curves.",
        optional: false,
        defaultValue: 135,
    });

    backwardLineCurvature = new Param({
        key: "backwardLineCurvature",
        description: "The curvature of the backward edges (between 0° and 180°).",
        optional: false,
        defaultValue: 120,
    });
    
    combineEdges = new Param<boolean>({
        key: "combineEdges",
        optional: false,
        defaultValue: false,
        type: "boolean",
    })

    constructor() {
        super({
            key: "edges",
            label: "Edges",
            description: "Settings for the edges.",
            optional: false,
        });
    }
}


export class RadialLayouterSettings extends GraphLayouterSettings {
    size = new SizeSettings();
    sorting = new LinearSortingSettings();

    edges = new EdgeSettings();    

    constructor(type: string, name?: string) {
        super(type, name);
    }
}

