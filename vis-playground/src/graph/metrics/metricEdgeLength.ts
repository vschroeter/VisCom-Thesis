import { Graph2d } from "../graphical/Graph2d";
import { MetricCalculator } from "./base";
import { DisplayedMetricDescription } from "./collection";

export class EdgeLengthCalculator extends MetricCalculator {

    static displayedMetrics: DisplayedMetricDescription[] = [
        { key: "totalEdgeLength", optimum: "lowerIsBetter", label: "Total Edge Length", description: "The total length of all edges in the graph" },
    ];

    /** The total length of all edges in the graph */
    totalEdgeLength: number;

    get totalLengthToShorterSideRatio(): number {
        return this.totalEdgeLength / this.shorterSide;
    }

    constructor(graph: Graph2d) {
        super(graph);

        // Calculate the total edge length
        this.totalEdgeLength = 0;
        this.graph.links.forEach(link => {
            this.totalEdgeLength += link.length;
        });
    }
}