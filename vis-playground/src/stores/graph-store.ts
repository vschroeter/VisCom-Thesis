import { defineStore } from 'pinia'

import { CommunicationGraph } from 'src/graph/commGraph'
import { VisualizationSettings } from 'src/visualizations/visualizationSettings'

// Store for the global communication graph
export const useGraphStore = defineStore('graph', {
    state: () => ({
        graph: new CommunicationGraph([], []),
        currentSettings: undefined as VisualizationSettings<any> | undefined,
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
