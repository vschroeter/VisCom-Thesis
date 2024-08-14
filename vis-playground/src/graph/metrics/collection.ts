import { useDebounceFn } from "@vueuse/core";
import { Graph2d } from "../graphical/Graph2d";
import { MetricCalculator } from "./base";
import { EdgeLengthCalculator } from "./metricEdgeLength";

import * as d3 from "d3";
import mitt from "mitt";

export type MetricNormalization =
    "none" | "byMinimum" | "byMaximum" | "byAverage" | "byMedian" | "byShorterLayoutSide" | "byLongerLayoutSide"


export type MetricDefinition = {
    key: string,
    label?: string,
    description?: string,
    optimum: "higherIsBetter" | "lowerIsBetter",
    normalizing?: MetricNormalization,
    unit?: string
}

/**
 * Collection to store all metrics of all different visualizations and settings
 */
export class MetricsCollection {

    static metricsToCalculate: (typeof MetricCalculator)[] = [
        MetricCalculator,
        EdgeLengthCalculator,
    ];

    // Map from setting id to the metrics results of that setting
    mapIdToMetricsResults: Map<number, MetricsResults> = new Map();

    // Map from a metric key to all results of that metric
    mapKeyToSingleMetricResults: Map<string, SingleMetricResults> = new Map();

    // All metrics results of all visualizations
    get allMetricsResults(): MetricsResults[] {
        return Array.from(this.mapIdToMetricsResults.values());
    }

    /**
     * Get the single metric results of all visualizations for the given key
     * @param key Metric key
     * @returns Single metric results
     */
    getSingleMetricResults(key: string): SingleMetricResults {
        if (!this.mapKeyToSingleMetricResults.has(key)) {
            this.mapKeyToSingleMetricResults.set(key, new SingleMetricResults(key, this));
        }
        return this.mapKeyToSingleMetricResults.get(key)!;
    }

    /**
     * Get the metrics results of the visualization with the given setting id
     * @param settingId The setting id of the visualization
     * @returns The metrics results of the visualization
     */
    getMetricsResults(settingId: number): MetricsResults {
        if (!this.mapIdToMetricsResults.has(settingId)) {
            this.mapIdToMetricsResults.set(settingId, new MetricsResults(settingId, this));
        }
        return this.mapIdToMetricsResults.get(settingId)!;
    }

    /**
     * Calculate all metrics for the given graph of the given setting
     * @param settingId The setting id of the visualization
     * @param graph The graph to calculate the metrics
     */
    calculateMetrics(settingId: number, graph: Graph2d) {

        // Calculate all absolute metrics for the given graph of the given setting 
        const metricCalculators = MetricsCollection.metricsToCalculate.map(metric => new metric(graph));

        // Update the metrics of the visualization with the results
        const metricsResults = this.getMetricsResults(settingId);
        metricsResults.update(metricCalculators);

        // Update the single metric results
        metricsResults.results.forEach(metricResult => {
            const key = metricResult.metricKey;
            const singleMetricResults = this.getSingleMetricResults(key);
            singleMetricResults.update();
        });
    }

}

/**
 * All metrics results of a single visualization
 */
export class MetricsResults {
    // The setting id of the visualization
    settingId: number;
    // Reference to the metrics collection
    collection: MetricsCollection;

    // Map from metric key to the metric result
    mapMetricKeyToResult: Map<string, MetricResult> = new Map();

    /**
     * Emitter for events on the metrics results:
     * - "newMetrics": When there has been new metrics calculated
     */
    emitter = mitt<{
        newMetrics: void,
        metricsUpdated: void
    }>();

    // All metric results for this visualization
    get results(): MetricResult[] {
        return Array.from(this.mapMetricKeyToResult.values());
    }

    constructor(settingId: number, collection: MetricsCollection) {
        this.settingId = settingId;
        this.collection = collection;
    }

