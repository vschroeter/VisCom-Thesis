import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";
import { MetricsApi } from "./metricsApi";

export class NodeEdgeOverlapsMetricCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "nodeEdgeOverlaps",
            optimum: "higherIsBetter",
            label: "Node-Edge Overlaps",
            abbreviation: "NEO",
            description: "Measures how well edges avoid passing through unrelated nodes. Higher values indicate fewer unwanted overlaps relative to the maximum possible.",
            normalizing: "none"
        },
    ];

    /** The node-edge overlaps value of the graph layout */
    nodeEdgeOverlaps: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Initializing node-edge overlaps calculator");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "nodeEdgeOverlaps");
            console.log("Node-edge overlaps metric:", results);
            this.nodeEdgeOverlaps = results.value;
        } catch (error) {
            console.error("Error fetching node-edge overlaps metric:", error);
            // Set a default value in case of error
            this.nodeEdgeOverlaps = 0;
        }
    }
}
