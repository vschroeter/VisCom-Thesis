import mitt from "mitt";
import { Connection2d, Node2d } from "../../graphical";
import { VisGraph } from "src/graph/visGraph/visGraph";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

const evaluateExpression = (expression: string, context: Record<string, any>): any => {
    const keys = Object.keys(context);
    const values = Object.values(context);

    // Create a new function with the context variables as parameters and the expression as the body
    const func = new Function(...keys, `return ${expression};`);

    // Call the function with the context values
    return func(...values);
}

export class GraphLayouterSettings {
    static currentId = 0;
    readonly id: number;

    /** Name of the settings under which they are stored. */
    name: string;

    /** Layouter type of the settings */
    type: string;

    [key: string]: any;

    emitter = mitt<{
        updatedSettingStatus: void
    }>();

    constructor(type: string, name?: string) {
        this.type = type;
        this.name = name ?? "";
        this.id = GraphLayouterSettings.currentId++;
    }

    public static createSettings<T extends GraphLayouterSettings>(cls: new (...args: any[]) => T, ...args: ConstructorParameters<typeof cls>): T {
        const settings = new cls(...args);
        settings.registerUpdates();
        return settings;
    }
    // public static createSettings<T extends GraphLayouterSettings>(this: new (...args: any[]) => T, type: string, name?: string): T {
    //     return new this(type, name);
    // }

    /** List of all settings */
    get settings(): Setting[] {
        // Iterate over the keys of the object and return the values of the object that are instances or subclasses of GraphLayouterSetting
        return Object.values(this).filter((value) => value instanceof Setting);
    }

    get shortSummary(): string {
        const settingStrings = new Array<string>();
        this.settings.forEach(setting => {
            const paramStrings = new Array<string>();
            setting.enabledParameters.forEach(param => {
                paramStrings.push(`${param.abbreviatedLabel}: ${param.textValue}`);
            });
            settingStrings.push(`${setting.abbreviatedLabel}: [` + paramStrings.join(", ") + "]");
        });
        return settingStrings.join("  |  ");
    }

    registerUpdates() {
        // For each setting, register an update listener
        this.settings.forEach(setting => {
            setting.registerUpdates();
            setting.emitter.on("updatedParameterStatus", () => {
                this.emitter.emit("updatedSettingStatus");
            });
        });
    }

    /** Load the settings from a json */
    loadFromJson(json: any) {
        // Iterate over the settings and load the values from the json
        this.name = json.name;
        // this.type = json.type ?? this.type;
        this.settings.forEach(setting => {
            if (json[setting.key]) {
                setting.loadFromJson(json[setting.key]);
            }
        });
    }

    getJson(): any {
        const json: any = {
            // id: this.id,
            // type: this.type,
            name: this.name,
        };

        // Iterate over the settings and get the json representation of each setting
        this.settings.forEach(setting => {
            json[setting.key] = setting.getJson();
        });

        return json;
    }

    getContext({ visGraph, nodes, links }:
        {
            visGraph?: VisGraph;
            nodes?: LayoutNode[];
            links?: LayoutConnection[];
        }
    ): Record<string, any> {

        const n = nodes ?? visGraph?.allLayoutNodes ?? [];
        const l = links ?? visGraph?.getAllConnections() ?? [];

        return {
            n: n.length,
            l: l.length,
        };
    }
}

////////////////////////////////////////////////////////////////////////////
// #region Setting
////////////////////////////////////////////////////////////////////////////

export class Setting {
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

    enabledParameters: Param[] = [];

