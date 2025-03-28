import { useApiStore } from "src/stores/api-store";
import { VisGraph } from "../visGraph/visGraph";

export type LaidOutNode = {
    id: string;
    x: number;
    y: number;
    score: number;
    radius: number;
}

export type LaidOutConnection = {
    source: string;
    target: string;
    weight: number;
    distance: number;
    path: string;
}

export type LaidOutDataApi = {
    nodes: LaidOutNode[];
    links: LaidOutConnection[];
}

export type MetricApiResult = {
    key: string;
    label?: string;
    description?: string;
    unit?: string;
    value: number;
    abbreviation?: string;
    optimum: "higherIsBetter" | "lowerIsBetter";
}

/**
 * Represents the status of a metrics calculation job
 */
export type MetricJobStatus = {
    job_id: string;
    method?: string;
    status: "pending" | "processing" | "completed" | "failed";
    results: Array<{
        key: string;
        value: number;
        type: "lower-better" | "higher-better";
        error?: string;
    }>;
    error?: string;
    created_at: number;
    started_at?: number;
    completed_at?: number;
    execution_time?: number;
}

export class MetricsApi {
    /**
     * Submits a job to calculate a specific metric for a graph layout.
     * @param graph The graph to calculate metrics for
     * @param metrics_type The type of metric to calculate
     * @param useAsync Whether to use async mode or wait for completion (default: true)
     * @returns Promise with job status or metric result depending on useAsync parameter
     */
    static fetchMetrics(graph: VisGraph, metrics_type: string, useAsync: boolean = true): Promise<MetricJobStatus | MetricApiResult> {
        const graphData = graph.getLaidOutApiData();
        const generatorApiUrl = useApiStore().generatorApiUrl;
        const url = `${generatorApiUrl}/metrics/calculate/${metrics_type}`;

        const params = new URLSearchParams();
        params.append('async', useAsync ? 'true' : 'false');

        const urlWithParams = `${url}?${params.toString()}`;

        console.log('Submitting metrics calculation job', urlWithParams);

        // Submit job request
        return fetch(urlWithParams, {
            method: 'POST',
            body: JSON.stringify(graphData),
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (useAsync) {
                    // In async mode, return the job status
                    return data as MetricJobStatus;
                } else {
                    // In sync mode, convert and return the metric result directly
                    return {
                        key: data.key,
                        value: data.value,
                        optimum: data.type === "lower-better" ? "lowerIsBetter" : "higherIsBetter",
                        label: data.key.replace(/_/g, ' '),
                        description: data.error || undefined
                    } as MetricApiResult;
                }
            })
            .catch(error => {
                console.error('Error submitting metrics calculation job:', error);
                throw error;
            });
    }

    /**
     * Checks the status of a metrics calculation job.
     * @param jobId The ID of the job to check
     * @returns Promise with the job status
     */
    static checkJobStatus(jobId: string): Promise<MetricJobStatus> {
        const generatorApiUrl = useApiStore().generatorApiUrl;
        const url = `${generatorApiUrl}/metrics/jobs/${jobId}`;

        console.log('Checking job status', url);

        return fetch(url)
            .then(response => response.json())
            .then(data => data as MetricJobStatus);
    }

    /**
     * Polls a job until it completes, fails, or times out.
     * @param jobId The ID of the job to poll
     * @param timeoutMs Maximum time to poll in milliseconds (default: 30000)
     * @param interval Polling interval in milliseconds (default: 1000)
     * @returns Promise that resolves with the job status when complete
     */
    static async pollJobUntilDone(jobId: string, timeoutMs: number = 30000, interval: number = 1000): Promise<MetricJobStatus> {
        const startTime = Date.now();

        // Define polling function that returns a promise
        const poll = async (): Promise<MetricJobStatus> => {
            const elapsedTime = Date.now() - startTime;
            const status = await MetricsApi.checkJobStatus(jobId);

            if (status.status === 'completed' || status.status === 'failed') {
                return status;
            }

            if (elapsedTime >= timeoutMs) {
                throw new Error(`Job polling timed out after ${elapsedTime}ms`);
            }

            // Wait for interval and then poll again
            return new Promise(resolve => {
                setTimeout(() => resolve(poll()), interval);
            });
        };

        // Start polling
        return poll();
    }

    /**
     * Fetches metrics and waits for the result, handling the polling automatically.
     * @param graph The graph to calculate metrics for
     * @param metrics_type The type of metric to calculate
     * @returns Promise with the metric result
     */
    static async fetchMetricsWithPolling(graph: VisGraph, metrics_type: string): Promise<MetricApiResult> {
        // Submit job
        const jobStatus = await MetricsApi.fetchMetrics(graph, metrics_type, true) as MetricJobStatus;

        // Poll until done
        const finalStatus = await MetricsApi.pollJobUntilDone(jobStatus.job_id);

        if (finalStatus.status === 'failed') {
            throw new Error(`Metrics calculation failed: ${finalStatus.error}`);
        }

        if (finalStatus.results && finalStatus.results.length > 0) {
            const result = finalStatus.results[0];
            return {
                key: result.key,
                value: result.value,
                optimum: result.type === "lower-better" ? "lowerIsBetter" : "higherIsBetter",
                label: result.key.replace(/_/g, ' '),
                description: undefined
            };
        }

        throw new Error('No metrics results available');
    }

    /**
     * Gets the list of available metrics.
     * @returns Promise with available metrics information
     */
    static getAvailableMetrics(): Promise<Record<string, { name: string, description: string }>> {
        const generatorApiUrl = useApiStore().generatorApiUrl;
        const url = `${generatorApiUrl}/metrics/methods`;

        console.log('Fetching available metrics', url);

        return fetch(url)
            .then(response => response.json());
    }
}

