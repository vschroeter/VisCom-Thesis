<template>
    <div class="q-pa-sm">
        <!-- Everything below should be made out of Quasar Components -->

        <!-- Title -->
        <div class="row items-center q-px-md q-my-md">
            <div class="text-h6">Graph Generation</div>
            <q-space />
            <q-btn flat dense icon="save_alt" aria-label="Download Dataset" @click="showDatasetDialog = true" :disable="!currentGraph?.nodes.length">
                <q-tooltip>Download Dataset</q-tooltip>
            </q-btn>
        </div>

        <q-list bordered>


            <!-- Expansion containing the connection settings -->
            <q-expansion-item v-model="showConnectionSettings" label="Connection Settings" icon="sym_o_settings"
                expand-separator>
                <q-card>
                    <q-card-section>

                        <q-input v-model="generatorApiUrl" label="Generator API URL" class="q-mb-md" />

                        <q-input
                            v-model.number="maxParallelApiCalls"
                            type="number"
                            label="Max Parallel API Calls"
                            min="1"
                            max="64"
                            class="q-mb-md"
                            hint="Maximum number of parallel API requests for metrics"
                        />

                    </q-card-section>
                </q-card>
            </q-expansion-item>

            <!-- Divider -->
            <!-- <q-separator class="q-mb-md" /> -->

            <!-- Dropdown to select the generator method -->
            <q-expansion-item v-model="showGeneratorSettings" label="Graph Generator" icon="sym_o_hub" expand-separator>
                <q-card>
                    <q-card-section>


                        <!-- use-input -->
                        <q-select v-model="selectedGenerator" :options="generators"
                            :option-label="(generator: Generator) => keyToName(generator.key)"
                            outlined
                            @focus="fetchGenerateMethods"
                            class="q-mb-md">
                            <template v-slot:option="scope">
                                <q-item v-bind="scope.itemProps">
                                    <q-item-section avatar>
                                        <q-icon :name="getGeneratorIcon(scope.opt)" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-label>{{ keyToName(scope.opt.key) }}</q-item-label>
                                        <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                                    </q-item-section>
                                </q-item>
                            </template>
                            <template v-slot:selected>
                                <div class="row items-center">
                                    <q-icon :name="getGeneratorIcon(selectedGenerator)" class="q-mr-xs" />
                                    {{ selectedGenerator ? keyToName(selectedGenerator.key) : 'Select Generator' }}
                                </div>
                            </template>
                        </q-select>

                        <!-- Description of the generator -->
                        <q-item-label class="q-mb-md">
                            {{ selectedGenerator?.description }}
                        </q-item-label>

                        <!-- Input for each parameter in the selected generator, depending on its type. -->
                        <div v-if="selectedGenerator">
                            <div v-for="(param, key) in selectedGenerator?.paramList" :key="param.key" class="q-mb-md">
                                <ParamInput v-model="selectedGenerator.parameterRecord[param.key]" outlined />
                            </div>
                        </div>

                        <!-- Button to generate the graph -->

                        <q-btn :disable="selectedGenerator === null" label="Generate" color="primary"
                            @click="fetchGeneratedGraph(selectedGenerator?.key)" />
                    </q-card-section>
                </q-card>

            </q-expansion-item>

            <q-expansion-item v-if="false" v-model="showComunityDetectionSettings" label="Community Detection"
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
                        <div v-if="selectedCommunityDetection">
                            <div v-for="(param, key) in selectedCommunityDetection?.paramList" :key="param.key"
                                class="q-mb-md">
                                <ParamInput v-model="selectedCommunityDetection!.parameterRecord[param.key]" outlined />
                            </div>
                        </div>

                        <!-- Button to fetch the communities -->

                        <q-btn :disable="selectedCommunityDetection === null" label="Generate" color="primary"
                            @click="fetchCommunities(selectedCommunityDetection?.key)" />

                    </q-card-section>

                </q-card>
            </q-expansion-item>

            <q-expansion-item label="Node Ranking" icon="sym_o_analytics" expand-separator>
                <q-card>
                    <q-card-section>

                        <q-select v-model="selectedNodeRanking" :options="nodeRankings"
                            :option-label="(ranking: Generator) => keyToName(ranking.key)" label="Node Ranking Method"
                            outlined @focus="fetchNodeRankingMethods" class="q-mb-md" />

                        <!-- Description of the ranking -->
                        <q-item-label class="q-mb-md">
                            {{ selectedNodeRanking?.description }}
                        </q-item-label>

                        <!-- Input for each parameter in the selected ranking, depending on its type. -->
                        <div v-if="selectedNodeRanking">
                            <div v-for="(param, key) in selectedNodeRanking?.paramList" :key="param.key"
                                class="q-mb-md">
                                <ParamInput v-model="selectedNodeRanking.parameterRecord[param.key]" outlined />
                            </div>
                        </div>

                        <!-- Button to fetch the ranking -->
                        <q-btn :disable="selectedNodeRanking === null" label="Generate" color="primary"
                            @click="fetchNodeRanking(selectedNodeRanking?.key)" />

                    </q-card-section>
                </q-card>
            </q-expansion-item>

        </q-list>

        <!-- Add dataset download dialog -->
        <q-dialog v-model="showDatasetDialog" persistent>
            <q-card style="min-width: 350px">
                <q-card-section>
                    <div class="text-h6">Download Dataset</div>
                </q-card-section>

                <q-card-section class="q-pt-none">
                    <q-input dense v-model="datasetName" label="Name" :rules="[val => !!val || 'Name is required']"
                        class="q-mb-md" autofocus @keyup.enter="downloadDataset" />
                    <q-input dense v-model="datasetDescription" label="Description" type="textarea"
                        :rules="[val => !!val || 'Description is required']" @keyup.enter="downloadDataset" />
                </q-card-section>

                <q-card-actions align="right">
                    <q-btn flat label="Cancel" color="primary" v-close-popup />
                    <q-btn flat label="Download" color="primary" @click="downloadDataset" :disable="!datasetName"
                        v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </div>