    emitter = mitt<{
        updatedParameterStatus: void
    }>();

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
        this.active = optional ? active : true;
    }

    get parameters(): Param[] {
        return Object.values(this).filter((value) => value instanceof Param);
    }

    get parameterMap(): Record<string, Param> {
        return Object.fromEntries(this.parameters.map(param => [param.key, param]));
    }

    get abbreviatedLabel(): string {

        const label = this.label ?? this.key;
        const splits = label.split(" ");
        if (splits.length > 1) {
            return splits.map(word => word[0].toUpperCase()).join("");
        }

        return label.slice(0, 3).toUpperCase();
    }

    registerUpdates() {
        this.parameters.forEach(param => {
            param.emitter.on("updated", () => {
                // param.updateStatus();
                this.updateParamsStatus();
            });
        });
        this.updateParamsStatus();
    }

    updateParamsStatus(): boolean {
        let updated = false;
        this.parameters.forEach(param => {
            const pUpdated = param.updateStatus();
            updated = updated || pUpdated;
        });

        this.enabledParameters = this.parameters.filter(param => param.enabled);
        // console.log("Updated enabled parameters", this.enabledParameters, this);
        if (updated) {
            this.emitter.emit("updatedParameterStatus");
        }
        return updated;
    }

    loadFromJson(json: any) {
        try {
            this.active = json.active;

            this.parameters.forEach(param => {
                if (json[param.key]) {
                    param.loadFromJson(json[param.key]);
                }
            });
        } catch (error) {
            console.error("Error loading settings from json", error);
        }
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

////////////////////////////////////////////////////////////////////////////
// #region Param
////////////////////////////////////////////////////////////////////////////

export type ParamType = "number" | "int" | "float" | "string" | "color" | "boolean" | "choice";
export type NumberRange = { min?: number, max?: number };
export class Param<T = number> { //

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
    default: string | number | boolean;
    // value: T;

    choices: string[] = [];

    range?: NumberRange;

    /** Type of the parameter */
    type: ParamType;

    /** Whether the parameter is currently disabled */
    enabledCallback: boolean | (() => boolean) = true;
    enabled: boolean = true;

    protected _textValue: string;

    emitter = mitt<{
        updated: void
    }>();

    /** Tooltip to display in the UI */
    static tooltip: string | string[] = [
        "You can use the following graph variables:",
        "- n: Number of nodes",
        "- l: Number of links",
    ]

    tooltip: string | string[] = Param.tooltip;

    constructor({
        key,
        label,
        description,
        defaultValue,
        type = "string",
        optional = false,
        active = false,
        enabled = true,
        range,
        choices,
    }: {
        key: string,
        label?: string,
        description?: string,
        type?: ParamType,
        optional?: boolean,
        defaultValue: string | number | boolean,
        active?: boolean,
        enabled?: boolean | (() => boolean),
        range?: NumberRange,
        choices?: string[],
    }) {
        this.key = key;
        this.label = label || key;
        this.description = description;
        this.optional = optional;
        this.default = defaultValue;
        this.active = optional ? active : true;
        this._textValue = defaultValue as string;
        this.type = type;
        this.enabledCallback = enabled;
        this.range = range;
        this.choices = choices ?? [];

        this.updateStatus();
    }

    getValue(context?: Record<string, any>): T | undefined {
        if (!this.active) return undefined;

        try {
            const result = evaluateExpression(this._textValue as string, context ?? {});
            return result;
        } catch (error) {
            // console.error("Error evaluating expression", error);
        }

        // Cast string into number if possible
        if (this.type === "number") {
            const numberValue = Number(this._textValue);
            if (!isNaN(numberValue)) return numberValue as any;
        } else if (this.type === "string") {
            return this._textValue as any;
        } else if (this.type === "color") {
            return this._textValue as any;
        } else if (this.type === "boolean") {
            // @ts-expect-error TODO: better generic types
            return this._textValue === "true" as any;
        } else if (this.type === "choice") {
            return this._textValue as any;
        }
        return undefined;
    }

    get value(): T | string {
        return this.getValue() ?? this._textValue;
    }

    get textValue(): string | undefined {
        if (this.active) return this._textValue;

        return undefined;
    }

    set textValue(value: string) {
        this._textValue = value;
        this.emitter.emit("updated");
    }

    updateStatus(): boolean {
        const enabled = this.enabled;
        if (typeof this.enabledCallback === "function") {
            this.enabled = this.enabledCallback();
        } else {
            this.enabled = this.enabledCallback;
        }
        // console.log("Updated status", this.key, this.enabled);
        return enabled !== this.enabled;
    }

    get abbreviatedLabel(): string {

        const label = this.label ?? this.key;
        const splits = label.split(" ");
        if (splits.length > 1) {
            return splits.map(word => word[0].toUpperCase()).join("");
        }

        return label.slice(0, 3);
    }

    loadFromJson(json: any) {
        try {
            this.active = json.active;
            this._textValue = json.value;
        } catch (error) {
            console.error("Error loading settings from json", error);
        }
    }

    getJson(): any {
        return {
            key: this.key,
            active: this.active,
            value: this._textValue,
        }
    }
}

export class ParamWithNodeContext extends Param {

    static override tooltip: string[] = [...Param.tooltip,
        "You can use the following node params:",
        "- cs: Number of successors",
        "- cp: Number of predecessors",
        "- cn: Number of neighbors",
        "- co: Number of outgoing links",
        "- ci: Number of incoming links",
        "- cl: Number of links",
        "- r: Radius of the node",
    ]

    override tooltip: string[] = ParamWithNodeContext.tooltip;

    override getValue(node?: LayoutNode, context?: Record<string, any>): number | undefined {
        let ctx: Record<string, any> = {
            cs: 1,
            cp: 1,
            cn: 1,
            co: 1,
            ci: 1,
            cl: 1,
            r: 1,
        };

        if (node) {
            const cs = node.successorCount ?? 0;
            const cp = node.predecessorCount ?? 0;
            const cn = cs + cp;

            const co = node.outDegree ?? 0;
            const ci = node.inDegree ?? 0;
            const cl = co + ci;

            const r = node.radius ?? 1;

            context = {
                cs,
                cp,
                cn,
                co,
                ci,
                cl,
                r
            };
        }
        // Merge the context with the node context
        ctx = { ...ctx, ...context };
        return super.getValue(ctx);
    }
}

export class ParamWithLinkContext extends Param {

    static override tooltip: string[] = [...Param.tooltip,
        "You can use the following link params:",
        "- ct: Number of connections on the target node",
        "- cs: Number of connections on the source node",
        "- cd: Number of connections on both nodes (sum of degrees)",
        "- w: Weight of the link",
    ]

    override tooltip: string[] = ParamWithLinkContext.tooltip;

    override getValue(link?: LayoutConnection, context?: Record<string, any>): number | undefined {
        let ctx: Record<string, any> = {
            ct: 1,
            cs: 1,
            cd: 1,
            w: 1,
        };

        ctx = { ...ctx, ...context };

        if (link) {
            const countTargetConnections = (link.target.successorCount ?? 1) + (link.target.predecessorCount ?? 1) - 1;
            const countSourceConnections = (link.source.predecessorCount ?? 1) + (link.source.successorCount ?? 1) - 1;
            ctx.ct = countTargetConnections;
            ctx.cs = countSourceConnections;
            ctx.cd = countSourceConnections + countTargetConnections;
            ctx.w = link.weight ?? 1;
        }
        return super.getValue(ctx);
    }
}



export class ParamChoice<T extends string> extends Param<string> {

    override choices: T[];

    constructor({
        key,
        label,
        description,
        choices,
        defaultValue,
        // type = "string",
        optional = false,
        active = false,
        enabled = true,
    }: {
        key: string,
        label?: string,
        description?: string,
        choices: T[],
        // type?: ParamType,
        optional: boolean,
        defaultValue: string | number,
        active?: boolean,
        enabled?: boolean | (() => boolean),
    }) {
        super({
            key,
            label,
            description,
            type: "choice",
            optional,
            defaultValue,
            active,
            enabled,
        });

        this.choices = choices;
    }
}
