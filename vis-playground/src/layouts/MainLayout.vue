<template>
    <q-layout view="hHh LpR fFf">
        <q-header elevated>
            <q-toolbar>
                <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

                <q-toolbar-title>
                    Communication Graph Visualizations
                </q-toolbar-title>

                <!-- <div>Quasar v{{ $q.version }}</div> -->

                <q-space />

                <!-- Metrics download button -->
                <q-btn flat dense round icon="analytics" aria-label="Download Metrics" @click="openMetricsDownloadModal"
                    :disable="!areAllMetricsCalculated">
                    <q-tooltip>Download Metrics Results</q-tooltip>
                </q-btn>

                <!-- Settings file handling -->
                <q-file v-model="settingsFile" label="Upload Settings" style="min-width: 150px" dense outlined
                    accept=".json" @update:model-value="handleSettingsFileUpload">
                    <template v-slot:append>
                        <q-btn round flat dense icon="download" @click.stop="openSettingsDownloadModal" color="white">
                            <q-tooltip>Download Settings</q-tooltip>
                        </q-btn>
                    </template>
                </q-file>

                <q-btn flat dense round icon="settings" aria-label="Settings" @click="toggleRightDrawer" />

            </q-toolbar>
        </q-header>

        <q-drawer v-model="leftDrawerOpen" show-if-above bordered :width="leftDrawerWidth" side="left">
            <ApiPanel></ApiPanel>
            <div v-touch-pan.preserveCursor.prevent.mouse.horizontal="resizeLeftDrawer" class="q-drawer__resizerl">
            </div>
        </q-drawer>


        <!-- Drawer for the right side -->
        <q-drawer show-if-above v-model="rightDrawerOpen" side="right" bordered :width="rightDrawerWidth">
            <SettingPanel></SettingPanel>
            <div v-touch-pan.preserveCursor.prevent.mouse.horizontal="resizeRightDrawer" class="q-drawer__resizerr">
            </div>

        </q-drawer>

        <q-page-container>
            <router-view />
        </q-page-container>

        <!-- Dataset download dialog -->
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

        <!-- Settings download dialog -->
        <q-dialog v-model="showSettingsDownloadModal" persistent>
            <q-card style="min-width: 350px">
                <q-card-section>
                    <div class="text-h6">Download Settings</div>
                </q-card-section>

                <q-card-section class="q-pt-none">
                    <q-input dense v-model="settingsTitle" label="Title" autofocus @keyup.enter="downloadSettings" />
                </q-card-section>

                <q-card-actions align="right">
                    <q-btn flat label="Cancel" color="primary" v-close-popup />
                    <q-btn flat label="Download" color="primary" @click="downloadSettings" v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>

        <!-- Metrics download dialog -->
        <q-dialog v-model="showMetricsDownloadModal" persistent>
            <q-card style="min-width: 350px">
                <q-card-section>
                    <div class="text-h6">Download Metrics Results</div>
                </q-card-section>

                <q-card-section class="q-pt-none">
                    <q-input dense v-model="metricsTitle" label="Title" autofocus @keyup.enter="downloadMetrics" />
                    <q-input dense v-model="metricsDescription" label="Description" type="textarea" class="q-mt-md"
                        @keyup.enter="downloadMetrics" />
                </q-card-section>

                <q-card-actions align="right">
                    <q-btn flat label="Cancel" color="primary" v-close-popup />
                    <q-btn flat label="Download" color="primary" @click="downloadMetrics" v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import EssentialLink, { EssentialLinkProps } from 'components/EssentialLink.vue';
import ApiPanel from 'src/components/controlPanels/ApiPanel.vue';
import SettingPanel from 'src/components/controlPanels/SettingPanel.vue';
import { useStorage } from '@vueuse/core';
import { useGraphStore } from 'src/stores/graph-store';
import { Notify } from 'quasar';
import { CommonSettings } from 'src/graph/layouter/settings/commonSettings';

defineOptions({
    name: 'MainLayout'
});

const graphStore = useGraphStore();
const rightDrawerWidth = useStorage("rightDrawerWidth", 400);
const rightDrawerOpen = useStorage("rightDrawerOpen", false);

const leftDrawerOpen = useStorage("leftDrawerOpen", true);
const leftDrawerWidth = useStorage("leftDrawerWidth", 400);

const commonSettings = computed(() => graphStore.settingsCollection.commonSettings as CommonSettings)

const settingsFile = ref<File | null>(null);
const showDatasetDialog = ref(false);
const datasetName = ref('');
const datasetDescription = ref('');

