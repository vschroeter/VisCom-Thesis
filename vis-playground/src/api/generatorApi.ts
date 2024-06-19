export interface ApiParam {
    default: number | null;
    description: string;
    range: [number, number];
    type: 'int' | 'float';
}

export interface ApiGeneratorParams {
    [key: string]: ApiParam;
}

export interface ApiGenerator {
    description: string;
    params: ApiGeneratorParams;
}

export interface ApiGeneratorMethods {
    [key: string]: ApiGenerator;
}

export class Param {
    key: string;
    default: number | null;
    description: string;
    range: { min: number, max: number}
    type: 'int' | 'float';
    value: number

    constructor(key: string, param: ApiParam) {
        this.key = key;
        this.default = param.default;
        this.description = param.description;
        this.range = { min: param.range[0], max: param.range[1] };
        this.type = param.type;
        this.value = this.default || this.range.min;
    }
}

export class Generator {
    key: string;
    description: string;
    params: Map<string, Param>;

    constructor(key: string, gen: ApiGenerator) {
        this.key = key;
        this.description = gen.description;
        this.params = new Map<string, Param>();

        for (const [key, param] of Object.entries(gen.params)) {
            this.params.set(key, new Param(key, param));
        }
    }

    // Getter for param list
    get paramList(): Param[] {
        return Array.from(this.params.values());
    }
}

export class GeneratorMethods {
    // [key: string]: Generator;
    public generators = new Map<string, Generator>();

    constructor(api: ApiGeneratorMethods) {
        for (const [key, gen] of Object.entries(api)) {
            // this[key] = new Generator(graph);
            this.generators.set(key, new Generator(key, gen));
        }
    }
}