</template>

<script setup lang="ts">

import { useStorage, useThrottleFn } from '@vueuse/core';
import { ApiGeneratorMethods, Generator, GeneratorMethods } from 'src/api/generatorApi';
import { commGraphToNodeLinkData, parseGraphData } from 'src/api/graphDataApi';
import { CommunicationGraph } from 'src/graph/commGraph';
import { convertGraphToCommGraph } from 'src/graph/converter';
import { useGraphStore } from 'src/stores/graph-store';
import { computed, onMounted, onUpdated, reactive, ref, type Ref } from 'vue'
import ParamInput from '../elements/ParamInput.vue';
import { useApiStore } from 'src/stores/api-store';

////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

// const props = defineProps()

////////////////////////////////////////////////////////////////////////////
// Stores
////////////////////////////////////////////////////////////////////////////

const graphStore = useGraphStore()
const apiStore = useApiStore()
const currentGraph: Ref<CommunicationGraph> = computed(() => graphStore.graph as CommunicationGraph)

////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////

const showConnectionSettings = ref(false)
// const generatorApiUrl = ref('http://127.0.0.1:5000')
// const { generatorApiUrl } = storeToRefs(apiStore)
const generatorApiUrl = computed({
    get: () => apiStore.generatorApiUrl,
    set: (value) => {
        console.log("Setting generatorApiUrl to", value)
        apiStore.generatorApiUrl = value
    }
})

const maxParallelApiCalls = computed({
    get: () => apiStore.maxParallelApiCalls,
    set: (value) => {
        console.log("Setting maxParallelApiCalls to", value)
        apiStore.maxParallelApiCalls = value
    }
})

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

    return Array.from(generateMethods.value?.generators.values()).sort((a, b) => {
        // First compare by type: generators, then synthetic datasets, then real-world datasets
        if (a.isGenerator && !b.isGenerator) return -1;
        if (!a.isGenerator && b.isGenerator) return 1;

        if (a.isSyntheticDataset && b.isRealDataset) return 1;
        if (a.isRealDataset && b.isSyntheticDataset) return -1;

        const aStartingWithS = a.key.startsWith('s_')
        const bStartingWithS = b.key.startsWith('s_')

        if (aStartingWithS && !bStartingWithS) return -1
        if (!aStartingWithS && bStartingWithS) return 1

        return a.key.localeCompare(b.key)
    })
})


// watch(selectedGenerator, (newVal) => {
//     console.log(newVal)
// })

const throttledFetchOfGenerators = useThrottleFn(() => {
    fetchGenerateMethods()
}, 10000, true)

