import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { GraphLayouter } from "../graphLayouter";
import { FdgLayouterSettings } from "./fdgSettings";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { AbstractConnection2d, AbstractNode2d } from "src/graph/graphical";


export class FdgLayouter extends GraphLayouter<FdgLayouterSettings> {

    simulation?: d3.Simulation<AbstractNode2d, AbstractConnection2d>;

    private events: { [key: string]: ((this: GraphLayouter<FdgLayouterSettings>) => void) } = {};

    constructor(graph2d: Graph2d, settings: FdgLayouterSettings) {
        super(graph2d, settings);
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

    layout(is_update = false) {
        if (this.simulation) {
            console.log("Stopping simulation");
            this.simulation.stop();
        }

        const simulation = d3.forceSimulation(this.graph2d.nodes).alpha(1) //.alphaTarget(0.3);
        simulation.stop();
        this.simulation = simulation;
        this.addEventsToSimulation(simulation);

        if (this.settings.forceManyBody.active) {
            console.log("Adding force many body", this.settings.forceManyBody.strength.value);
            simulation.force("charge", d3.forceManyBody().strength(
                this.settings.forceManyBody.strength.value ?? -20)
            )
        }

        if (this.settings.forceLink.active) {
            console.log("Adding force link", this.settings.forceLink.distance.value, this.settings.forceLink.strength.value);
            const strength =  this.settings.forceLink.strength.value
            const distance = this.settings.forceLink.distance.value
            const force = d3.forceLink(this.graph2d.links)
            if (strength) {
                force.strength(strength)
            }
            if (distance) {
                force.distance(distance)
            }
            simulation.force("link", force)
        }

        if (this.settings.forceCenter.active) {
            console.log("Adding force center", this.settings.forceCenter.strength.value);
            simulation.force("center", d3.forceCenter().strength(
                this.settings.forceCenter.strength.value ?? 1
            ))
        }

        if (this.settings.forceCollide.active) {
            console.log("Adding force collide", this.settings.forceCollide.radius.value, this.settings.forceCollide.strength.value);
            simulation.force("collide", d3.forceCollide().radius(
                this.settings.forceCollide.radius.value ?? 5
            ).strength(
                this.settings.forceCollide.strength.value ?? 0.5
            ))
        }

        simulation.alpha(is_update ? 0.5 : 1).restart();
    }

    private addEventsToSimulation(simulation: d3.Simulation<AbstractNode2d, AbstractConnection2d>) {
        if (!simulation) {
            return;
        }
        simulation.on("tick", () => {
            this.events["tick"]?.call(this);
        });

        simulation.on("end", () => {
            this.events["end"]?.call(this);
        });
    }

    on(typenames: "tick" | "end", listener: null | ((this: GraphLayouter<FdgLayouterSettings>) => void)) {
        if (listener == null) {
            delete this.events[typenames];
            return;
        } else {
            this.events[typenames] = listener;
        }

        this.addEventsToSimulation(this.simulation!);
    }

    updateNodes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>) {
        selection.selectAll('circle')
            .data(this.graph2d?.nodes)
            .join('circle')
            .attr('cx', (d: AbstractNode2d) => d.x)
            .attr('cy', (d: AbstractNode2d) => d.y)
            .attr('r', 10)
            .attr('fill', 'red')
    }

    updateLinks(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>) {
        selection.selectAll('line')
            .data(this.graph2d?.links)
            .join('line')
            .attr('x1', (d: AbstractConnection2d) => d.source.x)
            .attr('y1', (d: AbstractConnection2d) => d.source.y)
            .attr('x2', (d: AbstractConnection2d) => d.target.x)
            .attr('y2', (d: AbstractConnection2d) => d.target.y)
            .attr('stroke', 'black')
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
