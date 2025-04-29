import * as d3 from "d3";
import { MetricDefinition } from "./collection";
import { VisGraph } from "../visGraph/visGraph";

export class MetricCalculator {

    static displayedMetrics: MetricDefinition[] = [
        // { key: "aspectRatio", optimum: "higherIsBetter", label: "Aspect Ratio", description: "The ratio of shorter side to longer side of the layout" },
    ];

    getMetricDefinitions(): MetricDefinition[] {
        return (this.constructor as typeof MetricCalculator).displayedMetrics;
    }

    async calculate() {

    }


    /** Reference to the graph */
    graph: VisGraph;

    /** Width of the layout */
    layoutWidth: number;

    /** Height of the layout */
    layoutHeight: number;

    /** The length of the shorter side of the layout */
    get shorterSide(): number {
        return Math.min(this.layoutWidth, this.layoutHeight);
    }

    /** The length of the longer side of the layout */
    get longerSide(): number {
        return Math.max(this.layoutWidth, this.layoutHeight);
    }

    /** The ratio of the width to the height of the layout */
    get widthToHeightRatio(): number {
        return this.layoutWidth / this.layoutHeight;
    }

    /** The ratio of the height to the width of the layout */
    get heightToWidthRatio(): number {
        return this.layoutHeight / this.layoutWidth;
    }

    /**
     * The aspect ratio of the layout [0 .. 1]
     *
     * If the layout is wider than it is high, the aspect ratio is the width to height ratio.
     * If the layout is higher than it is wide, the aspect ratio is the height to width ratio.
     */
    get aspectRatioByNodes(): number {
        if (this.layoutWidth > this.layoutHeight) {
            return this.heightToWidthRatio;
        }
        return this.widthToHeightRatio;
    }


    getMetric(key: string): number {
        // @ts-expect-error Ignore that we dont have an index signature
        return this[key];
    }


    constructor(graph: VisGraph) {
        this.graph = graph;

        // Get size of the layout
        const xNodeExtent = d3.extent(this.graph.allLeafLayoutNodes, d => d.x) as [number, number];
        const yNodeExtent = d3.extent(this.graph.allLeafLayoutNodes, d => d.y) as [number, number];

        const maxNodeSize = d3.max(this.graph.allLeafLayoutNodes, d => d.radius) || 0;

        this.layoutWidth = xNodeExtent[1] - xNodeExtent[0] + 2 * maxNodeSize;
        this.layoutHeight = yNodeExtent[1] - yNodeExtent[0] + 2 * maxNodeSize;

        // console.warn("Aspect Ratio: ", this.aspectRatio, this.layoutHeight, this.layoutWidth, {
        //     nodes: this.graph.allLayoutNodes.map(d => ({id: d.id, x: d.x, y: d.y })),

        // });
        // TODO: Fetch also the extents of the connection lines
    }
}



