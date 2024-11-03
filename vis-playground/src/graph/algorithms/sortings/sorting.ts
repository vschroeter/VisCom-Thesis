import { Graph2d } from "src/graph/graphical/Graph2d";
import { CommunicationGraph, CommunicationNode } from "../../commGraph";
import { Node2d } from "src/graph/graphical";
import { CommonSettings } from "src/graph/layouter/settings/commonSettings";

export class Sorter {

    reverse: boolean = false;

    secondarySorting?: Sorter;

    startNodeSelectionSorter?: Sorter;

    commonSettings: CommonSettings;


    constructor(public commGraph: CommunicationGraph, commonSettings: CommonSettings, reversed: boolean = false) {
        this.reverse = reversed;
        this.commonSettings = commonSettings;
    }

    protected sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {
        throw new Error("Method not implemented.");
    }

    getSorting(nodes?: CommunicationNode[]): CommunicationNode[] {
        nodes = nodes ?? Array.from(this.commGraph.nodes);
        const sorting = this.sortingImplementation(nodes);
        return this.reverse ? sorting.reverse() : sorting;
    }

    getSorting2dNodes(graph2d: Graph2d, nodes?: CommunicationNode[]): Node2d[] {
        const sortedNodes = this.getSorting(nodes);
        return sortedNodes.map(node => graph2d.getNode(node.id)).filter(node => node != null) as Node2d[];
    }

}




