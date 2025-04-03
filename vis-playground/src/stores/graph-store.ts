import { defineStore } from 'pinia'

import { useStorage } from '@vueuse/core'

import { CommunicationGraph } from 'src/graph/commGraph'
import { MetricsCollection } from 'src/graph/metrics/collection'
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

        downloadSettingsAsJson() {
            const json = this.settingsCollection.getJson()
            const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `settings_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
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
            a.download = `${name.replace(/\s+/g, '_')}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        }
    },
})
