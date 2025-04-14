import { useDebounceFn } from "@vueuse/core";
import { MetricCalculator } from "./base";
import { EdgeLengthCalculator, NodeDistanceCalculator } from "./metricDistances";
import { NormalizedPathLengthRatioMetricCalculator, PathLengthRatioMetricCalculator } from "./metricPathLengthRatio";

import * as d3 from "d3";
import mitt from "mitt";
import { EdgeCrossingsCalculator } from "./metricEdgeCrossing";
import { VisGraph } from "../visGraph/visGraph";
import { MetricApiResult, MetricsApi } from "./metricsApi";
import { StressMetricCalculator } from "./metricStress";
import { PathContinuityMetricCalculator } from "./metricPathContinuity";
import { WeightedPathContinuityMetricCalculator } from "./metricWeightedPathContinuity";
import { PathAngularPredictionMetricCalculator } from "./metricPathAngularPrediction";
import { NodeEdgeOverlapsMetricCalculator } from "./metricNodeEdgeOverlaps";
import { AspectRatioMetricCalculator } from "./metricAspectRatio";
import { NodeNodeOverlapsMetricCalculator } from "./metricNodeNodeOverlaps";
import { TotalEdgeCrossingsCalculator } from "./metricTotalEdgeCrossing";
import { TotalPathLengthCalculator } from "./metricTotalPathLength";

export type MetricNormalization =
    "none" | "byMinimum" | "byMaximum" | "byAverage" | "byMedian" | "byShorterLayoutSide" | "byLongerLayoutSide"


export type MetricDefinition = {
    key: string,
    label?: string,
    description?: string,
    optimum: "higherIsBetter" | "lowerIsBetter",
    normalizing?: MetricNormalization,
    unit?: string
    abbreviation?: string
}

/**
 * Collection to store all metrics of all different visualizations and settings
 */
export class MetricsCollection {

