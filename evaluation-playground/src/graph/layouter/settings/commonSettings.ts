import { Setting, ParamWithLinkContext, ParamWithNodeContext, Param, ParamChoice } from "./settings";


export class CommonSettings extends Setting {

    calculateMetrics = new Param<boolean>({
        type: "boolean",
        key: "calculateMetrics",
        label: "Calculate Metrics",
        description: "Calculate metrics during layout",
        optional: false,
        defaultValue: false,
    })

    notifyWhenFinished = new Param<boolean>({
        type: "boolean",
        key: "notifyWhenFinished",
        label: "Notify When Metrics Finished",
        description: "Show a notification when metrics calculation is complete",
        optional: false,
        defaultValue: false,
    })

    tileSize = new Param<number>({
        type: "number",
        key: "tileSize",
        label: "Visualization Tile Size",
        description: "The size of the tiles",
        optional: false,
        defaultValue: 200,
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
        defaultValue: "yellow-green-blue",
    })

    hideLinksThreshold = new Param({
        type: "number",
        key: "hideLinksThreshold",
        label: "Threshold to Hide Links",
        description: "Hide links with a weight below this threshold. A commonly good value is something below 0.25.",
        optional: false,
        defaultValue: 0.2,
    })

    // nodeColor = new ParamWithNodeContext({
    //     type: "color",
    //     key: "nodeColor",
    //     label: "Node Color",
    //     description: "The color of the nodes",
    //     optional: false,
    //     defaultValue: "#ff0000",
    // })

    // nodeSize = new ParamWithNodeContext({
    //     type: "string",
    //     key: "nodeSize",
    //     label: "Node Size",
    //     description: "The size of the nodes",
    //     optional: false,
    //     defaultValue: 10,
    // })

    linkColor = new ParamWithLinkContext({
        type: "color",
        key: "linkColor",
        label: "Link Color",
        description: "The color of the links",
        optional: false,
        defaultValue: "#2b303dab",
    })

    enableLinkOpacity = new Param<boolean>({
        type: "boolean",
        key: "enableLinkOpacity",
        label: "Enable Link Opacity",
        description: "Enable link opacity based on link score",
        optional: false,
        defaultValue: true,
    })

    linkWidthMultiplier = new Param<number>({
        type: "number",
        key: "linkWidthMultiplier",
        label: "Link Width Multiplier",
        description: "The multiplier for the link width",
        optional: false,
        defaultValue: 2,
    })

    showLinkScore = new Param<boolean>({
        type: "boolean",
        key: "showLinkScore",
        label: "Display Link Score",
        description: "Adapt link width based on link score",
        optional: false,
        defaultValue: true,
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
        description: "Combine path and arrow (for better PDF export, but metrics could be wrong)",
        optional: false,
        defaultValue: false,
    })

    displayNodeLabels = new Param<boolean>({
        type: "boolean",
        key: "displayNodeLabels",
        label: "Show Node Labels",
        description: "Display the names of the nodes as labels",
        optional: false,
        defaultValue: true,
    })

    labelSizeMultiplier = new Param<number>({
        type: "number",
        key: "labelSizeMultiplier",
        label: "Label Size Multiplier",
        description: "The multiplier for the label size",
        optional: false,
        defaultValue: 1,
    })


    showNodeScore = new Param<boolean>({
        type: "boolean",
        key: "showNodeScore",
        label: "Display Node Score",
        description: "Display node score as node radius",
        optional: false,
        defaultValue: true,
    })

    showCommunityColors = new Param<boolean>({
        type: "boolean",
        key: "showCommunityColors",
        label: "Community Colors for Nodes",
        description: "Nodes are colored by community",
        optional: false,
        defaultValue: true,
    })


    showHyperNodeEdges = new Param<boolean>({
        type: "boolean",
        key: "showHyperNodeEdges",
        label: "Display Hyper Node Outlines",
        description: "Show hyper node outlines",
        optional: false,
        defaultValue: true,
    })

}