    // Updates the results of this visualization with the new metrics from the given calculators
    update(calculators: MetricCalculator[]) {
        // Clear the old results
        this.results.forEach(result => {
            result.emitter.off("relativeValueUpdated");
        });
        this.mapMetricKeyToResult.clear();

        // Add the new results
        calculators.forEach(calculator => {
            // For each calculator, there can be multiple metrics
            calculator.getMetricDefinitions().forEach(metricDefinition => {
                const result = new MetricResult(this.settingId, calculator, metricDefinition, this.collection.getSingleMetricResults(metricDefinition.key));
                result.emitter.on("relativeValueUpdated", () => {
                    this.emitDebouncedMetricsUpdated();
                });
                this.mapMetricKeyToResult.set(result.metricKey, result);
            });
        })

        // Emit an update event
        this.emitter.emit("newMetrics");
    }

    protected emitDebouncedMetricsUpdated = useDebounceFn(() => {
        this.emitter.emit("metricsUpdated");
    }, 100);

}

/**
 * All results of a single metric
 */
export class SingleMetricResults {
    // The key of the metric
    metricKey: string;

    // Reference to the metrics collection
    metricsCollection: MetricsCollection

    constructor(metricKey: string, metricsCollection: MetricsCollection) {
        this.metricKey = metricKey;
        this.metricsCollection = metricsCollection;
    }

    // Updates all results of this metric with the new values to calculate the relative metrics
    update() {
        this.results.forEach(result => {
            result.updateRelative();
        });
    }

    // All existing results for this metric in the different visualizations
    get results(): MetricResult[] {
        return this.metricsCollection.allMetricsResults
            .map(results => results.mapMetricKeyToResult.get(this.metricKey))
            .filter(result => result !== undefined) as MetricResult[];
    }

    // All values of the results
    get metricValues(): number[] {
        return this.results.map(result => result.value);
    }

    // The minimum value of the results
    get min(): number {
        return Math.min(...this.metricValues);
    }

    // The maximum value of the results
    get max(): number {
        return Math.max(...this.metricValues);
    }

    // The average value of the results
    get average(): number {
        return d3.mean(this.metricValues)!;
    }

    // The median value of the results
    get median(): number {
        return d3.median(this.metricValues)!;
    }

    // The standard deviation of the results
    get standardDeviation(): number {
        return d3.deviation(this.metricValues)!;
    }


}

/**
 * A single metric result
 */
export class MetricResult {
    // The setting id of the visualization the metric belongs to
    settingId: number;

    // Definition of the metric
    definition: MetricDefinition;

    // The metric calculator that calculated this metric
    calculator: MetricCalculator;

    // The key of the metric
    metricKey: string;

    // Rank of the metric
    relativePlace: number = 0;

    // Normalized value of the metric
    normalizedValue: number = 0;

    // The value of the metric
    get value(): number {
        return this.calculator.getMetric(this.metricKey)
    }

    // Reference to the single metric results of this metric
    singleMetricResults: SingleMetricResults;

    emitter = mitt<{
        relativeValueUpdated: boolean
    }>();

    constructor(settingId: number, calculator: MetricCalculator, metricDefinition: MetricDefinition, singleMetricResults: SingleMetricResults) {
        this.settingId = settingId;
        this.calculator = calculator;
        this.definition = metricDefinition;

        this.metricKey = metricDefinition.key;
        this.singleMetricResults = singleMetricResults;
    }

    // Update the relative value of the metric
    updateRelative() {
        const sortedResults = this.singleMetricResults.results.sort((a, b) => a.value - b.value);
        this.relativePlace = sortedResults.indexOf(this);

        let normalizedValue = this.value;
        const normalizing = this.definition.normalizing;
        const results = this.singleMetricResults;

        if (normalizing === "byMinimum") {
            normalizedValue = (normalizedValue - results.min) / (results.max - results.min);
        } else if (normalizing === "byMaximum") {
            normalizedValue = (normalizedValue - results.max) / (results.max - results.min);
        } else if (normalizing === "byAverage") {
            normalizedValue = (normalizedValue - results.average) / (results.max - results.min);
        } else if (normalizing === "byMedian") {
            normalizedValue = (normalizedValue - results.median) / (results.max - results.min);
        } else if (normalizing === "byShorterLayoutSide") {
            const side = this.calculator.shorterSide;
            normalizedValue = normalizedValue / (side);
        } else if (normalizing === "byLongerLayoutSide") {
            const side = this.calculator.longerSide;
            normalizedValue = normalizedValue / (side);
        }

        this.normalizedValue = normalizedValue;

        this.emitter.emit("relativeValueUpdated", true);
    }

}



