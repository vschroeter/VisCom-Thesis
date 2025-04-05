import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";
import { MetricsApi } from "./metricsApi";

export class AspectRatioMetricCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "aspectRatio",
            optimum: "higherIsBetter",
            label: "Aspect Ratio",
            abbreviation: "AR",
            description: "The ratio of the longest to the shortest dimension of the graph. A higher value indicates a more elongated graph.",
            normalizing: "none"
        },
    ];

    /** The path efficiency ratio in the graph */
    aspectRatio: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Initializing aspect ratio calculator");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "aspectRatio");
            console.log("Aspect ratio:", results);
            this.aspectRatio = results.value;
        } catch (error) {
            console.error("Error fetching aspect ratio metric:", error);
            // Set a default value in case of error
            this.aspectRatio = 0;
        }
    }
}
