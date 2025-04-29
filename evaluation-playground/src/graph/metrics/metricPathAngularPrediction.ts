import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";
import { MetricsApi } from "./metricsApi";

export class PathAngularPredictionMetricCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "pathAngularPrediction",
            optimum: "lowerIsBetter",
            label: "Path Angular Prediction",
            abbreviation: "PAP",
            description: "Measures how well paths follow a consistent angular trend. Lower values indicate paths that have more predictable direction changes.",
            normalizing: "none"
        },
    ];

    /** The path angular prediction value of the graph layout */
    pathAngularPrediction: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Initializing path angular prediction calculator");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "pathAngularPrediction");
            console.log("Path angular prediction metric:", results);
            this.pathAngularPrediction = results.value;
        } catch (error) {
            console.error("Error fetching path angular prediction metric:", error);
            // Set a default value in case of error
            this.pathAngularPrediction = 0;
        }
    }
}
