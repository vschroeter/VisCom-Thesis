import { Param } from "src/graph/layouter/settings/settings";

export interface ApiParam {
    key: string;
    default: number | null;
    description: string;
    range?: [number, number];
    type: 'int' | 'float' | 'boolean' | 'string';
    choices?: string[];
}

export interface ApiGenerator {
    description: string;
    // params: ApiGeneratorParams;
    params: ApiParam[];
    is_saved_dataset?: boolean;
    is_synthetic?: boolean;
}

export interface ApiGeneratorMethods {
    [key: string]: ApiGenerator;
}

export class Generator {
    key: string;
    description: string;
    isStoredDataset: boolean = false;
    isSynthetic: boolean = false;
    params: Map<string, Param>;

    get isGenerator(): boolean {
        return !this.isStoredDataset
    }

    get isSyntheticDataset(): boolean {
        return this.isStoredDataset && this.isSynthetic;
    }
    get isRealDataset(): boolean {
        return this.isStoredDataset && !this.isSynthetic;
    }

    constructor(key: string, gen: ApiGenerator) {
        this.key = key;
        this.description = gen.description;
        this.params = new Map<string, Param>();

        if (gen.is_saved_dataset) {
            this.isStoredDataset = true;
        }

        if (gen.is_synthetic) {
            this.isSynthetic = true;
        }

        // console.log(gen);
        for (const param of gen.params) {
            this.params.set(param.key, new Param({
                key: param.key,
                defaultValue: param.default ?? 0,
                description: param.description,
                optional: false,
                type: param.type,
                range: { min: param.range?.[0], max: param.range?.[1] },
                choices: param.choices,
            }));
        }
    }

    // Getter for param list
    get paramList(): Param[] {
        return Array.from(this.params.values());
    }

    get parameterRecord(): Record<string, Param> {
        return Object.fromEntries(this.paramList.map(p => [p.key, p]));
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

