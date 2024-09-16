<template>
    <div class="q-pa-sm">
        <!-- Everything below should be made out of Quasar Components -->

        <!-- Title -->
        <q-item-label header class="q-mb-md">
            Graph Generating
        </q-item-label>

        <q-list bordered>


            <!-- Expabsuib containing the connection settings -->
            <q-expansion-item v-model="showConnectionSettings" label="Connection Settings" icon="sym_o_settings"
                expand-separator>
                <q-card>
                    <q-card-section>

                        <q-input v-model="generatorApiUrl" label="Generator API URL" class="q-mb-md" />

                    </q-card-section>
                </q-card>
            </q-expansion-item>

            <!-- Divider -->
            <!-- <q-separator class="q-mb-md" /> -->

            <!-- Dropdown to select the generator method -->
            <q-expansion-item v-model="showGeneratorSettings" label="Graph Generator" icon="sym_o_hub" expand-separator>
                <q-card>
                    <q-card-section>


                        <q-select v-model="selectedGenerator" :options="generators"
                            :option-label="(generator: Generator) => keyToName(generator.key)" label="Select Generator"
                            outlined @focus="fetchGenerateMethods" class="q-mb-md" />

                        <!-- Description of the generator -->
                        <q-item-label class="q-mb-md">
                            {{ selectedGenerator?.description }}
                        </q-item-label>

                        <!-- Input for each parameter in the selected generator, depending on its type. -->
                        <q-item v-for="(param, key) in selectedGenerator?.paramList" :key="key" class="q-mb-xs">
                            <q-item-section>
                                <q-item-label>
                                    {{ param.description }}
                                </q-item-label>
                            </q-item-section>
                            <q-item-section>
                                <q-input v-model="param.value" :type="param.inputType" :min="param.range?.min"
                                    :max="param.range?.max" :step="param.type == 'int' ? 1 : 0.01" outlined />
                            </q-item-section>
                        </q-item>

                        <!-- Button to generate the graph -->

                        <q-btn :disable="selectedGenerator === null" label="Generate" color="primary"
                            @click="fetchGeneratedGraph(selectedGenerator?.key)" />
                    </q-card-section>
                </q-card>

            </q-expansion-item>

            <q-expansion-item v-model="showComunityDetectionSettings" label="Community Detection"
                icon="sym_o_communities" expand-separator>
                <q-card>
                    <q-card-section>


                        <q-select v-model="selectedCommunityDetection" :options="communityDetections"
                            :option-label="(generator: Generator) => keyToName(generator.key)"
                            label="Community Detection Method" outlined @focus="fetchCommunityDetectionMethods"
                            class="q-mb-md" />



                        <!-- Description of the generator -->
                        <q-item-label class="q-mb-md">
                            {{ selectedCommunityDetection?.description }}
                        </q-item-label>

                        <!-- Input for each parameter in the selected generator, depending on its type. -->
                        <q-item v-for="(param, key) in selectedCommunityDetection?.paramList" :key="key" class="q-mb-xs">
                            <q-item-section>
                                <q-item-label>
                                    {{ param.description }}
                                </q-item-label>
                            </q-item-section>
                            <q-item-section>
                                <q-input v-model="param.value" :type="param.inputType" :min="param.range?.min"
                                    :max="param.range?.max" :step="param.type == 'int' ? 1 : 0.01" outlined />
                            </q-item-section>
                        </q-item>

                        <!-- Button to fetch the communities -->

                        <q-btn :disable="selectedCommunityDetection === null" label="Generate" color="primary"
                            @click="fetchCommunities(selectedCommunityDetection?.key)" />

                    </q-card-section>

                </q-card>
            </q-expansion-item>
        </q-list>

    </div>
</template>

<script setup lang="ts">

import { useStorage } from '@vueuse/core';
import { ApiGeneratorMethods, Generator, GeneratorMethods } from 'src/api/generatorApi';
import { commGraphToNodeLinkData, parseGraphData } from 'src/api/graphDataApi';
import { CommunicationGraph } from 'src/graph/commGraph';
import { convertGraphToCommGraph } from 'src/graph/converter';
import { useGraphStore } from 'src/stores/graph-store';
import { computed, onMounted, onUpdated, reactive, ref, watch, type Ref } from 'vue'

