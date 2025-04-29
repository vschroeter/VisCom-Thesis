import { defineStore } from 'pinia'

import { useStorage } from '@vueuse/core'

// Store for the global communication graph
export const useApiStore = defineStore('api', {
    state: () => ({
        generatorApiUrl: useStorage("generatorApiUrl", "http://localhost:5000" as string),
        maxParallelApiCalls: useStorage("maxParallelApiCalls", 5 as number),
        activeApiCalls: 0,
    }),
    getters: {
    },
    actions: {
    },
})
