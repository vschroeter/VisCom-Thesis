import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { GraphLayouter } from "../layouter";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { AbstractConnection2d, AbstractNode2d } from "src/graph/graphical";
import { RadialLayouterSettings } from "./radialSettings";


export class RadialLayouter extends GraphLayouter<RadialLayouterSettings> {

    constructor(graph2d: Graph2d, settings: RadialLayouterSettings) {
        super(graph2d, settings);
    }

    layout(isUpdate = false) {
        const ctx = this.settings.getContext(this.graph2d);

        const radius = this.settings.size.radius.getValue(ctx);

        // TODO: Get nodes from sorting
        const nodes = this.graph2d.nodes;
        
        // Place nodes on a circle with radius
        const angleStep = 2 * Math.PI / nodes.length;
        nodes.forEach((node, i) => {
            node.x = radius * Math.cos(i * angleStep);
            node.y = radius * Math.sin(i * angleStep);
        });

        // this.emitEvent("update");
        this.emitEvent("end");
    }
}
