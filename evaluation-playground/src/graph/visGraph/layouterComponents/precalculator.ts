import { LayoutNode } from "../layoutNode";
import { VisGraph } from "../visGraph";

import * as d3 from "d3";

/**
 * A basic size calculator that calculates the size of a node based on the score of the node.
 */
export class BasicSizeCalculator {

    // Size multiplier
    sizeMultiplier: number;

    minSizeFraction: number = 0.2;

    // At this score the node will have the minimal size
    minSizeScore: number = 0.1;

    // At this score the node will have the maximal size
    maxSizeScore: number = 1;

    marginFactor = 1.1;

    scaleScoreToSizeFraction: d3.ScaleContinuousNumeric<number, number>;

    adaptRadiusBasedOnScore: boolean;

    virtualNodeMultiplier: number;

    constructor({
        sizeMultiplier = 50,
        minSizeScore = 0.1,
        marginFactor = 1.1,
        adaptRadiusBasedOnScore = true,
        virtualNodeMultiplier = 0.7
    }: {
        sizeMultiplier?: number;
        minSizeScore?: number;
        marginFactor?: number;
        adaptRadiusBasedOnScore?: boolean;
        virtualNodeMultiplier?: number;
    } = {}) {
        this.sizeMultiplier = sizeMultiplier;
        this.minSizeScore = minSizeScore;
        this.marginFactor = marginFactor;
        this.adaptRadiusBasedOnScore = adaptRadiusBasedOnScore;
        this.virtualNodeMultiplier = virtualNodeMultiplier;

        this.scaleScoreToSizeFraction = d3.scaleLog()
            // this.scaleScoreToSizeFraction = d3.scaleLinear()
            .domain([this.minSizeScore, this.maxSizeScore])
            .range([this.minSizeFraction, 1]);
    }

    precalculate(node: LayoutNode, visGraph: VisGraph) {
        if (node.children.length == 0) {
            if (!this.adaptRadiusBasedOnScore) {
                node.radius = this.sizeMultiplier;
                if (node.isVirtual) {
                    node.radius *= this.virtualNodeMultiplier;
                }

            } else {
                node.radius = this.scaleScoreToSizeFraction(Math.max(node.score, this.minSizeScore)) * this.sizeMultiplier;
                if (node.isVirtual) {
                    node.radius *= this.virtualNodeMultiplier;
                }
            }
        } else {
            // If the node size has not been calculated by the layouter, we have to calculate it here
            // For that we just take the max size and the node position extent of the children
            if (node.radius == 0) {
                console.warn("Size not calculated for node with children", node.id);

                const maxChildSize = Math.max(...node.children.map(child => child.radius));
                const centerExtentX = d3.extent(node.children.map(child => child.center.x)) as [number, number];
                const centerExtentY = d3.extent(node.children.map(child => child.center.y)) as [number, number];

                const sizeX = Math.abs(centerExtentX[0] - centerExtentX[1]);
                const sizeY = Math.abs(centerExtentY[0] - centerExtentY[1]);

                node.radius = Math.max(sizeX + maxChildSize, sizeY + maxChildSize);
            }
        }

        node.radius = Math.max(node.radius, this.minSizeScore);
        node.outerRadius = node.radius * this.marginFactor;
        // node.sizeCalculated = true;
    }
}
