import { GraphLayouter } from "../layouter";
import { FdgLayouterSettings } from "./fdgSettings";

import * as d3 from "d3";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { BasicSizeCalculator } from "src/graph/visGraph/layouterComponents/precalculator";

export class FdgLayouter extends GraphLayouter<FdgLayouterSettings> {

    simulation?: d3.Simulation<LayoutNode, LayoutConnection>;

    override initVisGraph(): Promise<void> {
        this.resetVisGraph();

        // Empty promise
        return new Promise(resolve => {
            resolve();
        });
    }

    override async layout(isUpdate = false) {
        const ctx = this.settings.getContext({ visGraph: this.visGraph });

        const sizeMultiplier = 50;

        this.visGraph.setPrecalculator(new BasicSizeCalculator({
            sizeMultiplier: sizeMultiplier,
            marginFactor: 1.1,
            adaptRadiusBasedOnScore: this.commonSettings.showNodeScore.getValue() ?? true,
        }));

        this.visGraph.layout();

        if (this.simulation) {
            // console.log("Stopping simulation");
            this.simulation.stop();
        }

        const simulation = d3.forceSimulation(this.visGraph.allLeafLayoutNodes).alpha(1) //.alphaTarget(0.3);
        simulation.stop();
        this.simulation = simulation;

        simulation.on("tick", () => {
            this.visGraph.layout();
            this.emitEvent("update");
        });
        simulation.on("end", () => {
            this.visGraph.layout();
            this.emitEvent("end");
        });

        if (this.settings.forceManyBody.active) {
            // console.log("Adding force many body", this.settings.forceManyBody.strength.getValue());
            simulation.force("charge", d3.forceManyBody<LayoutNode>().strength(d =>
                this.settings.forceManyBody.strength.getValue(d, ctx) ?? -20)
            )
        }

        if (this.settings.forceLink.active) {
            // console.log("Adding force link", this.settings.forceLink.distance.getValue(), this.settings.forceLink.strength.getValue());
            const force = d3.forceLink(this.visGraph.allLayoutConnections)
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
            // simulation.force("center", d3.forceCenter().strength(
            //     this.settings.forceCenter.strength.getValue(ctx) ?? 1
            // ))

            simulation.force("x", d3.forceX().strength(this.settings.forceCenter.strength.getValue(ctx) ?? 1))
            simulation.force("y", d3.forceY().strength(this.settings.forceCenter.strength.getValue(ctx) ?? 1))
        }

        if (this.settings.forceCollide.active) {
            console.log("Adding force collide", this.settings.forceCollide.radius.getValue(), this.settings.forceCollide.strength.getValue());
            simulation.force("collide", d3.forceCollide<LayoutNode>(
                d => (this.settings.forceCollide.radius.getValue(d, ctx) ?? 5)
            ).strength(
                Math.min(1, Math.max(0, this.settings.forceCollide.strength.getValue(ctx) ?? 0.5))
            ))
        }



        simulation.alpha(isUpdate ? 0.5 : 1).alphaMin(0.01).restart();
    }
}
