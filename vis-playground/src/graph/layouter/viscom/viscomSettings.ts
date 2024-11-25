import { RadialLayouterSettings } from "../linear/radial/radialSettings";
import { LinearSortingSettings } from "../settings/linearSettings";
import { GraphLayouterSettings, Param, Setting } from "../settings/settings";

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

export class SpacingSettings extends Setting {
    nodeMarginFactor = new Param<number>({
        key: "nodeMarginFactor",
        description: "The factor to multiply the node radius with to get the margin between the nodes inside a circle.",
        optional: false,
        defaultValue: 1,
        type: "number",
    });

    outerMarginFactor = new Param<number>({
        key: "outerRadiusMarginFactor",
        description: "The factor for the outer radius of a hypernode.",
        optional: false,
        defaultValue: 1.1,
        type: "number",
    });
}

export class ViscomLayouterSettings extends RadialLayouterSettings {

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

    spacing = new SpacingSettings({
        key: "spacing",
        label: "Spacing",
        description: "Spacing settings for the viscom layout.",
        optional: false,
    });

    // size = new SizeSettings();
    // sorting = new LinearSortingSettings
    //     ();

    // constructor(type: string, name?: string) {
    //     super(type, name);
    // }
}

