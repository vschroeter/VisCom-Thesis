import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { GraphLayouter } from "../../layouter";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { Connection2d, Node2d } from "src/graph/graphical";
import { RadialLayouterSettings } from "./radialSettings";
import { CommonSettings } from "../../settings/commonSettings";


export class RadialLayouter extends GraphLayouter<RadialLayouterSettings> {


    layout(isUpdate = false) {
        const ctx = this.settings.getContext({ graph2d: this.graph2d });

        const radius = this.settings.size.radius.getValue(ctx) ?? 5;
        
        const sorter = this.settings.sorting.getSorter(this.commGraph);
        const nodes = sorter.getSorting2dNodes(this.graph2d)
        
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
