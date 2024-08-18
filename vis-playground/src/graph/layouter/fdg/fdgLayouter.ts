import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { GraphLayouter } from "../layouter";
import { FdgLayouterSettings } from "./fdgSettings";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { AbstractConnection2d, AbstractNode2d } from "src/graph/graphical";
import { CommonSettings } from "../settings/commonSettings";


export class FdgLayouter extends GraphLayouter<FdgLayouterSettings> {

    simulation?: d3.Simulation<AbstractNode2d, AbstractConnection2d>;


    constructor(graph2d: Graph2d, settings: FdgLayouterSettings, commonSettings: CommonSettings) {
        super(graph2d, settings, commonSettings);
    }

    layout(isUpdate = false) {
        const ctx = this.settings.getContext(this.graph2d);

        if (this.simulation) {
            // console.log("Stopping simulation");
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
            // console.log("Adding force many body", this.settings.forceManyBody.strength.getValue());
            simulation.force("charge", d3.forceManyBody<AbstractNode2d>().strength(d =>
                this.settings.forceManyBody.strength.getValue(d, ctx) ?? -20)
            )
        }

        if (this.settings.forceLink.active) {
            // console.log("Adding force link", this.settings.forceLink.distance.getValue(), this.settings.forceLink.strength.getValue());
            const force = d3.forceLink(this.graph2d.links)
            if (this.settings.forceLink.strength.active) {
                force.strength(d => this.settings.forceLink.strength.getValue(d, ctx) ?? 1)
            }
            if (this.settings.forceLink.distance.active) {
                force.distance(d => this.settings.forceLink.distance.getValue(d, ctx) ?? 30)
            }
            simulation.force("link", force)
        }

        if (this.settings.forceCenter.active) {
            // console.log("Adding force center", this.settings.forceCenter.strength.getValue());
            simulation.force("center", d3.forceCenter().strength(
                this.settings.forceCenter.strength.getValue(ctx) ?? 1
            ))
        }

        if (this.settings.forceCollide.active) {
            // console.log("Adding force collide", this.settings.forceCollide.radius.getValue(), this.settings.forceCollide.strength.getValue());
            simulation.force("collide", d3.forceCollide<AbstractNode2d>().radius(
                d => this.settings.forceCollide.radius.getValue(d, ctx) ?? 5
            ).strength(
                this.settings.forceCollide.strength.getValue(ctx) ?? 0.5
            ))
        }

        simulation.alpha(isUpdate ? 0.5 : 1).alphaMin(0.01).restart();
    }
}
