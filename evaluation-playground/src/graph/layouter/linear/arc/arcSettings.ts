import { Setting, ParamWithLinkContext, ParamWithNodeContext, Param, GraphLayouterSettings } from "../../settings/settings";
import { LinearSortingSettings } from "../../settings/linearSettings";

export class SizeSettings extends Setting {
    nodeDistance = new Param({
        key: "nodeDistance",
        label: "Node distance",
        optional: false,
        defaultValue: "40",
    });

    verticalOrientation = new Param<boolean>({
        key: "verticalOrientation",
        label: "Is vertical",
        optional: false,
        type: "boolean",
        defaultValue: "true",
    });

    constructor() {
        super({
            key: "size",
            label: "Size and Orientation",
            description: "Size and orientation settings for the radial layout.",
            optional: false,
        });
    }
}




export class ArcLayouterSettings extends GraphLayouterSettings {
    size = new SizeSettings();

    sorting = new LinearSortingSettings();

    constructor(type: string, name?: string) {
        super(type, name);
    }
}

