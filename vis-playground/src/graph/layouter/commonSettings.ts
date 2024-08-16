import { GraphLayouterSetting, GraphLayouterSettingLinkParam, GraphLayouterSettingNodeParam } from "./settings";


export class CommonSettings extends GraphLayouterSetting {

    nodeColor = new GraphLayouterSettingNodeParam({
        type: "color",
        key: "nodeColor",
        label: "Node Color",
        description: "The color of the nodes",
        optional: false,
        defaultValue: "#ff0000",
    })

    nodeSize = new GraphLayouterSettingNodeParam({
        type: "number",
        key: "nodeSize",
        label: "Node Size",
        description: "The size of the nodes",
        optional: false,
        defaultValue: 10,
    })

    linkColor = new GraphLayouterSettingLinkParam({
        type: "color",
        key: "linkColor",
        label: "Link Color",
        description: "The color of the links",
        optional: false,
        defaultValue: "#000000AA",
    })




}


