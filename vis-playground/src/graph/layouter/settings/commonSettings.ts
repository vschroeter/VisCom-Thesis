import { Setting, ParamWithLinkContext, ParamWithNodeContext, Param } from "./settings";


export class CommonSettings extends Setting {

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

    showCommunities = new Param({
        type: "boolean",
        key: "showCommunities",
        label: "Show Communities",
        description: "Show communities",
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



}


