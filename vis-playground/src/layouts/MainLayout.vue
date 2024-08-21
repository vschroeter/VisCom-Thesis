<template>
  <q-layout view="hHh LpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>
          Communication Graph Evaluator
        </q-toolbar-title>

        <div>Quasar v{{ $q.version }}</div>

        <q-space />
        <q-btn flat dense round icon="settings" aria-label="Settings" @click="toggleRightDrawer" />

      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered :width="leftDrawerWidth" side="left">
      <GeneratePanel></GeneratePanel>
      <div v-touch-pan.preserveCursor.prevent.mouse.horizontal="resizeLeftDrawer" class="q-drawer__resizerl"></div>
    </q-drawer>


    <!-- Drawer for the right side -->
    <q-drawer show-if-above v-model="rightDrawerOpen" side="right" bordered :width="rightDrawerWidth">
      <SettingPanel></SettingPanel>
      <div v-touch-pan.preserveCursor.prevent.mouse.horizontal="resizeRightDrawer" class="q-drawer__resizerr"></div>

    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>



  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import EssentialLink, { EssentialLinkProps } from 'components/EssentialLink.vue';
import GeneratePanel from 'src/components/controlPanels/GeneratePanel.vue';
import SettingPanel from 'src/components/controlPanels/SettingPanel.vue';
import { useStorage } from '@vueuse/core';

defineOptions({
  name: 'MainLayout'
});


const rightDrawerWidth = useStorage("rightDrawerWidth", 400)
const rightDrawerOpen = useStorage("rightDrawerOpen", false)

const leftDrawerOpen = useStorage("leftDrawerOpen", true)
const leftDrawerWidth = useStorage("leftDrawerWidth", 400)


function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value;
}

let initRightDrawerWidth = 200
function resizeRightDrawer(ev: any) {
  if (ev.isFirst === true) {
    initRightDrawerWidth = rightDrawerWidth.value
  }
  rightDrawerWidth.value = initRightDrawerWidth - ev.offset.x
}

let initLeftDrawerWidth = 200
function resizeLeftDrawer(ev: any) {
  if (ev.isFirst === true) {
    initLeftDrawerWidth = leftDrawerWidth.value
  }
  leftDrawerWidth.value = initLeftDrawerWidth + ev.offset.x
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