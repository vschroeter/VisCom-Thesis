import { Setting, ParamWithLinkContext, ParamWithNodeContext, Param, GraphLayouterSettings } from "../settings/settings";
import { LinearSortingSettings } from "../settings/linearSettings";

export class SizeSettings extends Setting {
    nodeDistance = new Param({
        key: "nodeDistance",
        optional: false,
        defaultValue: "40",
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




export class ArcLayouterSettings extends GraphLayouterSettings {
    size = new SizeSettings();

    sorting = new LinearSortingSettings();

    constructor(type: string, name?: string) {
        super(type, name);
    }
}

