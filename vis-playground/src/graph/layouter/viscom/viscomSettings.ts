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


export class ViscomLayouterSettings extends RadialLayouterSettings {
    // size = new SizeSettings();
    // sorting = new LinearSortingSettings
    //     ();

    // constructor(type: string, name?: string) {
    //     super(type, name);
    // }
}

