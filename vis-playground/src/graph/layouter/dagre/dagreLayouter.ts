import * as dagreD3 from 'dagre-d3';

import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { GraphLayouter } from "../layouter";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { AbstractConnection2d, AbstractNode2d } from "src/graph/graphical";
import { CommonSettings } from "../settings/commonSettings";
import { GraphLayouterSettings } from '../settings/settings';


export class DagreLayouter extends GraphLayouter<GraphLayouterSettings> {


  layout(isUpdate = false) {

    // this.emitEvent("update");
    this.emitEvent("end");
  }

  updateNodes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: {
    mouseenter?: (d: AbstractNode2d, e: MouseEvent) => void,
    mouseleave?: (d: AbstractNode2d, e: MouseEvent) => void,
    click?: (d: AbstractNode2d, e: MouseEvent) => void
  }) {

    const g = new dagreD3.graphlib.Graph()
      .setGraph({})
      // .setDefaultNodeLabel(function () { return {}; })
      .setDefaultEdgeLabel(function () { return {}; });

    this.graph2d.nodes.forEach(n => {
      g.setNode(n.id ?? "0", { label: n.id,  });
    })

    this.graph2d.links.forEach(l => {
      g.setEdge(l.source.id ?? "0", l.target.id ?? "0");
    })

    // Create the renderer
    const render = new dagreD3.render();
    render(selection as any, g as any);
  }


}

