import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { GraphLayouter } from "../layouter";
import { FdgLayouterSettings } from "./fdgSettings";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { AbstractConnection2d, AbstractNode2d } from "src/graph/graphical";


export class FdgLayouter extends GraphLayouter<FdgLayouterSettings> {

    simulation?: d3.Simulation<AbstractNode2d, AbstractConnection2d>;


    constructor(graph2d: Graph2d, settings: FdgLayouterSettings) {
        super(graph2d, settings);
    }

    layout(isUpdate = false) {
        if (this.simulation) {
            console.log("Stopping simulation");
            this.simulation.stop();
        }

        const simulation = d3.forceSimulation(this.graph2d.nodes).alpha(1) //.alphaTarget(0.3);
        simulation.stop();
        this.simulation = simulation;

        simulation.on("tick", () => {
            this.emitEvent("update");
        });
        simulation.on("end", () => {
            this.emitEvent("end");
        });

        if (this.settings.forceManyBody.active) {
            console.log("Adding force many body", this.settings.forceManyBody.strength.value);
            simulation.force("charge", d3.forceManyBody().strength(
                this.settings.forceManyBody.strength.value ?? -20)
            )
        }

        if (this.settings.forceLink.active) {
            console.log("Adding force link", this.settings.forceLink.distance.value, this.settings.forceLink.strength.value);
            const strength = this.settings.forceLink.strength.value
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

        simulation.alpha(isUpdate ? 0.5 : 1).restart();
    }
}
