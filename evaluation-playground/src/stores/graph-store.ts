import { defineStore } from 'pinia'

import { useStorage } from '@vueuse/core'

import { CommunicationGraph } from 'src/graph/commGraph'
import { MetricsCollection, MetricResult } from 'src/graph/metrics/collection'
import { GraphLayouterSettings } from 'src/graph/layouter/settings/settings'
import { SettingsCollection } from 'src/graph/layouter/settings/settingsCollection'
import { UserInteractions } from 'src/graph/visualizations/interactions'

// Store for the global communication graph
export const useGraphStore = defineStore('graph', {
    state: () => ({
        graph: new CommunicationGraph([], []),
        currentSettings: undefined as GraphLayouterSettings | undefined,
        activeSettingId: -1,
        layouterSettingsCollectionJson: useStorage("layouterSettingsCollectionJson", "{}" as string),
        settingsCollection: new SettingsCollection() as SettingsCollection,
        metricsCollection: new MetricsCollection() as MetricsCollection,
    }),
    getters: {
        // graph: (state) => state.graph,
    },
    actions: {
        setGraph(graph: CommunicationGraph) {
            this.graph = graph
        },

        downloadSettingsAsJson(title: string = '') {
            const json = this.settingsCollection.getJson()
            const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
            const fileName = title ? `settings_${title}_${timestamp}.json` : `settings_${timestamp}.json`
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        },

        uploadSettingsFromJson(file: File) {
            return new Promise<void>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target?.result as string)
                        this.settingsCollection.loadFromJson(json)
                        this.layouterSettingsCollectionJson = JSON.stringify(json)
                        resolve()
                    } catch (error) {
                        reject(error)
                    }
                }
                reader.onerror = (e) => reject(e)
                reader.readAsText(file)
            })
        },

        downloadDatasetAsJson(name: string, description: string) {
            const graph = this.graph as CommunicationGraph
            const nodes = graph.nodes

            const pubSubChannel = graph.getChannels("PubSub")
            const serviceChannel = graph.getChannels("Services")

            const dataset = {
                version: "1.0.0",
                name: name,
                description: description,
                created_at: new Date().toISOString(),
                nodeCount: nodes.length,
                author: "user", // Could be configurable in the future
                cc_by_sa_consent: true,
                nodes: nodes.map(node => {
                    const uniquePublishers = new Map<string, { name: string; type: string }>();
                    const uniqueSubscribers = new Map<string, { name: string; type: string }>();
                    const uniqueServices = new Map<string, { name: string; type: string }>();
                    const uniqueClients = new Map<string, { name: string; type: string }>();

                    this.graph.getOutgoingLinks(node, pubSubChannel).forEach(link => {
                        if (!uniquePublishers.has(link.topic.id)) {
                            uniquePublishers.set(link.topic.id, {
                                name: link.topic.id,
                                type: link.topic.messageType.name
                            });
                        }
                    });

                    this.graph.getIncomingLinks(node, pubSubChannel).forEach(link => {
                        if (!uniqueSubscribers.has(link.topic.id)) {
                            uniqueSubscribers.set(link.topic.id, {
                                name: link.topic.id,
                                type: link.topic.messageType.name
                            });
                        }
                    });

                    this.graph.getOutgoingLinks(node, serviceChannel).forEach(link => {
                        if (!uniqueServices.has(link.topic.id)) {
                            uniqueServices.set(link.topic.id, {
                                name: link.topic.id,
                                type: link.topic.messageType.name
                            });
                        }
                    });

                    this.graph.getIncomingLinks(node, serviceChannel).forEach(link => {
                        if (!uniqueClients.has(link.topic.id)) {
                            uniqueClients.set(link.topic.id, {
                                name: link.topic.id,
                                type: link.topic.messageType.name
                            });
                        }
                    });

                    return {
                        name: node.id,
                        namespace: "/",
                        localhost_only: false,
                        publishers: Array.from(uniquePublishers.values()),
                        subscribers: Array.from(uniqueSubscribers.values()),
                        services: Array.from(uniqueServices.values()),
                        clients: Array.from(uniqueClients.values()),
                    };
                })
            }

            const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url

            // Format the node count with leading zeros
            const nodeCountFormatted = nodes.length.toString().padStart(4, '0');

            // Format date and time
            const now = new Date();
            const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
            const time = now.toISOString().slice(11, 19).replace(/:/g, '_'); // HH_MM_SS

            // Create filename with the new format
            const fileName = `${nodeCountFormatted}nodes_${date}_${time}_${name.replace(/\s+/g, '_')}.json`;

            a.download = fileName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        },

        /**
         * Check if all metrics have been calculated for all visualizations
         * @returns true if all metrics have been calculated, false otherwise
         */
        areAllMetricsCalculated(): boolean {
            // Get all current setting IDs
            const settingsIds = Array.from(this.settingsCollection.mapIdToSettings.keys());

            // If there are no settings, return false
            if (settingsIds.length === 0) return false;

            // Check if any of the metrics results are pending
            return !settingsIds.some(id => {
                const metricsResults = this.metricsCollection.getMetricsResults(id);
                return metricsResults.pending;
            });
        },

        /**
         * Download all metric results as JSON
         * @param title Title of the metrics file
         * @param description Description of the metrics file
         */
        downloadMetricsAsJson(title: string = '', description: string = '') {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

            // Get all current setting IDs
            const settingsIds = Array.from(this.settingsCollection.mapIdToSettings.keys());

            // Get metrics for each setting
            const metricsData: Record<string, any> = {};
            const csvData: Record<string, Record<string, number | null>> = {};

            // Dataset info
            const datasetInfo = {
                title: title || 'Metrics Results',
                description: description || 'Metrics results for multiple visualizations',
                timestamp: timestamp,
                nodeCount: this.graph.nodes.length,
                connectionCount: this.graph.getAllLinks().length,
                visualizationCount: settingsIds.length,
                isSynthetic: title.startsWith('S_') || false,
            };

            // Collect metrics for each setting
            settingsIds.forEach(settingId => {
                const settings = this.settingsCollection.getSettings(settingId);
                if (!settings) return;

                const settingType = settings.type;
                const settingTitle = settings.name || `Setting ${settingId}`;
                const settingName = settingType + '_' + settingTitle.replace(/\s+/g, '_');
                const metricsResults = this.metricsCollection.getMetricsResults(settingId);

                const metricResults: Record<string, any> = {};
                metricsResults.results.forEach(result => {
                    metricResults[result.metricKey] = {
                        value: result.value,
                        // normalizedValue: result.normalizedValue,
                        definition: {
                            key: result.definition.key,
                            label: result.definition.label,
                            // description: result.definition.description,
                            optimum: result.definition.optimum,
                            unit: result.definition.unit,
                            abbreviation: result.definition.abbreviation
                        },
                        // pending: result.pending,
                        error: result.error || undefined
                    };

                    // Add to CSV data
                    if (!csvData[result.metricKey]) {
                        csvData[result.metricKey] = {};
                    }
                    csvData[result.metricKey][settingName] = result.pending ? null : result.normalizedValue;
                });

                // Get the full settings configuration
                const settingsJson = settings.getJson();

                // Include the visualization settings in the output
                metricsData[settingId.toString()] = {
                    id: settingId,
                    name: settingName,
                    type: settingType,
                    metrics: metricResults,
                    configuration: settingsJson
                };
            });

            // Generate CSV string
            const csvString = this.generateMetricsCsv(csvData);

            // Construct final JSON
            const finalJson = {
                dataset: datasetInfo,
                visualizations: metricsData,
                csvSummary: csvString
            };

            // Download as file
            const blob = new Blob([JSON.stringify(finalJson, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Create filename
            const fileName = title
                ? `metrics_${title.replace(/\s+/g, '_')}_${timestamp}.json`
                : `metrics_${timestamp}.json`;

            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        /**
         * Generate CSV string from metrics data
         * @param metricsData Object containing metrics data
         * @returns CSV string representation of metrics data
         */
        generateMetricsCsv(metricsData: Record<string, Record<string, number | null>>): string {
            // Get all metric keys and visualization names
            const metricKeys = Object.keys(metricsData);
            if (metricKeys.length === 0) return '';

            const allVisNames = new Set<string>();
            metricKeys.forEach(key => {
                Object.keys(metricsData[key]).forEach(visName => {
                    allVisNames.add(visName);
                });
            });
            const visNames = Array.from(allVisNames);

            // Create header row
            let csv = 'Metric,' + visNames.join(',') + '\n';

            // Add data rows
            metricKeys.forEach(metricKey => {
                csv += metricKey + ',';
                const rowData = visNames.map(visName => {
                    const value = metricsData[metricKey][visName];
                    return value === null ? 'N/A' : value.toFixed(4);
                });
                csv += rowData.join(',') + '\n';
            });

            return csv;
        }
    },
})
