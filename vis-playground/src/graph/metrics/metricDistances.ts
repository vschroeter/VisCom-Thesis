import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";

export class EdgeLengthCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        { key: "totalEdgeLength", optimum: "lowerIsBetter", label: "Total Edge Length", abbreviation: "EL", description: "The total length of all edges in the graph", normalizing: "byLongerLayoutSide" },
    ];

    /** The total length of all edges in the graph */
    totalEdgeLength: number;

    get totalLengthToShorterSideRatio(): number {
        return this.totalEdgeLength / this.shorterSide;
    }

    constructor(graph: VisGraph) {
        super(graph);
        console.log("Calculating edge length");

        // Calculate the total edge length
        this.totalEdgeLength = 0;
        this.graph.allLayoutConnections.forEach(link => {
            this.totalEdgeLength += link.connection2d?.length ?? 0;
        });
    }
}

export class NodeDistanceCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        { key: "neighboredNodeDistance", optimum: "lowerIsBetter", label: "Neighbored Node Distance", abbreviation: "ND", description: "The total distance between all neighbored nodes in the graph", normalizing: "byLongerLayoutSide" },
    ];

    /** The average distance between all nodes in the graph */
    neighboredNodeDistance: number;

    constructor(graph: VisGraph) {
        super(graph);

        console.log("Calculating node distance");

        // Calculate the total node distance
        this.neighboredNodeDistance = 0;

        // Calculate the total distance between all neighbored nodes
        this.graph.allLayoutConnections.forEach(link => {
            const source = link.source;
            const target = link.target;
            this.neighboredNodeDistance += Math.sqrt((source.x - target.x) ** 2 + (source.y - target.y) ** 2)
        });

        
    }
}