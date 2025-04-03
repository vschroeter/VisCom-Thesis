<template>
    <div v-if="metricsResults">
        <!-- <q-spinner-box color="secondary" v-if="metricsResults.pending">

        </q-spinner-box> -->
        <div style="display: flex;">
            <div v-for="metric in metricResultList" :key="metric.metricKey">
                <div v-if="true" style="display: flex"
                    :style="{ width: `${sizePerMetric}px`, height: '10px', background: getBackground(metric), marginRight: `${xMargin}px`, border: `1px solid ${isSelected ? 'white' : 'black'}` }">

                    <FittingSvgText
                        :text="metric.shortResult"
                        :height="10"
                        :width="sizePerMetric"
                        :color="metric.textColor"
                        v-if="!metric.pending && !metric.error" />

                    <FittingSvgText
                        text="ERR"
                        :height="10"
                        :width="sizePerMetric"
                        color="white"
                        v-if="!metric.pending && metric.error" />
                </div>
                <q-tooltip>
                    <div>
                        <div>{{ metric.definition.label || metric.metricKey }}</div>
                        <div v-if="!metric.error">
                            Value: {{ !isNaN(metric.value) ? metric.value.toFixed(4) : 'N/A' }}<br>
                            Normalized: {{ !isNaN(metric.normalizedValue) ? metric.normalizedValue.toFixed(4) : 'N/A' }}<br>
                            Rank: {{ metric.relativePlace + 1 }} / {{ metric.places }}
                        </div>
                        <div v-else class="text-negative">
                            Error: {{ metric.error }}
                        </div>
                    </div>
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
        return 'repeating-linear-gradient(45deg, gray, gray 1px, white 2px, white 3px)';
    }

    if (metric.error) {
        return 'repeating-linear-gradient(45deg, #f44336, #f44336 2px, #b71c1c 2px, #b71c1c 4px)';
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
