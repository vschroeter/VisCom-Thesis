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
    // Queue for pending metric requests
    private static metricRequestQueue: Array<() => Promise<any>> = [];

    // // Currently active requests
    // private static activeRequests = 0;

    // Queue processing status
    private static isProcessingQueue = false;

    /**
     * Add a request to the queue and start processing if not already running
     * @param requestFn Function that performs the actual API request
     * @returns Promise that resolves with the request result
     */
    private static enqueueRequest<T>(requestFn: () => Promise<T>, insertAtStart = false): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            // Add to queue

            this.metricRequestQueue[insertAtStart ? 'unshift' : 'push'](async () => {
                try {
                    const result = await requestFn();
                    resolve(result);
                    return result;
                } catch (error) {
                    reject(error);
                    throw error;
                }
            });

            // Start processing queue if not already running
            if (!this.isProcessingQueue) {
                this.processQueue();
            }
        });
    }

    /**
     * Process the queue of pending requests respecting the parallel limit
     */
    private static async processQueue() {
        // Mark as processing
        this.isProcessingQueue = true;

        while (this.metricRequestQueue.length > 0) {
            const apiStore = useApiStore();
            const maxParallel = apiStore.maxParallelApiCalls;

            // Wait until we have an available slot
            if (apiStore.activeApiCalls >= maxParallel) {
                // console.info(`Max parallel requests (${maxParallel}) reached. Waiting for completion...`);
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }

            // Get next request
            const request = this.metricRequestQueue.shift();
            if (!request) continue;

            // Execute the request
            apiStore.activeApiCalls++;

            // Execute without awaiting to allow parallel processing
            request()
                .finally(() => {
                    apiStore.activeApiCalls--;
                });
        }

        // Mark as not processing
        this.isProcessingQueue = false;
    }

    /**
     * Submits a job to calculate a specific metric for a graph layout.
     * @param graph The graph to calculate metrics for
     * @param metrics_type The type of metric to calculate
     * @param useAsync Whether to use async mode or wait for completion (default: true)
     * @returns Promise with job status or metric result depending on useAsync parameter
     */
    static fetchMetrics(graph: VisGraph, metrics_type: string, useAsync: boolean = true): Promise<MetricJobStatus | MetricApiResult> {
        return this.enqueueRequest(async () => {
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
        });
    }

    /**
     * Checks the status of a metrics calculation job.
     * @param jobId The ID of the job to check
     * @returns Promise with the job status
     */
    static checkJobStatus(jobId: string): Promise<MetricJobStatus> {
        return this.enqueueRequest(async () => {
            const generatorApiUrl = useApiStore().generatorApiUrl;
            const url = `${generatorApiUrl}/metrics/jobs/${jobId}`;
            // console.log('Checking job status', url);

            return fetch(url)
                .then(response => response.json())
                .then(data => data as MetricJobStatus);
        }, true);
    }

    /**
     * Polls a job until it completes, fails, or times out.
     * @param jobId The ID of the job to poll
     * @param timeoutMs Maximum time to poll in milliseconds (default: 30000)
     * @param interval Polling interval in milliseconds (default: 1000)
     * @returns Promise that resolves with the job status when complete
     */
    static async pollJobUntilDone(jobId: string, timeoutMs: number = 120000, interval: number = 1000): Promise<MetricJobStatus> {
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
     * @param retries Maximum number of retry attempts (default: 5)
     * @returns Promise with the metric result
     */
    static async fetchMetricsWithPolling(graph: VisGraph, metrics_type: string, retries: number = 5): Promise<MetricApiResult> {
        let attempt = 0;
        let jobStatus: MetricJobStatus | undefined;

        // Retry loop for submitting the job
        while (attempt < retries) {
            try {
                const result = await MetricsApi.fetchMetrics(graph, metrics_type, true);
                jobStatus = result as MetricJobStatus;

                // Check if we got a valid job status with a job ID
                if (!jobStatus || !jobStatus.job_id) {
                    throw new Error("Invalid job status or missing job ID");
                }

                // We have a valid job status, break the retry loop
                break;
            } catch (error) {
                attempt++;
                console.error(`Error submitting metrics job (attempt ${attempt}/${retries}):`, error);

                if (attempt >= retries) {
                    return {
                        key: metrics_type,
                        value: Number.NaN,
                        optimum: "lowerIsBetter",
                        label: metrics_type.replace(/_/g, ' '),
                        description: `Failed to submit job: ${error instanceof Error ? error.message : 'Unknown error'}`
                    };
                }

                // Delay before retry with exponential backoff
                const delayMs = 500 * Math.pow(1.5, attempt);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        // If we've exited the retry loop without a valid jobStatus, something went wrong
        if (!jobStatus || !jobStatus.job_id) {
            return {
                key: metrics_type,
                value: Number.NaN,
                optimum: "lowerIsBetter",
                label: metrics_type.replace(/_/g, ' '),
                description: "Failed to get valid job status after retries"
            };
        }

        try {
            // Poll until done
            const finalStatus = await MetricsApi.pollJobUntilDone(jobStatus.job_id);
            // console.warn("[API] Final job status:", finalStatus, metrics_type);


            if (finalStatus.status === 'failed') {
                return {
                    key: metrics_type,
                    value: Number.NaN,
                    optimum: "lowerIsBetter",
                    label: metrics_type.replace(/_/g, ' '),
                    description: finalStatus.error || "Metric calculation failed"
                };
            }

            if (finalStatus.results && finalStatus.results.length > 0) {
                const result = finalStatus.results[0];
                if (result.error) {
                    return {
                        key: result.key,
                        value: Number.NaN,
                        optimum: result.type === "lower-better" ? "lowerIsBetter" : "higherIsBetter",
                        label: result.key.replace(/_/g, ' '),
                        description: result.error
                    };
                }

                return {
                    key: result.key,
                    value: result.value,
                    optimum: result.type === "lower-better" ? "lowerIsBetter" : "higherIsBetter",
                    label: result.key.replace(/_/g, ' '),
                    description: undefined
                };
            }

            return {
                key: metrics_type,
                value: Number.NaN,
                optimum: "lowerIsBetter",
                label: metrics_type.replace(/_/g, ' '),
                description: 'No metrics results available'
            };
        } catch (error) {
            return {
                key: metrics_type,
                value: Number.NaN,
                optimum: "lowerIsBetter",
                label: metrics_type.replace(/_/g, ' '),
                description: `Error polling job: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Gets the list of available metrics.
     * @returns Promise with available metrics information
     */
    static getAvailableMetrics(): Promise<Record<string, { name: string, description: string }>> {
        return this.enqueueRequest(async () => {
            const generatorApiUrl = useApiStore().generatorApiUrl;
            const url = `${generatorApiUrl}/metrics/methods`;

            console.log('Fetching available metrics', url);

            return fetch(url)
                .then(response => response.json());
        });
    }
}

