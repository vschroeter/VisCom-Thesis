<template>
    <div style="display: flex;">
        <div v-for="metric in metrics" :key="metric.key">
            <div :style="{ width: '10px', height: '10px', backgroundColor: 'green', marginRight: '1px'}">
                <q-tooltip>
                    {{ metric.key }}: {{ metric.value?.toFixed(2) }}
                </q-tooltip>
            </div>

        </div>
    </div>
</template>

<script setup lang="ts">

import { computed, onMounted, onUpdated, ref, toValue, watch } from 'vue'
import { useGraphStore } from 'src/stores/graph-store';

import * as d3 from 'd3'
import { Graph2d } from 'src/graph/graphical/Graph2d';
import { CommunicationGraph } from 'src/graph/commGraph';
import { layouterMapping } from 'src/graph/layouter/settingsCollection';
import { GraphLayouter } from 'src/graph/layouter/layouter';
import { svgInteractiveRef } from './svgDirectives';
import { MetricsCollection } from 'src/graph/metrics/collection'


////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

const props = withDefaults(defineProps<{
    settingId: number,
    width: number,
    height: number,
}>(), {

})
////////////////////////////////////////////////////////////////////////////
// Stores
////////////////////////////////////////////////////////////////////////////

const graphStore = useGraphStore();
const settingsCollection = graphStore.settingsCollection;
const metricsCollection = graphStore.metricsCollection as MetricsCollection;

////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////

///++++ Metric stuff ++++///
const metrics = computed(() => {
    return metricsCollection.getDisplayedMetrics(props.settingId)
})

///++++ Setting stuff ++++//

const settings = computed(() => {
    return settingsCollection.getSettings(props.settingId)
})

const isSelected = computed(() => {
    return props.settingId === graphStore.activeSettingId
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

watch(metricsCollection, () => {
    console.log('metricsCollection changed')
}, { deep: true })

watch(metrics, () => {
    console.log('metrics changed', metrics.value)
}, { deep: true })

</script>

<style scoped></style>