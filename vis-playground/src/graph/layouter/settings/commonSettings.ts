import { Setting, ParamWithLinkContext, ParamWithNodeContext, Param, ParamChoice } from "./settings";


export class CommonSettings extends Setting {

    calculateMetrics = new Param<boolean>({
        type: "boolean",
        key: "calculateMetrics",
        label: "Calculate Metrics",
        description: "Calculate metrics during layout",
        optional: false,
        defaultValue: true,
    })

    tileSize = new Param<number>({
        type: "number",
        key: "tileSize",
        label: "Tile Size",
        description: "The size of the tiles",
        optional: false,
        defaultValue: 200,
    })

    nodeColor = new ParamWithNodeContext({
        type: "color",
        key: "nodeColor",
        label: "Node Color",
        description: "The color of the nodes",
        optional: false,
        defaultValue: "#ff0000",
    })

    nodeSize = new ParamWithNodeContext({
        type: "string",
        key: "nodeSize",
        label: "Node Size",
        description: "The size of the nodes",
        optional: false,
        defaultValue: 10,
    })

    linkColor = new ParamWithLinkContext({
        type: "color",
        key: "linkColor",
        label: "Link Color",
        description: "The color of the links",
        optional: false,
        defaultValue: "#000000AA",
    })

    linkWidthMultiplier = new Param<number>({
        type: "number",
        key: "linkWidthMultiplier",
        label: "Link Width Multiplier",
        description: "The multiplier for the link width",
        optional: false,
        defaultValue: 1,
    })

    labelSizeMultiplier = new Param<number>({
        type: "number",
        key: "labelSizeMultiplier",
        label: "Label Size Multiplier",
        description: "The multiplier for the label size",
        optional: false,
        defaultValue: 1,
    })

    arrowSize = new Param<number>({
        type: "number",
        key: "arrowSize",
        label: "Arrow Size",
        description: "The size of the arrows",
        optional: false,
        defaultValue: 5,
    })

    combinePathAndArrow = new Param<boolean>({
        type: "boolean",
        key: "combinePathAndArrow",
        label: "Combine Path And Arrow",
        description: "Combine path and arrow",
        optional: false,
        defaultValue: true,
    })


    showLinkScore = new Param<boolean>({
        type: "boolean",
        key: "showLinkScore",
        label: "Show Link Score",
        description: "Display link score as link width",
        optional: false,
        defaultValue: true,
    })

    showNodeScore = new Param<boolean>({
        type: "boolean",
        key: "showNodeScore",
        label: "Show Node Score",
        description: "Display node score as node radius",
        optional: false,
        defaultValue: true,
    })

    showCommunityColors = new Param<boolean>({
        type: "boolean",
        key: "showCommunityColors",
        label: "Show Community Colors",
        description: "Display community colors",
        optional: false,
        defaultValue: true,
    })

    hideLinksThreshold = new Param({
        type: "number",
        key: "hideLinksThreshold",
        label: "Hide Links Threshold",
        description: "Hide links with a weight below this threshold",
        optional: false,
        defaultValue: 0.25,
    })

    hideNodeNames = new Param({
        type: "boolean",
        key: "hideNodeNames",
        label: "Hide Node Names",
        description: "Hide the names of the nodes",
        optional: false,
        defaultValue: false,
    })

    showHyperNodeEdges = new Param<boolean>({
        type: "boolean",
        key: "showHyperNodeEdges",
        label: "Show Hyper Node Edges",
        description: "Show hyper node edges",
        optional: false,
        defaultValue: true,
    })

    nodeScoreColorScheme = new ParamChoice({
        choices: [
            "warm",
            "cool",
            "blue",
            "green",
            "orange",
            "red",
            "purple",
            "orange-red",
            "yellow-green-blue",
            "yellow-green",
            "yellow-orange-red",
            "turbo",
            "viridis",
            "inferno",
            "magma",
            "plasma",
            "cividis",
            "red-yellow-green",
        ],
        key: "nodeScoreColorScheme",
        label: "Node Score Color Scheme",
        description: "The color scheme for node scores",
        optional: false,
        defaultValue: "blue",
    })





}


