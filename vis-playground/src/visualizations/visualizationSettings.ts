import * as d3 from 'd3';

type SettingMappingType = {
    [key: string]: string;
}

export class VisualizationSettings<SettingMapping extends SettingMappingType> {

    settings: VisualizationSetting<any>[] = [];
    settingNames: string[] = [];
    private settingsMap: Map<string, VisualizationSetting> = new Map();

    constructor({ settings }: { settings: VisualizationSetting<any>[] }) {
        settings.forEach((setting) => {
            this.settings.push(setting);
            this.settingNames.push(setting.key);
            this.settingsMap.set(setting.key, setting);
        });

        // const keysOfObject = Object.keys(this);
        // console.log("###", this, keysOfObject);
        // Object.keys(this).forEach((key) => {
        //     /* We can access the properties of the class instance using this[key]
        //     @@ts-expect-error */
        //     const obj = this[key];
        //     console.log(key, obj);
        //     if (obj instanceof VisualizationSetting) {
        //         obj.key = key;
        //         this.settingsMap.set(key, obj);
        //         this.settings.push(obj);
        //     }
        // });
    }

    // get settingsList() {
    //     return Array.from(this.settingsMap.values());
    // }

    getSetting<K extends keyof SettingMapping>(name: K): VisualizationSetting<SettingMapping[K]> {
        return this.settingsMap.get(name.toString())!;
    }
}

export class VisualizationSetting<ParamNames extends string = string> {
    key: string = "";
    optional: boolean;
    active: boolean = false;
    method: CallableFunction | null = null;
    // params: [string, VisualizationSettingParam<any>];
    // params: Map<string, VisualizationSettingParam<any>> = new Map();
    paramNames: string[] = [];
    params: VisualizationSettingParam<any>[];
    paramValues: Map<string, any> = new Map();

    private paramMap: Map<string, VisualizationSettingParam<any>> = new Map();

    constructor({
        key,
        optional = false,
        active = false,
        method = null,
        params = [],
    }: {
        key: string,
        optional?: boolean,
        method?: any,
        active?: boolean,
        params?: VisualizationSettingParam<any>[],
    }) {
        this.key = key;
        this.optional = optional;
        this.method = method;
        this.params = params;
        this.active = active;

        params.forEach((param) => {
            this.paramNames.push(param.key);
            this.paramMap.set(param.key, param);
        });

        // Object.keys(params).forEach((key) => {
        //     this.params.set(key, params[key]);
        // });
    }

    getParam(name: ParamNames) {
        return this.paramMap.get(name);
    }
}

export class VisualizationSettingParam<T> {
    key: string;
    optional: boolean;
    active: boolean = false;
    default: T;
    // value: T;
    private _value: T;

    constructor({
        key,
        optional,
        default: defaultValue,
    }: {
        key: string,
        optional: boolean,
        default: T,
    }) {
        this.key = key;
        this.optional = optional;
        if (!optional) {
            this.active = true;
        }
        this.default = defaultValue;
        this._value = defaultValue;
    }

    get value(): T | undefined {
        if (this.active) return this._value;
        
        return undefined;
    }

    set value(value: T) {
        this._value = value;
    }

}

type FdgSettingParamMapping = {
    // forceCenter: "x" | "y" | "strength",
    forceCenter: "strength",
    forceLink: "distance" | "strength",
    forceManyBody: "strength",
    forceCollide: "radius" | "strength"
};



export class FdgVisSettings extends VisualizationSettings<FdgSettingParamMapping> {

    constructor() {
        super({
            settings: [
                new VisualizationSetting<FdgSettingParamMapping["forceManyBody"]>({
                    key: "forceManyBody",
                    optional: true,
                    active: true,
                    method: d3.forceManyBody,
                    params: [
                        new VisualizationSettingParam({
                            key: "strength",
                            optional: false,
                            default: -20,
                        }),
                    ]
                }),
                new VisualizationSetting<FdgSettingParamMapping["forceCenter"]>({
                    key: "forceCenter",
                    optional: true,
                    method: d3.forceCenter,
                    params: [
                        // new VisualizationSettingParam({
                        //     key: "x",
                        //     optional: true,
                        //     default: 0,
                        // }),
                        // new VisualizationSettingParam({
                        //     key: "y",
                        //     optional: true,
                        //     default: 0,
                        // }),
                        new VisualizationSettingParam({
                            key: "strength",
                            optional: false,
                            default: 1,
                        }),
                    ]
                }),
                new VisualizationSetting<FdgSettingParamMapping["forceLink"]>({
                    key: "forceLink",
                    optional: true,
                    method: d3.forceLink,
                    params: [
                        new VisualizationSettingParam({
                            key: "distance",
                            optional: true,
                            default: 30,
                        }),
                        new VisualizationSettingParam({
                            key: "strength",
                            optional: true,
                            default: 1,
                        }),
                    ]
                }),

                new VisualizationSetting<FdgSettingParamMapping["forceCollide"]>({
                    key: "forceCollide",
                    optional: true,
                    method: d3.forceCollide,
                    params: [
                        new VisualizationSettingParam({
                            key: "radius",
                            optional: true,
                            default: 5,
                        }),
                        new VisualizationSettingParam({
                            key: "strength",
                            optional: true,
                            default: 0.5,
                        }),
                    ]
                }),
            ]
        });
    }

}

// const a = new FdgVisSettings();
// a.getSetting('forceCenter').getParam('strength')
// a.getSetting('forceLink').getParam('strength')



// a.forceCenter.getParam("x")