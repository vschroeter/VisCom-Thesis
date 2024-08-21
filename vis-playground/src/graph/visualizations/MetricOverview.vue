<template>
    <div v-if="metricsResults">
        <q-spinner-box color="secondary" v-if="metricsResults.pending">

        </q-spinner-box>
        <!--  -->
        <div v-else style="display: flex;">
            <div v-for="metric in metricResultList" :key="metric.metricKey">
                <div v-if="true"
                    :style="{ width: '10px', height: '10px', background: getBackground(metric), marginRight: '1px', border: '1px solid black' }">
                </div>
                <q-tooltip>
                    {{ metric.metricKey }}: {{ metric.normalizedValue?.toFixed(2) }} ({{ metric.value.toFixed(2) }}) -
                    {{ metric.relativePlace + 1 }} / {{ metric.places }}
                </q-tooltip>
                <!-- {{ metric.isUpdating }} -->
            </div>

        </div>
    </div>
</template>

<script setup lang="ts">

import { computed, onMounted, onUnmounted, onUpdated, Ref, ref } from 'vue'
import { useGraphStore } from 'src/stores/graph-store';

import { MetricResult, MetricsResults } from 'src/graph/metrics/collection'

import * as d3 from 'd3'
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

const stillUpdating = computed(() => {
    if (!metricsResults.value) {
        return false
    }

    return metricsCollection.allMetricsResults.some((m) => {
        return m.pending
    })
})


function getBackground(metric: MetricResult) {
    const c = metric.color;
    if (stillUpdating.value) {
        // Return hatch pattern
        return `repeating-linear-gradient(45deg, ${c}, ${c} 2px, white 2px, white 3px)`;
    }
    return metric.color;
}

////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

function updateMetrics() {
    metricResultList.value = metricsResults.value!.results;
    metricsResults.value = metricsCollection.getMetricsResults(props.settingId)
    // console.log('update metrics', props.settingId, metricsResults.value.pending)
}

function initMetrics() {
    metricsResults.value = metricsCollection.getMetricsResults(props.settingId)
    metricsResults.value.emitter.on("newMetrics", updateMetrics)
    metricsResults.value.emitter.on("metricsUpdated", updateMetrics)
    updateMetrics()
}

onMounted(() => {
    initMetrics()
})

onUnmounted(() => {
    // metricsCollection.off("update", updateMetrics)
})

onUpdated(() => {
    if (!metricsResults.value) {
        initMetrics()
    }
})

// watch(metrics, () => {
//     console.log('metrics changed', metrics.value)
// }, { deep: true })

</script>

<style scoped></style>