import { CommFlowSorter } from "./commFlow";
import { FlowSorter } from "./flow";
import { BreadthFirstSorter, ChildrenCountSorter, DegreeSorter, DepthFirstSorter, IdSorter, NodeScoreSorter, RandomSorter } from "./simple";
import { Sorter } from "./sorting";
import { DifferenceSourceScoreSorter, WeightedSourceScoreSorter } from "./sourceScore";
import { TopologicalSorter } from "./topological";
import { WeightedTopologicalSorter, WeightedTopologicalSorterUnadapted } from "./weightedTopological";

type SortingMapping = {
    key: string,
    label: string,
    hasStartNodeSelection?: boolean,
    canBeUsedAsSecondarySorting?: boolean,
    hasSecondarySorting?: boolean,
    sorter: (typeof Sorter)
    // sorter: (typeof Sorter) | (() => Sorter)
}

export const sortingMethods: SortingMapping[] = [
    {
        key: "byId",
        label: "By ID",
        canBeUsedAsSecondarySorting: true,
        hasSecondarySorting: false,
        sorter: IdSorter
    },
    {
        key: "random",
        label: "Random",
        canBeUsedAsSecondarySorting: true,
        hasSecondarySorting: false,
        sorter: RandomSorter
    },
    {
        key: "topological",
        label: "Topological",
        hasSecondarySorting: true,
        canBeUsedAsSecondarySorting: false,
        sorter: TopologicalSorter
    },
    {
        key: "weightedTopological",
        label: "Weighted Topological",
        hasSecondarySorting: true,
        hasStartNodeSelection: false,
        canBeUsedAsSecondarySorting: false,
        sorter: WeightedTopologicalSorter
    },
    {
        key: "weightedTopologicalUnadapted",
        label: "Weighted Topological Unadapted",
        hasSecondarySorting: true,
        hasStartNodeSelection: false,
        canBeUsedAsSecondarySorting: false,
        sorter: WeightedTopologicalSorterUnadapted
    },
    {
        key: "flowSorting",
        label: "Flow Sorting",
        sorter: FlowSorter,
        hasStartNodeSelection: true,
        hasSecondarySorting: true,
    },
    {
        key: "commFlowSorting",
        label: "Weighted Flow Sorting",
        sorter: CommFlowSorter,
        hasStartNodeSelection: false,
        hasSecondarySorting: false,
    },
    {
        key: "breadthFirst",
        label: "Breadth First",
        hasStartNodeSelection: true,
        hasSecondarySorting: false,
        sorter: BreadthFirstSorter
    },
    {
        key: "depthFirst",
        label: "Depth First",
        hasStartNodeSelection: true,
        hasSecondarySorting: false,
        sorter: DepthFirstSorter
    },
    {
        key: "nodeScore",
        label: "Node Score",
        canBeUsedAsSecondarySorting: true,
        hasSecondarySorting: false,
        sorter: NodeScoreSorter
    },
    {
        key: "sourceScoreWeighted",
        label: "Source Score Weighted",
        canBeUsedAsSecondarySorting: true,
        hasSecondarySorting: false,
        sorter: WeightedSourceScoreSorter
    },
    {
        key: "sourceScoreDifference",
        label: "Source Score Difference",
        canBeUsedAsSecondarySorting: true,
        hasSecondarySorting: false,
        sorter: DifferenceSourceScoreSorter
    },
    {
        key: "childrenCount",
        label: "Children Count",
        canBeUsedAsSecondarySorting: true,
        hasSecondarySorting: false,
        sorter: ChildrenCountSorter
    },
    {
        key: "degree",
        label: "Degree",
        canBeUsedAsSecondarySorting: true,
        hasSecondarySorting: false,
        sorter: DegreeSorter
    }
]

export const mapKeyToSortingMethod: Map<string, SortingMapping> = new Map(sortingMethods.map(m => [m.key, m]));
