import { Graph2d } from "../graphical/Graph2d";
import { MetricCalculator } from "./base";
import { EdgeLengthCalculator } from "./metricEdgeLength";

import * as d3 from "d3";

export type DisplayedMetricDescription = {
    key: string,
    label?: string,
    description?: string,
    optimum: "higherIsBetter" | "lowerIsBetter",
    normalizing?: "none" | "byMinimum" | "byMaximum" | "byAverage" | "byMedian",
}

export class DisplayedMetric implements DisplayedMetricDescription {

    key: string;
    label?: string;
    description?: string;
    optimum: "higherIsBetter" | "lowerIsBetter";
    normalizing?: "none" | "byMinimum" | "byMaximum" | "byAverage" | "byMedian";

    absoluteValue: number;
    value?: number;

    color = d3.scaleSequential(d3.schemeRdYlGn);

    constructor(description: DisplayedMetricDescription, metricCalculator: MetricCalculator) {
        this.key = description.key;
        this.label = description.label;
        this.description = description.description;
        this.optimum = description.optimum;
        this.normalizing = description.normalizing;

        this.absoluteValue = metricCalculator.getMetric(description.key);
    }

    update(results: SingleMetricResults) {
        
        this.value = this.absoluteValue;
        if (this.normalizing === "byMinimum") {
            this.value = (this.value - results.min) / (results.max - results.min);
        } else if (this.normalizing === "byMaximum") {
            this.value = (this.value - results.max) / (results.max - results.min);
        } else if (this.normalizing === "byAverage") {
            this.value = (this.value - results.average) / (results.max - results.min);
        } else if (this.normalizing === "byMedian") {
            this.value = (this.value - results.median) / (results.max - results.min);
        }
    }
}


export class SingleMetricResults {
    metricKey: string;
    mapSettingIdToValues: Map<number, DisplayedMetric> = new Map();

    constructor(metricKey: string) {
        this.metricKey = metricKey;
        // this.value = value;
    }

    get max(): number {
        return Math.max(...Array.from(this.mapSettingIdToValues.values()).map(value => value.absoluteValue));
    }

    get min(): number {
        return Math.min(...Array.from(this.mapSettingIdToValues.values()).map(value => value.absoluteValue));
    }

    get average(): number {
        return Array.from(this.mapSettingIdToValues.values()).reduce((sum, value) => sum + value.absoluteValue, 0) / this.mapSettingIdToValues.size;
    }

    get median(): number {
        const values = Array.from(this.mapSettingIdToValues.values()).map(value => value.absoluteValue);
        values.sort();
        if (values.length % 2 == 0) {
            return (values[values.length / 2] + values[values.length / 2 + 1]) / 2;
        }
        return values[Math.floor(values.length / 2)];
    }

    add(settingId: number, displayedMetric: DisplayedMetric) {
        this.mapSettingIdToValues.set(settingId, displayedMetric);
        this.update();
    }

    update() {
        Array.from(this.mapSettingIdToValues.values()).forEach(metric => {
            metric.update(this);
        })
    }
}


export class MetricsCollection {
    static metrics: (typeof MetricCalculator)[] = [
        MetricCalculator,
        EdgeLengthCalculator,
    ];


    mapIdToMetrics: Map<number, MetricCalculator[]> = new Map();

    mapMetricKeyToResults: Map<string, SingleMetricResults> = new Map();
    mapIdToDisplayedMetrics: Map<number, DisplayedMetric[]> = new Map();

    constructor() { }

    calculateMetrics(settingId: number, graph: Graph2d) {
        const metrics = MetricsCollection.metrics.map(metric => new metric(graph));
        this.mapIdToMetrics.set(settingId, metrics);

        metrics.forEach(metric => {
            metric.getDisplayedMetrics().forEach(displayedMetricDescription => {

                const results = this.mapMetricKeyToResults.get(displayedMetricDescription.key) ?? new SingleMetricResults(displayedMetricDescription.key);
                const displayedMetric = new DisplayedMetric(displayedMetricDescription, metric);
                results.add(settingId, displayedMetric);
                if (!this.mapIdToDisplayedMetrics.has(settingId)) {
                    this.mapIdToDisplayedMetrics.set(settingId, []);
                }

                // Remove old displayed metric with the same key
                const metrics = this.mapIdToDisplayedMetrics.get(settingId)!;
                const index = metrics.findIndex(value => value.key === displayedMetric.key);
                if (index >= 0) {
                    metrics.splice(index, 1);
                }
                metrics.push(displayedMetric);

                console.log(displayedMetric.label + ": " + metric.getMetric(displayedMetric.key));
            });
        })
    }

    getDisplayedMetrics(settingId: number): DisplayedMetric[] {
        return this.mapIdToDisplayedMetrics.get(settingId) ?? [];
    }





}

