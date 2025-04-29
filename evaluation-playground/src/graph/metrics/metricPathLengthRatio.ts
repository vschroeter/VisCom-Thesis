import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";
import { MetricsApi } from "./metricsApi";

export class PathLengthRatioMetricCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "pathEfficiencyRatio",
            optimum: "higherIsBetter",
            label: "Path Efficiency Ratio",
            abbreviation: "PER",
            description: "The ratio between actual path lengths and direct distances. A ratio closer to 1 means paths are more direct and efficient.",
            normalizing: "none"
        },
    ];

    /** The path efficiency ratio in the graph */
    pathEfficiencyRatio: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Initializing path length ratio calculator");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "pathEfficiency");
            console.log("Path efficiency ratio:", results);
            this.pathEfficiencyRatio = results.value;
        } catch (error) {
            console.error("Error fetching path efficiency metric:", error);
            // Set a default value in case of error
            this.pathEfficiencyRatio = 0;
        }
    }
}


export class NormalizedPathLengthRatioMetricCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "pathEfficiencyRatioNormalized",
            optimum: "higherIsBetter",
            label: "Normalized Path Efficiency Ratio",
            abbreviation: "PERN",
            description: "The normalized ratio between actual path lengths and direct distances. A value closer to 1 means paths are more direct and efficient.",
            normalizing: "none"
        },
    ];

    /** The path efficiency ratio in the graph */
    pathEfficiencyRatioNormalized: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Initializing path length ratio calculator");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "pathEfficiencyNormalized");
            console.log("Normalized path efficiency ratio:", results);
            this.pathEfficiencyRatioNormalized = results.value;
        } catch (error) {
            console.error("Error fetching path efficiency metric:", error);
            // Set a default value in case of error
            this.pathEfficiencyRatioNormalized = 0;
        }
    }
}