function fetchGenerateMethods() {
    fetch(`${generatorApiUrl.value}/generate/methods`)
        .then(response => response.json())
        .then((data: ApiGeneratorMethods) => {
            const methods = reactive(new GeneratorMethods(data)) as GeneratorMethods
            generateMethods.value = methods
            // console.log(generateMethods)
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

    return fetch(`${url}?${params.toString()}`)
        .then(response => response.json())
        .then((data) => {
            console.log(data)
            const graph = parseGraphData(data)

            const commGraph = convertGraphToCommGraph(graph)

            if (commGraph === null) {
                return
            }

            console.log(data, graph, commGraph)
            if (selectedCommunityDetection.value?.key !== undefined) {
                fetchCommunities(selectedCommunityDetection.value?.key, commGraph)?.then(() => {
                    // graphStore.setGraph(commGraph)
                }).finally(() => {
                    graphStore.setGraph(commGraph)
                })
            } else {
                graphStore.setGraph(commGraph)
            }
        })
}

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


function fetchCommunityDetectionMethods() {
    fetch(`${generatorApiUrl.value}/analyze/communities/methods`)
        .then(response => response.json())
        .then((data: ApiGeneratorMethods) => {
            const methods = reactive(new GeneratorMethods(data)) as GeneratorMethods
            communityDetectionMethods.value = methods
            console.log(communityDetectionMethods)
        })
}



function fetchCommunities(generatorId?: string, graph?: CommunicationGraph) {
    if (generatorId === undefined) {
        return
    }

    graph = graph ?? currentGraph.value
    if (!graph) {
        return
    }

    const url = `${generatorApiUrl.value}/analyze/communities/${generatorId}`

    const params = new URLSearchParams()
    selectedCommunityDetection.value?.paramList.forEach((param) => {
        params.append(param.key, param.value.toString())
    })

    const urlWithParams = `${url}?${params.toString()}`

    // Fetch a POST request with the parameters
    return fetch(urlWithParams, {
        method: 'POST',
        body: JSON.stringify(commGraphToNodeLinkData(graph)),
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then((data) => {
            console.log(data)
            graph?.communities.setCommunitiesByList(data)
        })

}

////////////////////////////////////////////////////////////////////////////
// Node Ranking Methods
////////////////////////////////////////////////////////////////////////////

const showNodeRankingSettings = useStorage("showNodeRankingSettings", true)
const nodeRankingMethods: Ref<GeneratorMethods | null> = ref(null)

const selectedNodeRanking: Ref<Generator | null> = ref(null)

const nodeRankings = computed(() => {
    if (nodeRankingMethods.value === null) {
        return []
    }
    return Array.from(nodeRankingMethods.value?.generators.values())
})

function fetchNodeRankingMethods() {
    fetch(`${generatorApiUrl.value}/analyze/noderank/methods`)
        .then(response => response.json())
        .then((data: ApiGeneratorMethods) => {
            const methods = reactive(new GeneratorMethods(data)) as GeneratorMethods
            nodeRankingMethods.value = methods
            console.log(nodeRankingMethods)
        })
}

function fetchNodeRanking(generatorId?: string, graph?: CommunicationGraph) {

    if (generatorId === undefined) {
        return
    }

    graph = graph ?? currentGraph.value
    if (!graph) {
        return
    }

    const url = `${generatorApiUrl.value}/analyze/noderank/${generatorId}`

    const params = new URLSearchParams()
    selectedNodeRanking.value?.paramList.forEach((param) => {
        params.append(param.key, param.value.toString())
    })

    const urlWithParams = `${url}?${params.toString()}`

    // console.log("SEND", commGraphToNodeLinkData(graph!))

    // Fetch a POST request with the parameters
    return fetch(urlWithParams, {
        method: 'POST',
        body: JSON.stringify(commGraphToNodeLinkData(graph)),
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then((data) => {
            console.log(data)

            // Print data as csv
            const keys = Array.from(Object.keys(data))
            const values = Array.from(Object.values(data))
            console.log(keys.join(','))
            console.log(values.join(','))

            const rankList: [string, number][] = Object.entries(data)

            graph?.setNodeScoringByList(rankList)
            // graph?.communities.setCommunitiesByList(data)
        })
}

////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////

function keyToName(key: string) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Returns appropriate icon for generator type
 */
function getGeneratorIcon(generator: Generator | null): string {
    if (!generator) return 'sym_o_hub';

    if (generator.isStoredDataset) {
        if (generator.isRealDataset) {
            return 'dataset';  // Real-world dataset icon
            return 'public';  // Real-world dataset icon
        } else if (generator.isSyntheticDataset) {
            return 'data_object';  // Synthetic dataset icon
        } else {
            return 'storage';  // Generic stored dataset
        }
    } else if (generator.isGenerator) {
        return 'auto_awesome';  // Generator icon
    }

    return 'sym_o_hub';  // Default icon
}

////////////////////////////////////////////////////////////////////////////
// Dataset Download
////////////////////////////////////////////////////////////////////////////

const showDatasetDialog = ref(false);
const datasetName = ref('');
const datasetDescription = ref('');

function downloadDataset() {
    graphStore.downloadDatasetAsJson(datasetName.value, datasetDescription.value);

    // Reset form fields
    datasetName.value = '';
    datasetDescription.value = '';

    // Close the dialog
    showDatasetDialog.value = false;
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
