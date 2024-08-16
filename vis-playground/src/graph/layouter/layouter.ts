import { CommunicationGraph } from "../commGraph";
import { AbstractConnection2d, AbstractNode2d } from "../graphical";
import { Graph2d } from "../graphical/Graph2d";
import { CommonSettings } from "./commonSettings";
import { GraphLayouterSettings } from "./settings";

export class GraphLayouter<T extends GraphLayouterSettings> {

    settings: T;
    commonSettings: CommonSettings;
    commGraph: CommunicationGraph;
    graph2d: Graph2d;

    protected events: { [key: string]: ((this: GraphLayouter<any>) => void) } = {};

    constructor(graph2d: Graph2d, settings: T, commonSettings: CommonSettings) {
        this.commGraph = graph2d.commGraph;
        this.settings = settings;
        this.graph2d = graph2d;
        this.commonSettings = commonSettings;
    }

    updateGraphByCommongSettings() {
        this.graph2d.nodes.forEach(node => {
            node.radius = this.commonSettings.nodeSize.getValue(node) ?? 10;
        });
    }

    updateLayout(isUpdate: boolean = false): void {
        this.updateGraphByCommongSettings();
        this.layout(isUpdate);
    }

    layout(isUpdate = false): void {
        throw new Error("Method not implemented.");
    }

    reset() {
        this.graph2d.nodes.forEach(node => {
            node.x = 0;
            node.y = 0;
            node.vx = 0;
            node.vy = 0;
            node.fx = null;
            node.fy = null;
        });

        this.layout();
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

    updateNodes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>) {
        selection.selectAll('circle')
            .data(this.graph2d?.nodes)
            .join('circle')
            .attr('cx', (d: AbstractNode2d) => d.x)
            .attr('cy', (d: AbstractNode2d) => d.y)
            .attr('r', d => d.radius)
            .attr('fill', d => this.commonSettings.nodeColor.getValue(d) ?? "red")
    }

    updateLinks(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>) {
        selection.selectAll('path')
            .data(this.graph2d?.links)
            .join('path')
            .attr('d', (d: AbstractConnection2d) => d.getSvgPath())
            .attr('stroke', (l) => this.commonSettings.linkColor.getValue(l) ?? "black")
            .attr('fill', 'none')
    }

    updateLabels(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>) {
        selection.selectAll('text')
            .data(this.graph2d?.nodes)
            .join('text')
            .attr('x', (d: AbstractNode2d) => d.x + 10)
            .attr('y', (d: AbstractNode2d) => d.y)
            .text((d: AbstractNode2d) => d.data?.id ?? "")
    }

}