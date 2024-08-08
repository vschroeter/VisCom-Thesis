import { AbstractConnection2d, AbstractNode2d } from "../graphical";

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

    constructor(type: string, name?: string) {
        this.type = type;
        this.name = name ?? "";
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

    get parameters(): GraphLayouterSettingParam[] {
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

export class GraphLayouterSettingParam { // 

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
    default: string | number;
    // value: T;
    protected _textValue: string;

    /** Tooltip to display in the UI */
    tooltip: string | string[] = ""

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
        defaultValue: string | number,
        active?: boolean,
    }) {
        this.key = key;
        this.label = label || key;
        this.description = description;
        this.optional = optional;
        this.default = defaultValue;
        this.active = optional ? active : true;
        this._textValue = defaultValue as string;
    }

    getValue(context?: Record<string, any>): any {
        if (!this.active) return undefined;

        try {
            const result = evaluateExpression(this._textValue as string, context ?? {});
            return result;
        } catch (error) {
            // console.error("Error evaluating expression", error);
        }

        // Cast string into number if possible
        const numberValue = Number(this._textValue);
        if (!isNaN(numberValue)) return numberValue;
        return undefined;
    }

    get textValue(): string | undefined {
        if (this.active) return this._textValue;

        return undefined;
    }

    set textValue(value: string) {
        this._textValue = value;
    }

    loadFromJson(json: any) {
        this.active = json.active;
        this._textValue = json.value;
    }

    getJson(): any {
        return {
            key: this.key,
            active: this.active,
            value: this._textValue,
        }
    }
}

export class GraphLayouterSettingNodeParam extends GraphLayouterSettingParam {

    tooltip: string[] = [
        "You can use the following node params:",
        "- cs: Number of successors",
        "- cp: Number of predecessors",
        "- cn: Number of neighbors",
        "- co: Number of outgoing links",
        "- ci: Number of incoming links",
        "- cl: Number of links",
    ]

    getValue(node?: AbstractNode2d): number | undefined {
        let context: Record<string, any> = {
            cs: 1,
            cp: 1,
            cn: 1,
            co: 1,
            ci: 1,
            cl: 1,
        };

        if (node) {
            const successors = node.data?.getSuccessors();
            const predecessors = node.data?.getPredecessors();
            const cs = successors?.length ?? 0;
            const cp = predecessors?.length ?? 0;
            const cn = cs + cp;

            const outgoingLinks = node.data?.getOutgoingLinks();
            const incomingLinks = node.data?.getIncomingLinks();
            const co = outgoingLinks?.length ?? 0;
            const ci = incomingLinks?.length ?? 0;
            const cl = co + ci;

            context = {
                cs,
                cp,
                cn,
                co,
                ci,
                cl,
            };
        }
        return super.getValue(context);
    }
}

export class GraphLayouterSettingLinkParam extends GraphLayouterSettingParam {

    tooltip: string[] = [
        "You can use the following link params:",
        "- ct: Number of connections on the target node",
        "- cs: Number of connections on the source node",
        "- cd: Number of connections on both nodes (sum of degrees)",
    ]

    getValue(node?: AbstractConnection2d): number | undefined {
        let context: Record<string, any> = {
            ct: 1,
            cs: 1,
            cd: 1
        };

        if (node) {
            const countTargetConnections = node.target.data?.getSuccessors()?.length ?? 1;
            const countSourceConnections = node.source.data?.getPredecessors()?.length ?? 1;
            context = {
                ct: countTargetConnections,
                cs: countSourceConnections,
                cd: countSourceConnections + countTargetConnections
            };
        }
        return super.getValue(context);
    }
}