////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

// const props = defineProps()

////////////////////////////////////////////////////////////////////////////
// Stores
////////////////////////////////////////////////////////////////////////////

const graphStore = useGraphStore()
const currentGraph: Ref<CommunicationGraph> = computed(() => graphStore.graph as CommunicationGraph)

////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////

const showConnectionSettings = ref(false)
const generatorApiUrl = ref('http://127.0.0.1:5000')

////////////////////////////////////////////////////////////////////////////
// Graph Generator
////////////////////////////////////////////////////////////////////////////
const showGeneratorSettings = useStorage("showGeneratorSettings", true)
const generateMethods: Ref<GeneratorMethods | null> = ref(null)

const selectedGenerator: Ref<Generator | null> = ref(null)
const generators = computed(() => {
    if (generateMethods.value === null) {
        return []
    }
    return Array.from(generateMethods.value?.generators.values())
})


watch(selectedGenerator, (newVal) => {
    console.log(newVal)
})




// const selectedGenerator = ref('')
// const generatorNames = computed(() => {
//     if (generateMethods.value === null) {
//         return []
//     }
//     // Remove underscore and make the words capitalized
//     return Array.from(generateMethods.value?.generators.keys()).map((k) => {
//         return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
//     })
// })


////////////////////////////////////////////////////////////////////////////
// Community Detection Methods
////////////////////////////////////////////////////////////////////////////
const showComunityDetectionSettings = useStorage("showComunityDetectionSettings", true)
const communityDetectionMethods: Ref<GeneratorMethods | null> = ref(null)

const selectedCommunityDetection: Ref<Generator | null> = ref(null)

const communityDetections = computed(() => {
    if (communityDetectionMethods.value === null) {
        return []
    }
    return Array.from(communityDetectionMethods.value?.generators.values())
})


////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////

function keyToName(key: string) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function fetchGenerateMethods() {
    fetch(`${generatorApiUrl.value}/generate/methods`)
        .then(response => response.json())
        .then((data: ApiGeneratorMethods) => {
            const methods = reactive(new GeneratorMethods(data))
            generateMethods.value = methods
            console.log(generateMethods)
        })
}

function fetchCommunityDetectionMethods() {
    fetch(`${generatorApiUrl.value}/analyze/communities/methods`)
        .then(response => response.json())
        .then((data: ApiGeneratorMethods) => {
            const methods = reactive(new GeneratorMethods(data))
            communityDetectionMethods.value = methods
            console.log(communityDetectionMethods)
        })
}

function fetchGeneratedGraph(generatorId?: string) {
    if (generatorId === undefined) {
        return
    }

    const url = `${generatorApiUrl.value}/generate/${generatorId}`

    const params = new URLSearchParams()
    selectedGenerator.value?.paramList.forEach((param) => {
        params.append(param.key, param.value.toString())
    })

    fetch(`${url}?${params.toString()}`)
        .then(response => response.json())
        .then((data) => {
            const graph = parseGraphData(data)

            const commGraph = convertGraphToCommGraph(graph)

            console.log(data, graph, commGraph)
            graphStore.setGraph(commGraph)
        })
}

function fetchCommunities(generatorId?: string) {
    if (generatorId === undefined) {
        return
    }

    const url = `${generatorApiUrl.value}/analyze/communities/${generatorId}`

    const params = new URLSearchParams()
    selectedCommunityDetection.value?.paramList.forEach((param) => {
        params.append(param.key, param.value.toString())
    })

    const urlWithParams = `${url}?${params.toString()}`

    // Fetch a POST request with the parameters
    fetch(urlWithParams, {
        method: 'POST',
        body: JSON.stringify(commGraphToNodeLinkData(currentGraph.value)),
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then((data) => {
            console.log(data)
            currentGraph.value.communities.setCommunitiesByList(data)
        })

}

////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

onMounted(() => {
    // fetchGenerateMethods()
})

onUpdated(() => {

})

</script>

<style scoped></style>