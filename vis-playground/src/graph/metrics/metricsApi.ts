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


export class MetricsApi {

    static fetchMetrics(graph: VisGraph, metrics_type: string): Promise<MetricApiResult> {

        const graphData = graph.getLaidOutApiData()
        const generatorApiUrl = useApiStore().generatorApiUrl
        const url = `${generatorApiUrl}/metrics/calculate/${metrics_type}`

        const params = new URLSearchParams()

        const urlWithParams = `${url}?${params.toString()}`

        console.log('fetching metrics', urlWithParams)

        // Fetch a POST request with the parameters
        return fetch(urlWithParams, {
            method: 'POST',
            body: JSON.stringify(graphData),
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
    }



}

