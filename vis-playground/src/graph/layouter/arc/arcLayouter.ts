import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { GraphLayouter } from "../layouter";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { AbstractConnection2d, AbstractNode2d, Point2D } from "src/graph/graphical";
import { ArcLayouterSettings } from "./arcSettings";


export class ArcLayouter extends GraphLayouter<ArcLayouterSettings> {

    constructor(graph2d: Graph2d, settings: ArcLayouterSettings) {
        super(graph2d, settings);
    }

    layout(isUpdate = false) {
        const ctx = this.settings.getContext(this.graph2d);


        // TODO: Get nodes from sorting
        const nodes = this.graph2d.nodes;

        // Place nodes on a straight line down
        nodes.forEach((node, i) => {
            node.x = 0;
            node.y = i * 40;
        })

        // Adapt the links
        const links = this.graph2d.links;
        links.forEach(link => {
            link.curveStyle = "basis";
            const source = link.source;
            const target = link.target;

            const distance = Math.abs(source.y - target.y);
            const xDelta = distance * 0.7;

            link.points = [
                new Point2D(source.x, source.y),
                new Point2D(source.x + xDelta, source.y),
                new Point2D(target.x + xDelta, target.y),
                new Point2D(target.x, target.y)
            ]
            
        })

        console.log("Layouted arc layouter", nodes);
        this.emitEvent("update");
        this.emitEvent("end");
    }
}
