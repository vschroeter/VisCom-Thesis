import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";
import { MetricsApi } from "./metricsApi";

export class PathContinuityMetricCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "pathContinuity",
            optimum: "lowerIsBetter",
            label: "Path Continuity",
            abbreviation: "PC",
            description: "Measures how smoothly the paths change direction when following shortest paths in the graph. Lower values indicate smoother, more continuous paths.",
            normalizing: "none"
        },
    ];

    /** The path continuity value of the graph layout */
    pathContinuity: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Initializing path continuity calculator");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "pathContinuity");
            console.log("Path continuity metric:", results);
            this.pathContinuity = results.value;
        } catch (error) {
            console.error("Error fetching path continuity metric:", error);
            // Set a default value in case of error
            this.pathContinuity = 0;
        }
    }
}
