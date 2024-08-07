export class GraphLayouterSettings {
    static currentId = 0;
    readonly id: number;
    
    /** Name of the settings under which they are stored. */
    name: string;

    [key: string]: any;

    constructor(name?: string) {
        this.name = name ?? "Settings"; 
        this.id = GraphLayouterSettings.currentId++;
    }

    /** List of all settings */
    get settings(): GraphLayouterSetting[] {
        // Iterate over the keys of the object and return the values of the object that are instances or subclasses of GraphLayouterSetting
        return Object.values(this).filter((value) => value instanceof GraphLayouterSetting);
    }

    /** Load the settings from a json */
    loadFromJson(json: any) {
        // Iterate over the settings and load the values from the json
        this.settings.forEach(setting => {
            if (json[setting.key]) {
                setting.loadFromJson(json[setting.key]);
            }
        });
    }

    getJson(): any {
        const json: any = {
            id: this.id,
            name: this.name,
        };

        // Iterate over the settings and get the json representation of each setting
        this.settings.forEach(setting => {
            json[setting.key] = setting.getJson();
        });

        return json;
    }
}

export class GraphLayouterSetting {
    /** Key to identify the setting */
    key: string;

    /** Label to display in the UI */
    label?: string;

    /** Description to display in the UI */
    description?: string;

    /** Whether the setting is optional */
    optional: boolean;

    /** Whether the setting is currently active */
    active: boolean;

    constructor({
        key,
        label,
        description,
        optional = false,
        active = false,
    }: {
        key: string,
        label?: string,
        description?: string,
        optional?: boolean,
        active?: boolean,
    }) {
        this.key = key;
        this.label = label || key;
        this.description = description;
        this.optional = optional;
        this.active = active;
    }

    get parameters(): GraphLayouterSettingParam<any>[] {
        return Object.values(this).filter((value) => value instanceof GraphLayouterSettingParam);
    }

    loadFromJson(json: any) {
        this.active = json.active;

        this.parameters.forEach(param => {
            if (json[param.key]) {
                param.loadFromJson(json[param.key]);
            }
        });
    }

    getJson(): any {
        const json: any = {
            key: this.key,
            active: this.active,
        };

        this.parameters.forEach(param => {
            json[param.key] = param.getJson();
        });

        return json;
    }
}

export class GraphLayouterSettingParam<T> { // 

    /** Key to identify the parameter */
    key: string;

    /** Label to display in the UI */
    label?: string;

    /** Description to display in the UI */
    description?: string;

    /** Whether the parameter is optional */
    optional: boolean;

    /** Whether the parameter is currently active */
    active: boolean = false;

    /** Default value of the parameter */
    default: T;
    // value: T;
    private _value: T;

    constructor({
        key,
        label,
        description,
        defaultValue,
        optional = false,
        active = false,
    }: {
        key: string,
        label?: string,
        description?: string,
        optional: boolean,
        defaultValue: T,
        active?: boolean,
    }) {
        this.key = key;
        this.label = label || key;
        this.description = description;
        this.optional = optional;
        this.default = defaultValue;
        this.active = optional ? active : true;
        this._value = defaultValue;
    }

    get value(): T | undefined {
        if (this.active) return this._value;

        return undefined;
    }

    set value(value: T) {
        this._value = value;
    }

    loadFromJson(json: any) {
        this.active = json.active;
        this._value = json.value;
    }

    getJson(): any {
        return {
            key: this.key,
            active: this.active,
            value: this._value,
        }
    }
}
