<template>
    <q-layout view="hHh LpR fFf">
        <q-header elevated>
            <q-toolbar>
                <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

                <q-toolbar-title>
                    Communication Graph Evaluator
                </q-toolbar-title>

                <!-- Add settings download/upload buttons -->
                <q-btn flat dense icon="download" aria-label="Download Settings" @click="downloadSettings">
                    <q-tooltip>Download Settings</q-tooltip>
                </q-btn>
                <q-btn flat dense icon="upload" aria-label="Upload Settings">
                    <q-tooltip>Upload Settings</q-tooltip>
                    <input type="file" accept=".json" ref="settingsFileInput" style="display: none;"
                        @change="handleSettingsFileUpload" />
                </q-btn>
                <q-btn flat dense icon="save_alt" aria-label="Download Dataset" @click="showDatasetDialog = true">
                    <q-tooltip>Download Dataset</q-tooltip>
                </q-btn>

                <div>Quasar v{{ $q.version }}</div>

                <q-space />
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
                        class="q-mb-md" />
                    <q-input dense v-model="datasetDescription" label="Description" type="textarea"
                        :rules="[val => !!val || 'Description is required']" />
                </q-card-section>

                <q-card-actions align="right">
                    <q-btn flat label="Cancel" color="primary" v-close-popup />
                    <q-btn flat label="Download" color="primary" @click="downloadDataset" :disable="!datasetName"
                        v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import EssentialLink, { EssentialLinkProps } from 'components/EssentialLink.vue';
import ApiPanel from 'src/components/controlPanels/ApiPanel.vue';
import SettingPanel from 'src/components/controlPanels/SettingPanel.vue';
import { useStorage } from '@vueuse/core';
import { useGraphStore } from 'src/stores/graph-store';
import { Notify } from 'quasar';

defineOptions({
    name: 'MainLayout'
});

const graphStore = useGraphStore();
const rightDrawerWidth = useStorage("rightDrawerWidth", 400);
const rightDrawerOpen = useStorage("rightDrawerOpen", false);

const leftDrawerOpen = useStorage("leftDrawerOpen", true);
const leftDrawerWidth = useStorage("leftDrawerWidth", 400);

const settingsFileInput = ref<HTMLInputElement | null>(null);
const showDatasetDialog = ref(false);
const datasetName = ref('');
const datasetDescription = ref('');

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

function downloadSettings() {
    graphStore.downloadSettingsAsJson();
}

function handleSettingsFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
        const file = input.files[0];
        graphStore.uploadSettingsFromJson(file)
            .then(() => {
                Notify.create({
                    message: 'Settings loaded successfully',
                    color: 'positive'
                });
            })
            .catch(error => {
                console.error('Error loading settings:', error);
                Notify.create({
                    message: 'Error loading settings file',
                    color: 'negative'
                });
            });

        // Reset input to allow selecting the same file again
        if (input) {
            input.value = '';
        }
    }
}

function downloadDataset() {
    graphStore.downloadDatasetAsJson(datasetName.value, datasetDescription.value);

    // Reset form fields
    datasetName.value = '';
    datasetDescription.value = '';
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
