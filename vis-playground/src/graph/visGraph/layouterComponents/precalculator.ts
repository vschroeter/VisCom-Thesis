import { LayoutNode } from "../layoutNode";
import { VisGraph } from "../visGraph";

import * as d3 from "d3";

export class BasicPrecalculator {

    size: number;
    minSize: number;

    marginFactor = 1.1;

    constructor({
        sizeMultiplier = 10,
        minSize = 5,
        marginFactor = 1.1
    }: {
            sizeMultiplier?: number;
            minSize?: number;
            marginFactor?: number;
        } = {}) {
        this.size = sizeMultiplier;
        this.minSize = minSize;
        this.marginFactor = marginFactor;
    }

    precalculate(node: LayoutNode, visGraph: VisGraph) {
        if (node.children.length == 0) {
            node.radius = node.score * this.size;
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

        node.radius = Math.max(node.radius, this.minSize);
        node.outerRadius = node.radius * this.marginFactor;
        // node.sizeCalculated = true;
    }
}