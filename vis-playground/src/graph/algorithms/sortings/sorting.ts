import { Graph2d } from "src/graph/graphical/Graph2d";
import { CommunicationGraph, CommunicationNode } from "../../commGraph";
import { Node2d } from "src/graph/graphical";
import { CommonSettings } from "src/graph/layouter/settings/commonSettings";
import { VisGraph } from "src/graph/visGraph/visGraph";
import { LayoutNode } from "src/graph/visGraph/layoutNode";

export interface SortableNode {
    id: string;
    score: number;
}

export interface SortableLink {
    fromId: string;
    toId: string;

    weight: number;
}

export class Sorter {

    reverse: boolean = false;

    secondarySorting?: Sorter;

    startNodeSelectionSorter?: Sorter;

    commonSettings: CommonSettings;


    constructor(public visGraph: VisGraph, commonSettings: CommonSettings, reversed: boolean = false) {
        this.reverse = reversed;
        this.commonSettings = commonSettings;
    }

    protected sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {
        throw new Error("Method not implemented.");
    }

    getSorting(visNodes: LayoutNode[]): LayoutNode[] {
        const sorting = this.sortingImplementation(visNodes);
        return this.reverse ? sorting.reverse() : sorting;

        // const sortedNodes = this.getSorting(visNodes.map(node => node.node));
        // return sortedNodes.map(node => visNodes.find(visNode => visNode.node.id == node.id)!);
    }
    
    // getSorting(nodes?: CommunicationNode[]): CommunicationNode[] {
    //     nodes = nodes ?? Array.from(this.visGraph.nodes);
    //     const sorting = this.sortingImplementation(nodes);
    //     return this.reverse ? sorting.reverse() : sorting;
    // }

    // getSorting2dNodes(graph2d: Graph2d, nodes?: CommunicationNode[]): Node2d[] {
    //     const sortedNodes = this.getSorting(nodes);
    //     return sortedNodes.map(node => graph2d.getNode(node.id)).filter(node => node != null) as Node2d[];
    // }

}




