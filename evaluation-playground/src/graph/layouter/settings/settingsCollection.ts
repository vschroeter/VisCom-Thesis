import mitt from "mitt";
import { ArcLayouter } from "../linear/arc/arcLayouter";
import { ArcLayouterSettings } from "../linear/arc/arcSettings";
import { FdgLayouter } from "../fdg/fdgLayouter";
import { FdgLayouterSettings } from "../fdg/fdgSettings";
import { GraphLayouter } from "../layouter";
import { RadialLayouter } from "../linear/radial/radialLayouter";
import { RadialLayouterSettings } from "../linear/radial/radialSettings";
import { GraphLayouterSettings } from "./settings";
import { CommonSettings } from "./commonSettings";
import { SpaceFillingCurveLayouter } from "../linear/spaceFilling/spaceFillingLayouter";
import { SpaceFillingLayouterSettings } from "../linear/spaceFilling/spaceFillingSettings";
import { DagreLayouter } from "../dagre/dagreLayouter";
import { ViscomLayouter } from "../viscom/viscomLayouter";
import { ViscomLayouterSettings } from "../viscom/viscomSettings";
import { GraphvizLayouter } from "../graphviz/graphvizLayouter";
import { GraphvizLayouterSettings } from "../graphviz/graphvizSettings";

export const layouterMapping: Record<string, { label: string, layouter: typeof GraphLayouter<any>, settings: typeof GraphLayouterSettings }> = {
    "viscom": {
        label: "VisCom Layouts",
        layouter: ViscomLayouter,
        settings: ViscomLayouterSettings
    },
    "radial": {
        label: "Radial Layouts",
        layouter: RadialLayouter,
        settings: RadialLayouterSettings,
    },
    "fdg": {
        label: "Force Directed Graphs",
        layouter: FdgLayouter,
        settings: FdgLayouterSettings,
    },
    "graphviz": {
        label: "Graphviz Layouts",
        layouter: GraphvizLayouter,
        settings: GraphvizLayouterSettings
    },
    "arc": {
        label: "Arc Layouts",
        layouter: ArcLayouter,
        settings: ArcLayouterSettings
    },
    "spaceFilling": {
        label: "Space Filling Layouts",
        layouter: SpaceFillingCurveLayouter,
        settings: SpaceFillingLayouterSettings
    },

    // "dagre": {
    //     label: "Dagre Layouts",
    //     layouter: DagreLayouter,
    //     settings: GraphLayouterSettings
    // }
}

export interface SettingParamJson {
    [key: string]: any;
    key: string;
    active: boolean;
}

export interface SettingJson {
    [key: string]: SettingParamJson | string | number | boolean;
    key: string;
    active: boolean;
}

export interface SettingsJson {
    [key: string]: SettingJson | string | number;
    id: number;
    name: string;
}

export interface SettingsCollectionJson {
    commonSettings: SettingJson[];
    settings: {
        type: string
        settingsList: SettingsJson[];
    }[]
}

export class SettingsCollection {

    mapLayoutTypeToListOfSettings: Map<string, GraphLayouterSettings[]> = new Map();
    mapIdToSettings: Map<number, GraphLayouterSettings> = new Map();

    emitter = mitt<{
        newSettings: { currentIds: number[] }
    }>();


    commonSettings: CommonSettings = new CommonSettings({
        key: "commonSettings",
        label: "Common Settings",
        description: "Common settings for all layouters",
        optional: true,
    });

    constructor() { }

    get length() {
        return this.mapIdToSettings.size;
    }

    getSettings(id: number): GraphLayouterSettings | undefined {
        return this.mapIdToSettings.get(id);
    }

    deleteSetting(id: number) {
        console.log("Deleting settings", id);
        const settings = this.mapIdToSettings.get(id);
        if (!settings) {
            console.warn("No settings found for id", id);
            return;
        }
        console.log("Deleting settings", settings);

        const settingsList = this.mapLayoutTypeToListOfSettings.get(settings.type);
        if (!settingsList) {
            console.warn("No settings list found for type", settings.type);
            return;
        }

        const index = settingsList.indexOf(settings);
        if (index === -1) {
            console.warn("Setting not found in list", settings);
            return;
        }

        settingsList.splice(index, 1);
        this.mapIdToSettings.delete(id);

        this.emitter.emit("newSettings", { currentIds: Array.from(this.mapIdToSettings.keys()) });
    }

    addSetting(layouterType: string) {

        // Check, if there is a mapping for the layouter type
        if (!layouterMapping[layouterType]) {
            console.warn("No layouter found for type", layouterType);
            return;
        }

        if (this.mapLayoutTypeToListOfSettings.get(layouterType) === undefined) {
            this.mapLayoutTypeToListOfSettings.set(layouterType, []);
        }
        const settingsList = this.mapLayoutTypeToListOfSettings.get(layouterType)!;

        const layouter = layouterMapping[layouterType];

        if (!layouter) {
            console.warn("No layouter found for type", layouterType);
            return;
        }

        const settings = layouter.settings.createSettings(layouter.settings, layouterType);

        // Copy the last settings of that type
        if (settingsList.length > 0) {
            const lastSettings = settingsList[settingsList.length - 1];
            settings.loadFromJson(lastSettings.getJson());
        }


        settingsList.push(settings);
        this.mapIdToSettings.set(settings.id, settings);

        console.log(this);

        this.emitter.emit("newSettings", { currentIds: Array.from(this.mapIdToSettings.keys()) });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Load and save methods
    ////////////////////////////////////////////////////////////////////////////

    loadFromJson(json: SettingsCollectionJson) {

        // Clear the current settings
        this.mapLayoutTypeToListOfSettings.clear();
        this.mapIdToSettings.clear();

        for (const layouterName in layouterMapping) {
            if (this.mapLayoutTypeToListOfSettings.get(layouterName) === undefined) {
                this.mapLayoutTypeToListOfSettings.set(layouterName, []);
            }
            const settingsList = this.mapLayoutTypeToListOfSettings.get(layouterName)!;

            const layouter = layouterMapping[layouterName];

            if (!layouter || !json.settings) {
                console.warn("No settings found for layouter", layouterName);
                continue;
            }

            // There should be a list of settings for a specific layouter type
            const settingsListJson = json.settings.find(s => s.type === layouterName);
            if (!settingsListJson) {
                console.warn("No settings found for layouter", layouterName);
                continue;
            }

            // Each enty in the settings list is a settings configuration
            for (const settingsJson of settingsListJson.settingsList) {
                const settings = layouter.settings.createSettings(layouter.settings, layouterName)
                // const settings = layouter.settings.createSettings(layouterName)
                // const settings = new layouter.settings(layouterName);
                settings.loadFromJson(settingsJson);
                settingsList.push(settings);
                this.mapIdToSettings.set(settings.id, settings);
            }
        }

        this.commonSettings.loadFromJson(json.commonSettings);

        this.emitter.emit("newSettings", { currentIds: Array.from(this.mapIdToSettings.keys()) });
    }

    getJson(): SettingsCollectionJson {

        const settingsJson: SettingsCollectionJson = {
            commonSettings: [],
            settings: []
        };
        // Get common settings
        settingsJson.commonSettings = this.commonSettings.getJson();

        // Get visual settings

        for (const layouterName in layouterMapping) {
            const layouter = layouterMapping[layouterName];
            const settingsList = this.mapLayoutTypeToListOfSettings.get(layouterName)!;

            const settingsListJson: SettingsJson[] = settingsList.map(settings => settings.getJson());
            settingsJson.settings.push({
                type: layouterName,
                settingsList: settingsListJson,
            });
        }

        return settingsJson;
    }

}

