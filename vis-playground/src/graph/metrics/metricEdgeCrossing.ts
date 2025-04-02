import { Connection2d } from "../graphical";
import { VisGraph } from "../visGraph/visGraph";
import { MetricCalculator } from "./base";
import { MetricDefinition } from "./collection";

import intersect, { Intersection } from 'path-intersection';
import { MetricsApi } from "./metricsApi";

export class EdgeCrossingsCalculator extends MetricCalculator {
    static override displayedMetrics: MetricDefinition[] = [
        {
            key: "edgeCrossings",
            optimum: "lowerIsBetter",
            label: "Edge Crossings",
            abbreviation: "EC",
            description: "The total count of edge crossings in the graph. Lower values indicate cleaner layouts with fewer visual intersections.",
            normalizing: "none"
        },
    ];

    /** The total length of all edges in the graph */
    edgeCrossings: number;



    constructor(graph: VisGraph) {
        super(graph);

        console.log("Calculating edge crossings");

        this.edgeCrossings = 0;
    }

    override async calculate() {
        try {
            const results = await MetricsApi.fetchMetricsWithPolling(this.graph, "edgeCrossings");
            console.log("Edge crossings:", results);
            this.edgeCrossings = results.value;
        } catch (error) {
            console.error("Error fetching edge crossings metric:", error);
            this.edgeCrossings = 0;
        }
        // await this.calculateEdgeCrossings();
    }

    async calculateEdgeCrossings() {
        const links = this.graph.allLayoutConnections;

        const chunkSize = 100;
        let c = 0;

        for (let i = 0; i < links.length; i++) {
            const link1 = links[i];
            for (let j = i + 1; j < links.length; j++) {
                const link2 = links[j];
                const intersections = this.getIntersections(link1.connection2d, link2.connection2d);
                // if (intersections.length > 0) console.log(intersections, link1.startPoint, link2.startPoint, link1.endPoint, link2.endPoint);
                this.edgeCrossings += intersections.length;
                c++;

                if (c > chunkSize) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                    c = 0;
                }
            }
        }

    }

    getIntersections(link1?: Connection2d, links2?: Connection2d, filterOutStartAndEndTouchings: boolean = true): Intersection[] {
        if (!link1 || !links2) {
            return [];
        }

        const path1 = link1.getSvgPath();
        const path2 = links2.getSvgPath();

        const intersections = intersect(path1, path2);

        const filteredIntersections: Intersection[] = Array.from(intersections);

        // Filter out intersections that are touching at the start or end of the paths
        if (intersections.length > 0 && filterOutStartAndEndTouchings) {
            filteredIntersections.splice(0, filteredIntersections.length);

            const eps = 0.0001;
            function checkT(t: number) {
                return t < eps || t > 1 - eps;
            }

            intersections.forEach(intersection => {
                const t1 = intersection.t1;
                const t2 = intersection.t2;

                if (checkT(t1) || checkT(t2)) {
                    return;
                }

                filteredIntersections.push(intersection);
            });
        }

        return filteredIntersections;
    }

}
