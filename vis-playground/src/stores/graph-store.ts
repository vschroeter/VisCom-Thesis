import { defineStore } from 'pinia'

import { CommunicationGraph } from 'src/graph/commGraph'

// Store for the global communication graph
export const useGraphStore = defineStore('graph', {
    state: () => ({
        graph: new CommunicationGraph([], []),
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
