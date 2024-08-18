import { Setting, ParamWithLinkContext, ParamWithNodeContext, Param, GraphLayouterSettings } from "../settings/settings";

export class SizeSettings extends Setting {
    radius = new Param({
        key: "radius",
        optional: false,
        defaultValue: "100 * n",
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


export class RadialLayouterSettings extends GraphLayouterSettings {
    size = new SizeSettings();
    constructor(type: string, name?: string) {
        super(type, name);
    }
}

