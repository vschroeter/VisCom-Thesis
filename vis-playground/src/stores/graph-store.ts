import { defineStore } from 'pinia'

import { CommunicationGraph } from 'src/graph/commGraph'
import { GraphLayouterSettings } from 'src/graph/layouter/settings'
import { SettingsCollection } from 'src/graph/layouter/settingsCollection'

// Store for the global communication graph
export const useGraphStore = defineStore('graph', {
    state: () => ({
        graph: new CommunicationGraph([], []),
        currentSettings: undefined as GraphLayouterSettings | undefined,
        layouterSettingsCollectionJson: "{}" as string,
        settingsCollection: new SettingsCollection() as SettingsCollection,
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
