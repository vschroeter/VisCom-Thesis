import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";
import { MetricsApi } from "./metricsApi";

export class StressMetricCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "stress",
            optimum: "lowerIsBetter",
            label: "Stress",
            abbreviation: "S",
            description: "Measures how well the Euclidean distances between nodes in the layout match the shortest path distances in the graph structure, with scale invariance. Lower values indicate better preservation of graph structure.",
            normalizing: "none"
        },
    ];

    /** The stress value of the graph layout */
    stress: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Initializing stress calculator");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "stress");
            console.log("Stress metric:", results);
            this.stress = results.value;
        } catch (error) {
            console.error("Error fetching stress metric:", error);
            // Set a default value in case of error
            this.stress = 0;
        }
    }
}
