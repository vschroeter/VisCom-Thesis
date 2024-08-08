import { GraphLayouterSetting, GraphLayouterSettingLinkParam, GraphLayouterSettingNodeParam, GraphLayouterSettingParam, GraphLayouterSettings } from "../settings";

export class ForceManyBodySetting extends GraphLayouterSetting {
    strength = new GraphLayouterSettingNodeParam({
        key: "strength",
        optional: false,
        defaultValue: -20,
    });

    constructor() {
        super({
            key: "forceManyBody",
            label: "Force Many Body",
            description: "Many-body forces between nodes.",
            optional: true,
            active: true,
        });
    }
}

export class ForceCenterSetting extends GraphLayouterSetting {
    strength = new GraphLayouterSettingParam({
        key: "strength",
        optional: false,
        active: true,
        defaultValue: 1,
    });

    constructor() {
        super({
            key: "forceCenter",
            label: "Force Center",
            description: "Attracts nodes to the specified center.",
            optional: true,
            active: true,
        });
    }
}

export class ForceLinkSetting extends GraphLayouterSetting {
    distance = new GraphLayouterSettingLinkParam({
        key: "distance",
        optional: true,
        active: true,
        defaultValue: 30,
    });

    strength = new GraphLayouterSettingLinkParam({
        key: "strength",
        optional: true,
        active: true,
        defaultValue: 1,
    });

    constructor() {
        super({
            key: "forceLink",
            label: "Force Link",
            description: "Links nodes together.",
            optional: true,
            active: true,
        });
    }
}

export class ForceCollideSetting extends GraphLayouterSetting {
    radius = new GraphLayouterSettingNodeParam({
        key: "radius",
        optional: true,
        active: true,
        defaultValue: 5,
    });

    strength = new GraphLayouterSettingParam({
        key: "strength",
        optional: true,
        active: true,
        defaultValue: 0.5,
    });

    constructor() {
        super({
            key: "forceCollide",
            label: "Force Collide",
            description: "Prevents nodes from overlapping.",
            optional: true,
            active: true,
        });
    }
}


export class FdgLayouterSettings extends GraphLayouterSettings {

    forceManyBody = new ForceManyBodySetting();
    forceCenter = new ForceCenterSetting();
    forceLink = new ForceLinkSetting();
    forceCollide = new ForceCollideSetting();

    constructor(type: string, name?: string) {
        super(type, name);
    }
}

