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
    }
}




