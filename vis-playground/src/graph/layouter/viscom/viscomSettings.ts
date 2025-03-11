import { EdgeSettings, RadialLayouterSettings, RadialLayoutingSettings } from "../linear/radial/radialSettings";
import { LinearSortingSettings } from "../settings/linearSettings";
import { GraphLayouterSettings, Param, Setting } from "../settings/settings";
import { CommunitySettings } from "./communitySettings";

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

export class AlgorithmSettings extends Setting {
    combiningSteps = new Param<number>({
        key: "combiningSteps",
        label: "Combining Steps",
        description: "The count of steps to combine strongly coupled nodes.",
        optional: false,
        defaultValue: 1,
        type: "number",
    });

    optimizeConnectionAnchors = new Param<boolean>({
        key: "optimizeConnectionAnchors",
        label: "Optimize Connection Anchors",
        description: "Optimize connection anchors.",
        optional: false,
        defaultValue: true,
        type: "boolean",
    });
}

export class DisplaySettings extends Setting {
    showHyperEdges = new Param<boolean>({
        key: "showHyperEdges",
        optional: false,
        defaultValue: true,
        type: "boolean",
    });

    showIncludedInHyperEdges = new Param<boolean>({
        key: "showEdgesIncludedInHyperEdges",
        optional: false,
        defaultValue: true,
        type: "boolean",
    });
}



export class ViscomLayouterSettings extends GraphLayouterSettings {
    radial = new RadialLayoutingSettings({
        key: "radial",
        label: "Radial Placement",
        description: "Placement settings for the radial layout.",
        optional: false,
    });

    sorting = new LinearSortingSettings();

    display = new DisplaySettings({
        key: "display",
        label: "Display",
        description: "Display settings for the viscom layout.",
        optional: false,
    });

    algorithm = new AlgorithmSettings({
        key: "algorithm",
        label: "Algorithm",
        description: "Algorithm settings for the viscom layout.",
        optional: false,
    });

    community = new CommunitySettings({
        key: "community",
        label: "Community",
        description: "Community settings for the viscom layout.",
        optional: false,
    });
}

