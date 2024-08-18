import { Setting, ParamWithLinkContext, ParamWithNodeContext } from "./settings";


export class CommonSettings extends Setting {

    nodeColor = new ParamWithNodeContext({
        type: "color",
        key: "nodeColor",
        label: "Node Color",
        description: "The color of the nodes",
        optional: false,
        defaultValue: "#ff0000",
    })

    nodeSize = new ParamWithNodeContext({
        type: "number",
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




}


