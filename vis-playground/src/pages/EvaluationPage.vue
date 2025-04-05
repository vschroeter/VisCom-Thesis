<template>
    <!-- class="row items-center justify-evenly" -->
    <q-page>


        <!-- style="height: 100px;" -->
        <div v-if="false" class="row">
            <div class="col">
                <div>
                    <div class="row">
                        <div class="text-h6">Row Header</div>
                    </div>
                    <div class="row">
                        <div class="col-auto">Col 1</div>
                        <div class="col-auto">Col 2</div>
                        <div class="col-auto">Col 3</div>
                        <div class="col-auto">Col 4</div>

                    </div>
                </div>
            </div>
            <div>

            </div>
        </div>

        <div ref="refVisRootRow" class="row q-mb-xl" @click="deselectSettings()">
            <div class="col">
                <div v-for="(mapping, layouterKey) in layouterMapping" :key="layouterKey" class="row q-ma-sm">
                    <div class="col">
                        <div class="row">
                            <div v-if="!settingsCollection.mapLayoutTypeToListOfSettings.get(layouterKey)?.length"
                                class="q-mr-md">
                                <q-btn round outline size="sm" icon="add"
                                    @click="settingsCollection.addSetting(layouterKey)" />
                            </div>
                            <div class="text-h6">{{ mapping.label }}</div>
                            <div v-if="settingsCollection.mapLayoutTypeToListOfSettings.get(layouterKey)?.length"
                                class="q-ml-md">
                                <q-btn round outline size="sm" color="negative" icon="delete"
                                    @click="deleteAllSettingsOfType(layouterKey)">
                                    <q-tooltip>Delete all {{ mapping.label }}</q-tooltip>
                                </q-btn>
                            </div>
                        </div>
                        <div v-if="settingsCollection.mapLayoutTypeToListOfSettings.get(layouterKey)?.length"
                            class="row q-mt-md">
                            <div class="col-auto q-mx-xs q-my-sm"
                                v-for="setting in settingsCollection.mapLayoutTypeToListOfSettings.get(layouterKey)"
                                :key="setting.id">
                                <GraphVisualization :settingId="setting.id"
                                    :size="commonSettings.tileSize.getValue() ?? 100" :layoutType="layouterKey" />

                            </div>

                            <!-- At the end, add a large round + button to add a setting with this key  -->
                            <div v-if="settingsCollection.mapLayoutTypeToListOfSettings.get(layouterKey)?.length"
                                class="col-auto q-mx-md self-center">
                                <q-btn round outline size="lg" icon="add"
                                    @click="settingsCollection.addSetting(layouterKey)" />
                            </div>
                        </div>
                        <hr v-if="settingsCollection.mapLayoutTypeToListOfSettings.get(layouterKey)?.length" />
                    </div>
                </div>

                <q-separator />
            </div>
        </div>

        <!-- Progress bar for metrics calculation -->
        <!-- <div v-if="hasPendingMetrics" class="metrics-progress-container q-pa-md">
            <q-banner dense class="text-white bg-primary">
                <div class="row items-center">
                    <div class="col">Calculating metrics: {{ completedMetricsCount }} / {{ totalMetricsCount }}</div>
                    <div class="col-auto">
                        <q-btn flat dense label="Hide" @click="dismissProgressBar" />
                    </div>
                </div>
            </q-banner>
        </div> -->

        <q-linear-progress v-if="hasPendingMetrics" class="metrics-progress-container q-pa-md" size="10px"
            :value="metricsProgress" :buffer="bufferProgress" color="secondary" animation-speed="300">
            <div class="absolute-full flex flex-center">
                <q-badge color="white" text-color="accent"
                    :label="`Calculated Metrics: ${completedMetricsCount} / ${totalMetricsCount}`" class="q-mx-xs" />
            </div>
        </q-linear-progress>

        <!-- <q-linear-progress class="metrics-progress-container" :value="metricsProgress" size="10px" color="primary" /> -->

        <q-page-scroller position="bottom-right" :scroll-offset="150" :offset="[18, 18]">
            <q-btn fab icon="keyboard_arrow_up" color="secondary" />
        </q-page-scroller>

    </q-page>
</template>

