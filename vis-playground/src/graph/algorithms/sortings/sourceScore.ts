

import { Sorter } from "./sorting";
import { LayoutNode } from "src/graph/visGraph/layoutNode";

export class DifferenceSourceScoreSorter extends Sorter {

    getScore(nodeId: string): number {
        const node = this.visGraph.getNode(nodeId);
        if (node === undefined) {
            return 0;
        }
        
        const successorNodes = node.getSuccessors();
        const predecessorNodes = node.getPredecessors();

        return successorNodes.length - predecessorNodes.length
    }

    protected override sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {
        return nodes.sort((a, b) => this.getScore(a.id) - this.getScore(b.id)).reverse();
    }
}


export class WeightedSourceScoreSorter extends DifferenceSourceScoreSorter {
    override getScore(nodeId: string): number {
        const score = super.getScore(nodeId);
        return score / (Math.abs(score) + 1);
    }
}



