import { Circle, Point, Ray, Segment, Shape, ShapeTag } from "2d-geometry";
import { CommunicationGraph, CommunicationNode } from "../commGraph";
import { Anchor, Connection2d, Node2d } from "../graphical";
import { MouseEvents, UserInteractions } from "../visualizations/interactions";
import { CommonSettings } from "./settings/commonSettings";
import { GraphLayouterSettings } from "./settings/settings";

import * as d3 from 'd3';
import { VisGraph } from "../visGraph/visGraph";
import { LayoutNode } from "../visGraph/layoutNode";

export interface GraphLayouterConstructorArgs<T extends GraphLayouterSettings> {
    nodes: CommunicationNode[];
    settings: T;
    commGraph: CommunicationGraph;
    commonSettings: CommonSettings;
    initOnConstruction?: boolean;
}

export class RenderArgs {
    commonSettings: CommonSettings;
    userInteractions: UserInteractions;
    nodeScoring: NodeScoring;
    nodeFillColorGetter: (n: LayoutNode) => string;

    constructor(commonSettings: CommonSettings, userInteractions: UserInteractions, nodeScoring: NodeScoring, nodeFillColorGetter: (n: LayoutNode) => string) {
        this.commonSettings = commonSettings;
        this.userInteractions = userInteractions;
        this.nodeScoring = nodeScoring;
        this.nodeFillColorGetter = nodeFillColorGetter;
    }
}

export class NodeScoring {
    extent: [number, number] = [0, 0];
    colorScheme: (t: number) => string = d3.interpolateRdYlGn;

    getColor(value: number) {
        if (!this.isExtentValid()) {
            return "red";
        }

        const scale = d3.scaleLinear().domain(this.extent).range([0, 1]);
        return this.colorScheme(scale(value));
    }

    getExtent(nodes: Node2d[]) {
        this.extent = d3.extent(nodes, d => d.score) as [number, number];
    }

    isExtentValid() {
        return this.extent[0] !== this.extent[1] && Math.abs(this.extent[0]) !== Infinity && Math.abs(this.extent[1]) !== Infinity;
    }
}

export class GraphLayouter<T extends GraphLayouterSettings> {

    settings: T;
    visGraph!: VisGraph;

    // debugShapes: Shape[] = [];

    get debugShapes(): (Shape | Anchor)[] {
        const shapes: (Shape | Anchor)[] = [];
        this.visGraph?.allGraphicalNodes.forEach(n => {
            if (n.layoutNode.debugShapes.length > 0) {
                shapes.push(...n.layoutNode.debugShapes);
            }
        });

        this.visGraph?.allGraphicalConnections.forEach(l => {
            if (l.layoutConnection.debugShapes.length > 0) {
                shapes.push(...l.layoutConnection.debugShapes);
            }
        });
        return shapes;
    }

    gParent: d3.Selection<SVGGElement | null, unknown, null, undefined> | null = null;

    get userInteractions() {
        return this.visGraph?.userInteractions;
    }
    commonSettings: CommonSettings;
    // userInteractions: UserInteractions;
    // nodeScoring: NodeScoring = new NodeScoring();

    commGraph: CommunicationGraph;
    nodes: CommunicationNode[] = [];

    center: Point = new Point(0, 0);

    calculateMetrics: boolean = true;

    protected events: { [key: string]: ((this: GraphLayouter<any>) => void) } = {};

    constructor(layouterArgs: GraphLayouterConstructorArgs<T>) {
        console.log("Creating layouter", layouterArgs);
        this.commGraph = layouterArgs.commGraph;
        this.settings = layouterArgs.settings;
        this.commonSettings = layouterArgs.commonSettings;

        this.nodes = layouterArgs.nodes;

        this.resetVisGraph();
        if (layouterArgs.initOnConstruction) {
            this.initVisGraph();
        }
    }

    resetVisGraph() {
        this.visGraph?.renderer.clear();
        this.visGraph = VisGraph.fromCommGraph(this.commGraph, this.commonSettings);
    }

    protected initVisGraph(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    get nodes2d(): Node2d[] {
        return this.visGraph?.allGraphicalNodes;
    }

    get connections2d(): Connection2d[] {
        return this.visGraph?.allGraphicalConnections;
    }

    adaptNodesByCenterTranslation() {
        this.nodes2d.forEach(node => {
            node.x += this.center.x;
            node.y += this.center.y;
        });
    }

    updateGraphByCommonSettings() {
        this.updateStyle();
    }

    updateLayout(isUpdate: boolean = false): void {
        this.initVisGraph().then(() => {
            this.updateGraphByCommonSettings();
            this.layout(isUpdate);
            // this.emitEvent("update");
        });
        // this.layout(isUpdate);
    }

    protected markConnectionsAsUpdateRequired() {
        this.connections2d.forEach(link => {
            link.requireUpdate();
        });
    }

    protected markNodesAsUpdateRequired() {
        this.nodes2d.forEach(node => {
            node.requireUpdate();
        });
    }

    async layout(isUpdate = false): Promise<void> {
        throw new Error("Method not implemented.");
    }

    reset() {
        this.nodes2d.forEach(node => {
            node.x = 0;
            node.y = 0;
        });
        this.updateLayout();
        // this.updateStyle();
        // this.layout();
    }

    protected emitEvent(type: "update" | "end") {
        if (this.events[type]) {
            this.events[type].call(this);
        }
    }

    on(typenames: "update" | "end", listener: null | ((this: GraphLayouter<any>) => void)) {
        if (listener == null) {
            delete this.events[typenames];
            return;
        } else {
            this.events[typenames] = listener;
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region D3 Selection methods
    ////////////////////////////////////////////////////////////////////////////

    selectGroup(className: string) {
        const selector = `g.${className}`
        const parent = this.gParent;
        if (!parent) {
            throw new Error("Parent group not set");
        }
        parent.selectChildren(selector).data([0]).join("g").classed(className, true);
        return parent.select<SVGGElement | null>(selector);
    }

    setParentGroup(group: d3.Selection<any, any, any, any>) {
        this.gParent = group;
    }



    ////////////////////////////////////////////////////////////////////////////
    // #region Render methods
    ////////////////////////////////////////////////////////////////////////////

    get renderer() {
        return this.visGraph?.renderer;
    }


    updateStyle() {
        this.visGraph?.updateGraphicalStyle();
        return;
    }
}
