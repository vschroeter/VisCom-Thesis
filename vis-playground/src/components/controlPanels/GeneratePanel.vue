<template>
    <div>
        <!-- Everything below should be made out of Quasar Components -->

        <!-- Title -->
        <q-item-label
            header
            class="q-mb-md">
            Graph Generating
        </q-item-label>

        <!-- Expabsuib containing the connection settings -->
        <q-expansion-item
            v-model="showConnectionSettings"
            label="Connection Settings"
            icon="settings"
            dense>
            <q-input
                v-model="generatorApiUrl"
                label="Generator API URL"
                outlined
                class="q-mb-md" />
        </q-expansion-item>

        <!-- Divider -->
        <q-separator class="q-mb-md" />

        <!-- Dropdown to select the generator method -->
        <q-select
            v-model="selectedGenerator"
            :options="generators"
            :option-label="(generator: Generator) => genKeyToName(generator.key)"
            label="Select Generator"
            outlined
            @focus="fetchGenerateMethods"
            class="q-mb-md" />

        <!-- Description of the generator -->
        <q-item-label
            class="q-mb-md">
            {{ selectedGenerator?.description }}
        </q-item-label>

        <!-- Input for each parameter in the selected generator, depending on its type. -->
        <q-item
            v-for="(param, key) in selectedGenerator?.paramList"
            :key="key"
            class="q-mb-xs">
            <q-item-section>
                <q-item-label>
                    {{ param.description }}
                </q-item-label>
            </q-item-section>
            <q-item-section>
                <q-input
                    v-model="param.value"
                    :type="'number'"
                    :min="param.range.min"
                    :max="param.range.max"
                    :step="param.type == 'int' ? 1 : 0.01"
                    outlined />
            </q-item-section>
        </q-item>

        <!-- Button to generate the graph -->

        <q-btn
            :disable="selectedGenerator === null"   
            label="Generate"
            color="primary"
            @click="fetchGeneratedGraph(selectedGenerator?.key)" />

    </div>
</template>

<script setup lang="ts">

import { ApiGeneratorMethods, Generator, GeneratorMethods } from 'src/api/generatorApi';
import { parseGraphData } from 'src/api/graphDataApi';
import { computed, onMounted, onUpdated, reactive, ref, watch, type Ref } from 'vue'

////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

// const props = defineProps()

////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////

const showConnectionSettings = ref(false)
const generatorApiUrl = ref('http://127.0.0.1:5000')

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
// Helper functions
////////////////////////////////////////////////////////////////////////////

function genKeyToName(key: string) {
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
            console.log(data, graph)
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