import * as dagreD3 from 'dagre-d3';

import { GraphLayouter, GraphLayouterConstructorArgs } from "../layouter";

import * as d3 from "d3";
import { Node2d } from "src/graph/graphical";
import { GraphLayouterSettings } from '../settings/settings';


export class DagreLayouter extends GraphLayouter<GraphLayouterSettings> {

    constructor(layouterArgs: GraphLayouterConstructorArgs<GraphLayouterSettings>) {
        super(layouterArgs);
        this.calculateMetrics = false;
    }


    override async layout(isUpdate = false) {

        // this.emitEvent("update");
        this.emitEvent("end");
    }

    updateNodes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: {
        mouseenter?: (d: Node2d, e: MouseEvent) => void,
        mouseleave?: (d: Node2d, e: MouseEvent) => void,
        click?: (d: Node2d, e: MouseEvent) => void
    }) {

        const g = new dagreD3.graphlib.Graph()
            .setGraph({})
            // .setDefaultNodeLabel(function () { return {}; })
            .setDefaultEdgeLabel(function () { return {}; });

        this.visGraph.allLayoutNodes.forEach(n => {
            g.setNode(n.id ?? "0", { label: n.id, });
        })

        this.visGraph.allLayoutConnections.forEach(l => {
            g.setEdge(l.source.id ?? "0", l.target.id ?? "0");
        })

        // Create the renderer
        const render = new dagreD3.render();
        render(selection as any, g as any);
    }


}

