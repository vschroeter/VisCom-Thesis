import { LinearGraphLayouterSettings } from "../../settings/linearSettings";
import { Param, ParamChoice, Setting } from "../../settings/settings";


export class SizeSettings extends Setting {
    size = new Param({
        key: "size",
        optional: false,
        defaultValue: "20",
    });

    constructor() {
        super({
            key: "size",
            label: "Size",
            description: "Size settings for the layout.",
            optional: false,
        });
    }
}

export class CurveSettings extends Setting {
    order = new Param({
        key: "order",
        optional: false,
        defaultValue: "2",
    });

    curveType = new ParamChoice({
        key: "curveType",
        optional: false,
        defaultValue: "Hilbert",
        choices: [
            "Hilbert",
            "Moore",
            "Peano",
            "Gosper",
            "Sierpinski Arrowhead",
            "Sierpinski Curve",
        ],
    });

    constructor() {
        super({
            key: "curve",
            label: "Curve",
            description: "Curve settings for the layout.",
            optional: false,
        });
    }
}



export class SpaceFillingLayouterSettings extends LinearGraphLayouterSettings {
    size = new SizeSettings();
    curve = new CurveSettings();
}


