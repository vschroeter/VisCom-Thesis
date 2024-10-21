

import { CommunicationGraph, CommunicationNode } from "src/graph/commGraph";
import { Sorter } from "./sorting";

export class DifferenceSourceScoreSorter extends Sorter {

    getScore(nodeId: string): number {
        const node = this.commGraph.getNode(nodeId);
        if (node === undefined) {
            return 0;
        }
        
        const outgoingNodes = node.getConnectedNodes("outgoing");
        const incomingNodes = node.getConnectedNodes("incoming");

        return outgoingNodes.length - incomingNodes.length
    }

    protected override sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {
        return nodes.sort((a, b) => this.getScore(a.id) - this.getScore(b.id)).reverse();
    }
}


export class WeightedSourceScoreSorter extends DifferenceSourceScoreSorter {
    override getScore(nodeId: string): number {
        const score = super.getScore(nodeId);
        return score / (Math.abs(score) + 1);
    }
}



