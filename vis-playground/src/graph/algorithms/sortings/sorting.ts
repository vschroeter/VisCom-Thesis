import { CommunicationGraph, CommunicationNode } from "../../commGraph";



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
}




