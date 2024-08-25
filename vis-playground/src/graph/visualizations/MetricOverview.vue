<template>
    <div v-if="metricsResults">
        <!-- <q-spinner-box color="secondary" v-if="metricsResults.pending">

        </q-spinner-box> -->
        <div style="display: flex;">
            <div v-for="metric in metricResultList" :key="metric.metricKey">
                <div v-if="true" style="display: flex"
                    :style="{ width: `${sizePerMetric}px`, height: '10px', background: getBackground(metric), marginRight: `${xMargin}px`, border: `1px solid ${isSelected ? 'white' : 'black'}` }">

                    <FittingSvgText :text="metric.shortResult" :height="10" :width="sizePerMetric" :color="metric.textColor" v-if="!metric.pending" />

                    <!-- <svg :width="sizePerMetric" :height="10" style="position: relative; top: 0; left: 0;">
                        <text x="0" y="0" fill="black" alignment-baseline="hanging" text-anchor="right">
                            {{ metric.shortResult }}
                        </text>
                    </svg> -->
                </div>
                <q-tooltip>
                    {{ metric.metricKey }}: {{ metric.normalizedValue?.toFixed(2) }} ({{ metric.value.toFixed(2) }}) -
                    {{ metric.relativePlace + 1 }} / {{ metric.places }}
                </q-tooltip>
            </div>

        </div>
    </div>
</template>

<script setup lang="ts">

import { computed, onMounted, onUnmounted, onUpdated, Ref, ref } from 'vue'
import { useGraphStore } from 'src/stores/graph-store';

import { MetricResult, MetricsResults } from 'src/graph/metrics/collection'

import * as d3 from 'd3'
import FittingSvgText from './FittingSvgText.vue';
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


///++++ Sizing stuff ++++///

const xMargin = ref(2);

const sizePerMetric = computed(() => {
    return (props.width - xMargin.value * (metricResultList.value.length - 1)) / metricResultList.value.length;
})


///++++ Metric stuff ++++///
// const metrics = computed(() => {
//     return metricsCollection.getDisplayedMetrics(props.settingId) ?? new DisplayedMetrics(props.settingId);
// })

const metricsResults: Ref<MetricsResults | null> = ref(null);
const metricResultList: Ref<MetricResult[]> = ref([])

///++++ Setting stuff ++++//

const settings = computed(() => {
    return settingsCollection.getSettings(props.settingId)
})

const isSelected = computed(() => {
    return props.settingId === graphStore.activeSettingId
})

function getBackground(metric: MetricResult) {

    if (metric.pending) {
        // return 'gray'
        return 'repeating-linear-gradient(45deg, gray, gray 1px, white 2px, white 3px)';
    }

    const c = metric.color;

    if (metric.singleMetricResults.pending) {
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