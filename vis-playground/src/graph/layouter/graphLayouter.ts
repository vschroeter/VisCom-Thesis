import { CommunicationGraph } from "../commGraph";
import { Graph2d } from "../graphical/Graph2d";


export class GraphLayouterSettings {
    constructor() { }

    /** List of all settings */
    get settings(): GraphLayouterSetting[] {
        // Iterate over the keys of the object and return the values of the object that are instances or subclasses of GraphLayouterSetting
        return Object.values(this).filter((value) => value instanceof GraphLayouterSetting);
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

}



export class GraphLayouter<T extends GraphLayouterSettings> {

    settings: T;
    commGraph: CommunicationGraph;
    graph2d: Graph2d;

    constructor(graph2d: Graph2d, settings: T) {
        this.commGraph = graph2d.commGraph;
        this.settings = settings;
        this.graph2d = graph2d;
    }

}