import { Graph2d } from "src/graph/graphical/Graph2d";
import { CommunicationGraph, CommunicationNode } from "../../commGraph";
import { AbstractNode2d } from "src/graph/graphical";

export class Sorter {

    reverse: boolean = false;

    secondarySorting?: Sorter;

    startNodeSelectionSorter?: Sorter;



    constructor(public commGraph: CommunicationGraph, reversed: boolean = false) {
        this.reverse = reversed;
    }

    protected sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {
        throw new Error("Method not implemented.");
    }

    getSorting(nodes?: CommunicationNode[]): CommunicationNode[] {
        nodes = nodes ?? Array.from(this.commGraph.nodes);
        const sorting = this.sortingImplementation(nodes);
        return this.reverse ? sorting.reverse() : sorting;
    }

    getSorting2dNodes(graph2d: Graph2d, nodes?: CommunicationNode[]): AbstractNode2d[] {
        const sortedNodes = this.getSorting(nodes);
        return sortedNodes.map(node => graph2d.getNode(node.id)).filter(node => node != null) as AbstractNode2d[];
    }

}




