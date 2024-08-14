<template>
    <div style="display: flex;" v-if="metricsResults">
        <div v-for="metric in metricResultList" :key="metric.metricKey">
            <!-- <q-spinner-box color="primary" v-if="metric.isUpdating">

            </q-spinner-box> -->
            <div v-if="true"
                :style="{ width: '10px', height: '10px', backgroundColor: 'green', marginRight: '1px' }">
                <q-tooltip>
                    {{ metric.metricKey }}: {{ metric.normalizedValue?.toFixed(2) }} ({{ metric.value.toFixed(2) }})
                </q-tooltip>
            </div>
            <!-- {{ metric.isUpdating }} -->
        </div>
    </div>
</template>

<script setup lang="ts">

import { computed, onMounted, onUnmounted, onUpdated, reactive, Ref, ref, toValue, watch } from 'vue'
import { useGraphStore } from 'src/stores/graph-store';

import * as d3 from 'd3'
import { Graph2d } from 'src/graph/graphical/Graph2d';
import { CommunicationGraph } from 'src/graph/commGraph';
import { layouterMapping } from 'src/graph/layouter/settingsCollection';
import { GraphLayouter } from 'src/graph/layouter/layouter';
import { svgInteractiveRef } from './svgDirectives';
import { MetricResult, MetricsCollection, MetricsResults } from 'src/graph/metrics/collection'


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
const metricsCollection = graphStore.metricsCollection;

////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////

///++++ Metric stuff ++++///
// const metrics = computed(() => {
//     return metricsCollection.getDisplayedMetrics(props.settingId) ?? new DisplayedMetrics(props.settingId);
// })
let metricsRef: Ref<null> = ref(null);
// let metrics: DisplayedMetrics | null = null;

const metricsResults: Ref<MetricsResults | null> = ref(null);
const metricResultList: Ref<MetricResult[]> = ref([])

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

    metricsResults.value = metricsCollection.getMetricsResults(props.settingId)
    metricsResults.value.emitter.on("newMetrics", () => {
        metricResultList.value = metricsResults.value!.results;
        console.log('new metrics', props.settingId, metricResultList.value)
    })

    metricsResults.value.emitter.on("metricsUpdated", () => {
        console.log('updated relative metrics', props.settingId)
        metricResultList.value = metricsResults.value!.results;
    })
})

onUnmounted(() => {
    // metricsCollection.off("update", updateMetrics)
})

onUpdated(() => {

})

// watch(metrics, () => {
//     console.log('metrics changed', metrics.value)
// }, { deep: true })

</script>

<style scoped></style>