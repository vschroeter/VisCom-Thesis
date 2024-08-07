import { FdgLayouter } from "./fdg/fdgLayouter";
import { FdgLayouterSettings } from "./fdg/fdgSettings";
import { GraphLayouter } from "./layouter";
import { GraphLayouterSettings } from "./settings";

export const layouterMapping: Record<string, {label: string, layouter: typeof GraphLayouter<any>, settings: typeof GraphLayouterSettings }> = {
    "fdg": {
        label: "Force Directed Graphs",
        layouter: FdgLayouter,
        settings: FdgLayouterSettings,
    }
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
    settings: {
        type: string
        settingsList: SettingsJson[];
    }[]
}

export class SettingsCollection {

    mapLayoutTypeToListOfSettings: Map<string, GraphLayouterSettings[]> = new Map();
    mapIdToSettings: Map<number, GraphLayouterSettings> = new Map();

    constructor() { }

    getSettings(id: number): GraphLayouterSettings | undefined {
        return this.mapIdToSettings.get(id);
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

        const settings = new layouter.settings("New setting");
        settingsList.push(settings);
        this.mapIdToSettings.set(settings.id, settings);

        console.log(this);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Load and save methods
    ////////////////////////////////////////////////////////////////////////////

    loadFromJson(json: SettingsCollectionJson) {
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
                const settings = new layouter.settings(settingsJson.name);
                settings.loadFromJson(settingsJson);
                settingsList.push(settings);
                this.mapIdToSettings.set(settingsJson.id, settings);
            }
        }
    }

    getJson(): SettingsCollectionJson {
        const settingsJson: SettingsCollectionJson = {
            settings: []
        };

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

