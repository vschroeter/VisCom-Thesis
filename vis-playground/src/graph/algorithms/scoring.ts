import { CommunicationChannel, CommunicationGraph } from "../commGraph";


abstract class NodeScorer {

    sorting: "ascending" | "descending" = "descending";

    constructor(public commGraph: CommunicationGraph) {
    }
    abstract getScore(nodeId: string): number;
}

export class DegreeNodeScorer extends NodeScorer {
    getScore(nodeId: string): number {
        const node = this.commGraph.getNode(nodeId);
        return node?.degree ?? 0;
    }
}


export class DiffSourceScorer extends NodeScorer {
    channels: CommunicationChannel[];

    constructor(commGraph: CommunicationGraph) {
        super(commGraph);

        this.channels = commGraph.channels;
    }

    getScore(nodeId: string): number {
        const node = this.commGraph.getNode(nodeId);
        if (node === undefined) {
            return 0;
        }
        
        const outgoingNodes = node.getConnectedNodes("outgoing", this.channels);
        const incomingNodes = node.getConnectedNodes("incoming", this.channels);

        return outgoingNodes.length - incomingNodes.length
    }
}

export class WeightedSourceScorer extends DiffSourceScorer {
    getScore(nodeId: string): number {
        const score = super.getScore(nodeId);
        return score / (Math.abs(score) + 1);
    }
}






