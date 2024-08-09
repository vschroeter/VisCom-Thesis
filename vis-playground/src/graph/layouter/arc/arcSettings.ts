import { GraphLayouterSetting, GraphLayouterSettingLinkParam, GraphLayouterSettingNodeParam, GraphLayouterSettingParam, GraphLayouterSettings } from "../settings";

export class SizeSettings extends GraphLayouterSetting {
    radius = new GraphLayouterSettingParam({
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


export class ArcLayouterSettings extends GraphLayouterSettings {
    size = new SizeSettings();
    constructor(type: string, name?: string) {
        super(type, name);
    }
}

