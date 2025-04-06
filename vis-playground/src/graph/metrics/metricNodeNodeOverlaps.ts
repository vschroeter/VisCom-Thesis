import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";
import { MetricsApi } from "./metricsApi";

export class NodeNodeOverlapsMetricCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "nodeNodeOverlaps",
            optimum: "higherIsBetter",
            label: "Node-Node Overlaps",
            abbreviation: "NNO",
            description: "Measures how well nodes avoid overlapping with each other. Higher values indicate fewer overlaps relative to the maximum possible.",
            normalizing: "none"
        },
    ];

    /** The node-node overlaps value of the graph layout */
    nodeNodeOverlaps: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Initializing node-node overlaps calculator");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "nodeNodeOverlaps");
            console.log("Node-node overlaps metric:", results);
            this.nodeNodeOverlaps = results.value;
        } catch (error) {
            console.error("Error fetching node-node overlaps metric:", error);
            // Set a default value in case of error
            this.nodeNodeOverlaps = 0;
        }
    }
}
