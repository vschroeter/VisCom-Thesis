import { mapKeyToSortingMethod, sortingMethods } from "src/graph/algorithms/sortings/sortingMapping";
import { GraphLayouterSettings, Param, ParamChoice, Setting } from "./settings"
import { Sorter } from "src/graph/algorithms/sortings/sorting";
import { CommunicationGraph } from "src/graph/commGraph";
import { CommonSettings } from "./commonSettings";
import { VisGraph } from "src/graph/visGraph/visGraph";

export class LinearSortingSettings extends Setting {

    sorting = new ParamChoice({
        key: "sorting",
        label: "Primary Sorting",
        description: "The sorting algorithm to use.",
        defaultValue: "commFlowSorting",
        optional: false,
        choices: sortingMethods.map(m => m.key)
    })

    startNodeSelection = new ParamChoice({
        key: "startNodeSelection",
        label: "Start Node Selection",
        description: "The node to start the sorting algorithm from.",
        defaultValue: "sourceScoreWeighted",
        optional: false,
        choices: sortingMethods.filter(m => m.canBeUsedAsSecondarySorting).map(m => m.key),
        enabled: () => (this.sorting.textValue !== undefined) && (mapKeyToSortingMethod.get(this.sorting.textValue)?.hasStartNodeSelection ?? false)
    })

    secondLevelSorting = new ParamChoice({
        key: "secondarySorting",
        label: "Secondary Sorting",
        description: "Secondary sorting algorithm to use (on data where the primary sorting yields no specific order).",
        defaultValue: "degree",
        optional: false,
        choices: sortingMethods.filter(m => m.canBeUsedAsSecondarySorting).map(m => m.key),
        enabled: () => (this.sorting.textValue !== undefined) && (mapKeyToSortingMethod.get(this.sorting.textValue)?.hasSecondarySorting ?? false)
    })
    reversed = new Param<boolean>({
        key: "reversed",
        type: "boolean",
        defaultValue: false,
        optional: false,
    })

    constructor() {
        super({
            key: "sorting",
            label: "Sorting",
            description: "Settings for sorting the nodes.",
            optional: false,
        });
    }

    // protected instantiateSorter(sortingKey: string, commGraph: CommunicationGraph, commonSettings: CommonSettings, reversed: boolean = false): Sorter {
    protected instantiateSorter(sortingKey: string, visGraph: VisGraph, commonSettings: CommonSettings, reversed: boolean = false): Sorter {
        const sorterCls = mapKeyToSortingMethod.get(sortingKey)!.sorter;
        return new sorterCls(visGraph, commonSettings, reversed);
    }

    // getSorter(commGraph: CommunicationGraph, commonSettings: CommonSettings): Sorter {
    getSorter(visGraph: VisGraph, commonSettings: CommonSettings): Sorter {
        if (this.sorting.textValue === undefined) {
            throw new Error("No sorting method selected.");
        }

        const reversed = this.reversed.getValue()!;

        const sorter = this.instantiateSorter(this.sorting.textValue, visGraph, commonSettings, reversed);
        if (this.startNodeSelection.textValue !== undefined) {
            sorter.startNodeSelectionSorter = this.instantiateSorter(this.startNodeSelection.textValue, visGraph, commonSettings, reversed);
        }
        if (this.secondLevelSorting.textValue !== undefined) {
            sorter.secondarySorting = this.instantiateSorter(this.secondLevelSorting.textValue, visGraph, commonSettings, reversed);
        }
        return sorter;
    }

}


export class LinearGraphLayouterSettings extends GraphLayouterSettings {
    sorting = new LinearSortingSettings();
}
