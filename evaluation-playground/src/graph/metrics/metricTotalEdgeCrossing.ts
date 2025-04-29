import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";
import { MetricsApi } from "./metricsApi";

export class TotalEdgeCrossingsCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "totalEdgeCrossings",
            optimum: "lowerIsBetter",
            label: "Total Edge Crossings",
            abbreviation: "TEC",
            description: "The absolute number of edge crossings in the graph. Lower values indicate cleaner layouts with fewer visual intersections.",
            normalizing: "none"
        },
    ];

    /** The total number of edge crossings in the graph */
    totalEdgeCrossings: number = 0;

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Calculating total edge crossings");
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "totalEdgeCrossings");
            console.log("Total edge crossings:", results);
            this.totalEdgeCrossings = results.value;
        } catch (error) {
            console.error("Error fetching total edge crossings metric:", error);
            this.totalEdgeCrossings = 0;
        }
    }

    override getMetric(key: string): number {
        if (key === "totalEdgeCrossings") {
            return this.totalEdgeCrossings;
        }
        return super.getMetric(key);
    }
}
