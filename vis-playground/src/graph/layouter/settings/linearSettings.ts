import { Param, ParamChoice, Setting } from "./settings"

export class LinearSortingSettings extends Setting {

    sorting = new ParamChoice({
        key: "sorting",
        label: "Sorting",
        description: "The sorting algorithm to use.",
        defaultValue: "byId",
        optional: false,
        choices: [
            "byId",
            "random",
            "topological",
            "flowSorting",
            "breadthFirst",
            "depthFirst",
            "sourceScore",
        ]
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

    // test() {
    //     this.sorting.
    // }

}