    static metricsToCalculate: (typeof MetricCalculator)[] = [
        // MetricCalculator,
        // EdgeLengthCalculator,
        // NodeDistanceCalculator,
        AspectRatioMetricCalculator,
        EdgeCrossingsCalculator,
        TotalEdgeCrossingsCalculator,
        PathLengthRatioMetricCalculator,
        NormalizedPathLengthRatioMetricCalculator,
        StressMetricCalculator,
        PathContinuityMetricCalculator,
        WeightedPathContinuityMetricCalculator,
        PathAngularPredictionMetricCalculator,
        NodeEdgeOverlapsMetricCalculator,
        NodeNodeOverlapsMetricCalculator,
        TotalPathLengthCalculator
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

    clearMetricResults(settingId: number) {
        this.getMetricsResults(settingId).pending = true;
    }

    /**
     * Calculate all metrics for the given graph of the given setting
     * @param settingId The setting id of the visualization
     * @param graph The graph to calculate the metrics. If undefined, the metrics are initialized with pending state
     */
    async calculateMetrics(settingId: number, graph: VisGraph) {

        if (!graph.commonSettings?.calculateMetrics.getValue()) return;

        // const laidOutData = graph.getLaidOutApiData();
        // console.log("Calculating metrics for setting", settingId);

        // // Update the metrics of the visualization with the results
        // const metricsResults = this.getMetricsResults(settingId);


        // MetricsApi.fetchMetrics(laidOutData).then(results => {
        //     console.log("API results", results);

        //     // This update also asynchronously calculates the metrics (at least the ones, that are not already calculated and take a longer time)
        //     // This update also updates the single metric results asynchronously
        //     metricsResults.update_from_api(results);
        // });

        // return;

        // // Calculate all absolute metrics for the given graph of the given setting
        const metricCalculators = MetricsCollection.metricsToCalculate.map(metric => new metric(graph));

        // Update the metrics of the visualization with the results
        const metricsResults = this.getMetricsResults(settingId);
        // This update also asynchronously calculates the metrics (at least the ones, that are not already calculated and take a longer time)
        // This update also updates the single metric results asynchronously
        metricsResults.update(metricCalculators);
    }

    /**
     * Initialize the metrics of the visualization with the given setting id to ensure,
     * that it is taken into account for the relative metrics even for the first time
     */
    initMetrics(settingId: number, ignoreIfExisting: boolean = true) {
        if (ignoreIfExisting && this.getMetricsResults(settingId).results.length > 0) {
            return;
        }
        const metricCalculators = MetricsCollection.metricsToCalculate.map(metric => new metric(new VisGraph()));
        this.getMetricsResults(settingId).update(metricCalculators);
    }

    /**
     * Clear all metrics of the visualization with the given setting id to mark them as pending while recalculating
     * @param settingId The setting id of the visualization
     */
    clearMetrics(settingId: number) {
        this.clearMetricResults(settingId);
        Array.from(this.mapKeyToSingleMetricResults.values()).forEach(singleMetricResults => {
            singleMetricResults.update();
        })
    }


    /**
     * Helper method to clean up the metrics results so that only the metrics of the current visualizations are stored
     * @param currentSettingIds The setting ids of the current visualizations
     */
    cleanSettings(currentSettingIds: number[]) {
        const currentSettingIdsSet = new Set(currentSettingIds);
        const toDelete = Array.from(this.mapIdToMetricsResults.keys()).filter(id => !currentSettingIdsSet.has(id));
        // Clean metrics results
        toDelete.forEach(id => {
            this.mapIdToMetricsResults.delete(id);
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

    // If some of the metrics are still pending
    get pending(): boolean {
        return this.results.some(result => result.pending);
    }

    // Sets all metrics to pending
    set pending(value: boolean) {
        this.results.forEach(result => {
            result.pending = value;
        });
    }

    /**
     * Emitter for events on the metrics results:
     * - "newMetrics": When there has been new metrics calculated
     * - "metricsUpdated": When the metrics have been updated
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

    /**
     * Returns the metric result object for the given metric definition.
     * Either takes the existing one or creates a new one.
     * Also takes care of linking the update events of the metric result to the metrics results
     * @param metricDefinition The metric definition to get the result for
     * @returns The metric result object
     */
    getMetricResult(metricDefinition: MetricDefinition): MetricResult {
        const key = metricDefinition.key;
        if (!this.mapMetricKeyToResult.has(key)) {

            // Create a new metric result
            const mr = new MetricResult(this.settingId, metricDefinition, this.collection.getSingleMetricResults(key));

            // Link its update events
            mr.emitter.on("relativeValueUpdated", () => {
                this.emitDebouncedMetricsUpdated();
            });
            mr.emitter.on("valueUpdated", () => {
                this.emitDebouncedMetricsUpdated();
            });


            this.mapMetricKeyToResult.set(key, mr);
        }
        return this.mapMetricKeyToResult.get(key)!;
    }

    /**
     * Updates the results of this visualization with the new metrics from the given calculators
     * @param calculators The calculators to get the metrics from. If undefined, the object is turned to pending state
     */
    update(calculators: MetricCalculator[]) {
        // Add the new results
        calculators.forEach(calculator => {
            // For each calculator, there can be multiple metrics
            calculator.getMetricDefinitions().forEach(metricDefinition => {

                // Get the metric result object for the specific metric definition
                // and update it with the new calculator
                const result = this.getMetricResult(metricDefinition);
                // This update asynchronously calculates the metric and emits an update event when done
                result.update(calculator);
            });
        })

        // Emit an update event
        this.emitter.emit("newMetrics");
    }

    update_from_api(results: MetricApiResult[]) {
        results.forEach(result => {
            const key = result.key;
            const metricResult = this.getMetricResult(result)
            metricResult.updateByValue(result.value, result.description);

            console.log("Updated metric", key, result.value, result.description ? `(Error: ${result.description})` : '');
        });
        this.emitter.emit("newMetrics");
    }

    /**
     * Debounced version of the metrics updated event
     */
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

    get pending(): boolean {
        return this.results.some(result => result.pending);
    }

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

    get finishedResults(): MetricResult[] {
        return this.results.filter(result => !result.pending);
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

    ////////////////////////////////////////////////////////////
    // Normalized values
    ////////////////////////////////////////////////////////////

    // The normalized values of the results
    get normalizedValues(): number[] {
        return this.results.map(result => result.normalizedValue);
    }

    // The minimum normalized value of the results
    get minNormalized(): number {
        return Math.min(...this.normalizedValues);
    }

    // The maximum normalized value of the results
    get maxNormalized(): number {
        return Math.max(...this.normalizedValues);
    }

    // The average normalized value of the results
    get averageNormalized(): number {
        return d3.mean(this.normalizedValues)!;
    }

    // The median normalized value of the results
    get medianNormalized(): number {
        return d3.median(this.normalizedValues)!;
    }

    // The standard deviation of the normalized values
    get standardDeviationNormalized(): number {
        return d3.deviation(this.normalizedValues)!;
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
    calculator?: MetricCalculator;

    // The key of the metric
    metricKey: string;

    // Place of the metric
    relativePlace: number = 0;

    // Number of total places to compare to
    places: number = 0;

    // If the metric is still pending its calculation
    pending: boolean = true;

    // Error message if calculation failed
    error?: string;

    // Color scale for the metric
    protected colorScale = d3.scaleSequential(d3.interpolateRdYlGn);

    // The value of the metric
    get value(): number {
        if (this.error) return Number.NaN;
        return this.calculator?.getMetric(this.metricKey) ?? Number.NaN;
    }

    // The color of the metric. Based on the normalized value relative to other metrics
    get color(): string {
        return this.colorScale(this.normalizedValue);
    }

    /**
     * Get the text color based on the color as background.
     * If the color is dark, the text color is white, otherwise black.
     */
    get textColor(): string {

        if (this.singleMetricResults.pending) return "black";

        const color = d3.rgb(d3.color(this.color)!);
        const labColor = d3.lab(color);
        const luminance = labColor.l
        if (luminance > 50) {
            return "black";
        }
        return "white";
    }

    // Reference to the single metric results of this metric
    singleMetricResults: SingleMetricResults;

    /**
     * Emitter for events on the metric result:
     * - "valueUpdated": When the value of the metric has been updated, so when the metric has been calculated
     * - "relativeValueUpdated": When the relative value of the metric has been updated due to other metrics new results
     */
    emitter = mitt<{
        valueUpdated: boolean,
        relativeValueUpdated: boolean
    }>();

    // The normalized value of the metric according to the normalizing method defined in the metric definition
    get normalizedValue(): number {
        if (!this.calculator) {
            return 0;
        }

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

        return normalizedValue;
    }


    get shortResult() {
        let abbr = this.definition.abbreviation ?? "";
        if (abbr.length == 0) {
            const label = this.definition.label;
            const split = label?.split(" ");
            split?.forEach(word => {
                abbr += word[0].toUpperCase();
            })
        }
        return abbr + ": " + this.normalizedValue.toFixed(2);
    }


    constructor(settingId: number, metricDefinition: MetricDefinition, singleMetricResults: SingleMetricResults) {
        this.settingId = settingId;
        this.definition = metricDefinition;

        this.metricKey = metricDefinition.key;
        this.singleMetricResults = singleMetricResults;
    }

    /**
     * Update the metric with the given calculator.
     * This method asynchronously calculates the metric and emits an "valueUpdated" event when done.
     * It also updates the single metric results of this metric.
     * @param calculator The metric calculator to calculate the metric
     */
    update(calculator: MetricCalculator) {
        this.calculator = calculator;
        this.pending = true;
        this.error = undefined;

        calculator.calculate().then(() => {
            this.pending = false;
            this.emitter.emit("valueUpdated", true);

            // Update the single metric results
            this.singleMetricResults.update();
        }).catch(err => {
            this.pending = false;
            this.error = err.message || "Error calculating metric";
            console.error("Error calculating metric", this.metricKey, this.settingId, err);
            this.emitter.emit("valueUpdated", true);

            // Update the single metric results even on error
            this.singleMetricResults.update();
        });
    }

    updateByValue(value: number, error?: string) {
        this.calculator = undefined;
        this.pending = false;
        this.error = error;
        this.emitter.emit("valueUpdated", true);
        this.singleMetricResults.update();
    }


    /**
     * Update the relative value of the metric.
     */
    updateRelative() {
        // Update the relative value of the metric
        let sortedResults: MetricResult[] = [];
        if (this.definition.optimum === "higherIsBetter") {
            sortedResults = this.singleMetricResults.results.sort((a, b) => b.normalizedValue - a.normalizedValue);
        } else if (this.definition.optimum === "lowerIsBetter") {
            sortedResults = this.singleMetricResults.results.sort((a, b) => a.normalizedValue - b.normalizedValue);
        }
        this.places = sortedResults.length;
        this.relativePlace = sortedResults.indexOf(this);

        // Adapt the color scale
        const results = this.singleMetricResults;
        const max = results.maxNormalized;
        const min = results.minNormalized;
        const colorScale = this.colorScale;
        let domain = [min, max];
        if (this.definition.optimum === "higherIsBetter") {
            domain = [min, max];
        } else if (this.definition.optimum === "lowerIsBetter") {
            domain = [max, min];
        }
        colorScale.domain(domain);

        this.emitter.emit("relativeValueUpdated", true);
    }

}



