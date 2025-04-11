import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";
import { MetricsApi } from "./metricsApi";

export class TotalPathLengthCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "totalPathLength",
            optimum: "lowerIsBetter",
            label: "Total Path Length",
            abbreviation: "TPL",
            description: "The sum of all edge path lengths in the graph layout. Lower total path length generally indicates a more efficient use of space.",
            normalizing: "none"
        },
    ];

    /** The total length of all edge paths in the graph */
    totalPathLength: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Calculating total path length");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "totalPathLength");
            console.log("Total path length:", results);
            this.totalPathLength = results.value;
        } catch (error) {
            console.error("Error fetching total path length metric:", error);
            this.totalPathLength = 0;
        }
    }

    override getMetric(key: string): number {
        if (key === "totalPathLength") {
            return this.totalPathLength;
        }
        return super.getMetric(key);
    }
}