<script setup lang="ts">
import { useGraphStore } from 'src/stores/graph-store';
import { onMounted, computed, ref, watch } from 'vue';
import { watchDebounced } from '@vueuse/core'
import GraphVisualization from 'src/graph/visualizations/GraphVisualization.vue';
import { layouterMapping } from 'src/graph/layouter/settings/settingsCollection';
import { useApiStore } from 'src/stores/api-store';

const store = useGraphStore();
const apiStore = useApiStore();
const settingsCollection = store.settingsCollection;
const metricsCollection = store.metricsCollection;

const commonSettings = settingsCollection.commonSettings;

onMounted(() => {
    if (store.settingsCollection) {

        store.settingsCollection.emitter.on("newSettings", (ids) => {
            console.log('newSettings', ids);
            metricsCollection.cleanSettings(ids.currentIds);
        })

        store.settingsCollection.loadFromJson(JSON.parse(store.layouterSettingsCollectionJson))
        console.log('store.settingsCollection loaded', store.layouterSettingsCollectionJson);
        // console.log(store.settingsCollection)
        // console.log(store.settingsCollection.getJson())
    }
})

watchDebounced(store.settingsCollection, () => {
    console.log('store.settingsCollection saved');
    store.layouterSettingsCollectionJson = JSON.stringify(store.settingsCollection.getJson())
}, { deep: true, debounce: 2000, maxWait: 15000 })

function deselectSettings() {
    store.activeSettingId = -1;
    store.currentSettings = undefined;
}

function deleteAllSettingsOfType(layouterType: string) {
    const settingsOfType = settingsCollection.mapLayoutTypeToListOfSettings.get(layouterType) || [];
    const settingIds = settingsOfType.map(setting => setting.id);

    if (confirm(`Are you sure you want to delete all ${settingsOfType.length} ${layouterType} visualizations?`)) {
        // Delete settings in reverse order to avoid index issues
        [...settingIds].reverse().forEach(id => {
            settingsCollection.deleteSetting(id);
        });
    }
}

// Metrics progress tracking
const showProgressBar = ref(true);
const hasPendingMetrics = computed(() => {
    if (!showProgressBar.value) return false;

    const settingsIds = Array.from(settingsCollection.mapIdToSettings.keys());
    if (settingsIds.length === 0) return false;

    return settingsIds.some(id => {
        const metricsResults = metricsCollection.getMetricsResults(id);
        return metricsResults.pending;
    });
});

const allMetricResults = computed(() => {
    const settingsIds = Array.from(settingsCollection.mapIdToSettings.keys());
    return settingsIds.map(id => metricsCollection.getMetricsResults(id));
});

const completedMetricsCount = computed(() => {
    let total = 0;
    allMetricResults.value.forEach((metricResults) => {
        total += metricResults.results.filter(result => !result.pending).length;
    });
    return total;
});

const totalMetricsCount = computed(() => {
    let total = 0;
    allMetricResults.value.forEach((metricResults) => {
        total += metricResults.results.length;
    });
    return total;
});

const currentApiRequests = computed(() => {
    return apiStore.activeApiCalls;
});

const metricsProgress = computed(() => {
    if (totalMetricsCount.value === 0) return 0;
    return completedMetricsCount.value / totalMetricsCount.value;
});

const _currentBufferProgress = computed(() => {
    if (totalMetricsCount.value === 0) return 0;
    return (completedMetricsCount.value + currentApiRequests.value) / totalMetricsCount.value;
});

let bufferUpdate: NodeJS.Timeout | null = null;
const bufferProgress = ref(0);

watch([_currentBufferProgress], () => {

    if (bufferUpdate) {
        clearTimeout(bufferUpdate);
    }

    if (_currentBufferProgress.value > bufferProgress.value) {
        bufferProgress.value = _currentBufferProgress.value;
        return;
    } else {
        bufferUpdate = setTimeout(() => {
            bufferProgress.value = _currentBufferProgress.value;
        }, 100);
    }
}, { immediate: true });

function dismissProgressBar() {
    showProgressBar.value = false;
}
</script>


<style scoped>
div {
    border: 0px solid black;
}

.metrics-progress-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 5000;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}
</style>
