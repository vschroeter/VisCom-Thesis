import { defineStore } from 'pinia'

import { CommunicationGraph } from 'src/graph/commGraph'
import { GraphLayouterSettings } from 'src/graph/layouter/graphLayouter'
import { VisualizationSettings } from 'src/visaulizations/visualizationSettings'

// Store for the global communication graph
export const useGraphStore = defineStore('graph', {
    state: () => ({
        graph: new CommunicationGraph([], []),
        // currentSettings: undefined as VisualizationSettings<any> | undefined,
        currentSettings: undefined as GraphLayouterSettings | undefined,
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