// Settings download modal
const showSettingsDownloadModal = ref(false);
const settingsTitle = ref('');

// Metrics download modal
const showMetricsDownloadModal = ref(false);
const metricsTitle = ref('');
const metricsDescription = ref('');

// Check if all metrics have been calculated
const areAllMetricsCalculated = computed(() => {
    return graphStore.areAllMetricsCalculated();
});

// For metrics notification
const previousMetricsStatus = ref(false);

// Watch for metrics calculation completion
watch(() => areAllMetricsCalculated.value, (newValue, oldValue) => {
    // Only proceed if metrics have just been completed (changed from false to true)
    if (newValue && !previousMetricsStatus.value) {
        const settings = commonSettings.value;

        // Check if notifications are enabled
        if (settings.notifyWhenFinished.value) {
            // Check if window is focused
            const isWindowFocused = document.hasFocus();

            // Show notification
            Notify.create({
                message: 'Metrics calculation completed',
                color: 'positive',
                icon: 'analytics',
                position: 'bottom',
                timeout: 5000
            });

            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }

            if (Notification && !isWindowFocused) {
                console.log('Notification permission:', Notification.permission);
                if (Notification.permission === "granted") {
                    console.log('Creating notification');
                    new Notification('Metrics Calculation Complete', {
                        body: 'All metrics have been calculated successfully.',
                        icon: '/icons/favicon-128x128.png'
                    });
                } else if (Notification.permission !== "denied") {
                    Notification.requestPermission().then(permission => {
                        if (permission === "granted") {
                            new Notification('Metrics Calculation Complete', {
                                body: 'All metrics have been calculated successfully.',
                                icon: '/icons/favicon-128x128.png'
                            });
                        }
                    });
                }
            } else {
                console.warn('Browser does not support notifications');
            }

        }
    }

    // Update previous status
    previousMetricsStatus.value = newValue;
});

// Function to play notification sound
function playNotificationSound() {
    try {
        const audio = new Audio('/notification-sound.mp3');
        audio.play();
    } catch (error) {
        console.error('Failed to play notification sound:', error);
    }
}

function toggleLeftDrawer() {
    leftDrawerOpen.value = !leftDrawerOpen.value;
}

function toggleRightDrawer() {
    rightDrawerOpen.value = !rightDrawerOpen.value;
}

let initRightDrawerWidth = 200;
function resizeRightDrawer(ev: any) {
    if (ev.isFirst === true) {
        initRightDrawerWidth = rightDrawerWidth.value;
    }
    rightDrawerWidth.value = initRightDrawerWidth - ev.offset.x;
}

let initLeftDrawerWidth = 200;
function resizeLeftDrawer(ev: any) {
    if (ev.isFirst === true) {
        initLeftDrawerWidth = leftDrawerWidth.value;
    }
    leftDrawerWidth.value = initLeftDrawerWidth + ev.offset.x;
}

function openSettingsDownloadModal() {
    settingsTitle.value = '';
    showSettingsDownloadModal.value = true;
}

function downloadSettings() {
    graphStore.downloadSettingsAsJson(settingsTitle.value);
    showSettingsDownloadModal.value = false;
}

function handleSettingsFileUpload(file: File | null) {
    if (file) {
        graphStore.uploadSettingsFromJson(file)
            .then(() => {
                Notify.create({
                    message: 'Settings loaded successfully',
                    color: 'positive'
                });
                // Reset the file input
                settingsFile.value = null;
            })
            .catch(error => {
                console.error('Error loading settings:', error);
                Notify.create({
                    message: 'Error loading settings file',
                    color: 'negative'
                });
                settingsFile.value = null;
            });
    }
}

function downloadDataset() {
    graphStore.downloadDatasetAsJson(datasetName.value, datasetDescription.value);

    // Reset form fields
    datasetName.value = '';
    datasetDescription.value = '';
}

function openMetricsDownloadModal() {
    metricsTitle.value = '';
    metricsDescription.value = '';
    showMetricsDownloadModal.value = true;
}

function downloadMetrics() {
    graphStore.downloadMetricsAsJson(metricsTitle.value, metricsDescription.value);
    showMetricsDownloadModal.value = false;
}
</script>


<style>
.q-drawer__resizerl {
    position: absolute;
    top: 0;
    bottom: 0;
    right: -4px;
    width: 8px;
    background-color: transparent;
    cursor: ew-resize;
}

.q-drawer__resizerr {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -4px;
    width: 8px;
    background-color: transparent;
    cursor: ew-resize;
}
</style>
