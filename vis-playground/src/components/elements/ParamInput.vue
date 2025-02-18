<template>


    <!-- If the param is of type 'boolean', add a toggle  -->
    <q-toggle v-if="param.type == 'boolean'" v-model="param.textValue" size="sm" :label="param.label" :hint="param.description"/>

    <!-- If the param is of type 'color', add a color picker -->
    <q-input v-else-if="param.type == 'color'" v-model="param.textValue" :label="param.label" :hint="param.description">
        <template v-slot:append>
            <q-icon name="colorize" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-color v-model="param.textValue" :palette="palette" />
                </q-popup-proxy>
            </q-icon>
        </template>
        <template v-slot:prepend>
            <div
                :style="{ backgroundColor: param.textValue, width: '20px', height: '20px', borderRadius: '50%', border: '1px solid black' }">
            </div>
        </template>
    </q-input>


    <!-- If the param is of type 'choice', add a select input -->
    <q-select v-else-if="param.type == 'choice'" v-model="param.textValue" :label="param.label"
    :options="param.choices" />

    <!-- If the param is of type 'number', add a number input -->
    <q-input v-else-if="param.type == 'number'" v-model="param.textValue" type="number" :label="param.label" :hint="param.description"/>

    <!-- If the param is of type 'string', add a text input -->
    <q-input v-else v-model="param.textValue" :label="param.label" :hint="param.description"/>

</template>

<script setup lang="ts">

import { Param } from 'src/graph/layouter/settings/settings';
import { computed, onMounted, onUpdated, ref, toValue, type Ref } from 'vue'
import * as d3 from 'd3';

////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

// const props = defineProps()

const param = defineModel<Param>({ required: true });


////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////


const palette = computed(() => {
    const ranges = [
        d3.schemeCategory10,
        d3.schemeAccent
    ]
    return ranges.flat(1);
})

////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

onMounted(() => {

})

onUpdated(() => {

})

</script>

<style scoped></style>
