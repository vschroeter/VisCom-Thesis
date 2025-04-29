import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";
import { MetricsApi } from "./metricsApi";

export class WeightedPathContinuityMetricCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "weightedPathContinuity",
            optimum: "lowerIsBetter",
            label: "Weighted Path Continuity",
            abbreviation: "WPC",
            description: "Measures how smoothly paths change direction when following shortest paths in the graph, giving more weight to important connections. Lower values indicate smoother, more continuous paths.",
            normalizing: "none"
        },
    ];

    /** The weighted path continuity value of the graph layout */
    weightedPathContinuity: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Initializing weighted path continuity calculator");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "weightedPathContinuity");
            console.log("Weighted path continuity metric:", results);
            this.weightedPathContinuity = results.value;
        } catch (error) {
            console.error("Error fetching weighted path continuity metric:", error);
            // Set a default value in case of error
            this.weightedPathContinuity = 0;
        }
    }
}
