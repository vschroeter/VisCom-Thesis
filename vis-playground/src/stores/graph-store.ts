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
    },
})
