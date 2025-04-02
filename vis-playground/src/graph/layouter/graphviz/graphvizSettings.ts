import { Setting, Param, GraphLayouterSettings, ParamChoice } from "../settings/settings";

export class GraphvizEngineSettings extends Setting {
    layoutEngine = new ParamChoice<string>({
        key: "layoutEngine",
        label: "Layout Engine",
        description: "The GraphViz layout engine to use",
        optional: false,
        defaultValue: "dot",
        choices: ["dot", "circo", "fdp", "neato", "twopi", "sfdp", "osage", "patchwork"],
    });

    horizontalLayout = new Param<boolean>({
        key: "horizontalLayout",
        label: "Horizontal Layout",
        description: "Set layout direction from left to right instead of top to bottom",
        optional: false,
        defaultValue: true,
        type: "boolean",
    });
}

export class GraphvizNodeSettings extends Setting {
    adaptSizeToScore = new Param<boolean>({
        key: "adaptSizeToScore",
        label: "Adapt Node Size To Score",
        description: "Scale node size according to its score/rank",
        optional: false,
        defaultValue: true,
        type: "boolean",
    });

    // includeNodeLabels = new Param<boolean>({
    //     key: "includeNodeLabels",
    //     label: "Include Node Labels",
    //     description: "Include node labels in the visualization",
    //     optional: false,
    //     defaultValue: false,
    //     type: "boolean",
    // });
}

export class GraphvizEdgeSettings extends Setting {
    allConnections = new Param<boolean>({
        key: "allConnections",
        label: "Show All Connections",
        description: "Show all connections including topic details",
        optional: false,
        defaultValue: false,
        type: "boolean",
        enabled: false,
    });

    includeEdgeLabels = new Param<boolean>({
        key: "includeEdgeLabels",
        label: "Include Edge Labels",
        description: "Include edge/connection labels in the visualization",
        optional: false,
        defaultValue: false,
        type: "boolean",
    });
}

export class GraphvizLayouterSettings extends GraphLayouterSettings {
    engine = new GraphvizEngineSettings({
        key: "engine",
        label: "Engine",
        description: "GraphViz engine settings",
        optional: false,
    });

    nodes = new GraphvizNodeSettings({
        key: "nodes",
        label: "Nodes",
        description: "Node visualization settings",
        optional: false,
    });

    edges = new GraphvizEdgeSettings({
        key: "edges",
        label: "Edges",
        description: "Edge visualization settings",
        optional: false,
    });

    constructor(type: string, name?: string) {
        super(type, name);
    }
}

