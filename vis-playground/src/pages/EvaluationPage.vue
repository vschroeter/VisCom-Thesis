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

    <div ref="refVisRootRow" class="row" @click="deselectSettings()">
      <div class="col">
        <div v-for="(mapping, layouterKey) in layouterMapping" :key="layouterKey" class="row q-ma-sm">
          <div class="col">
            <div class="row">
              <div class="text-h6">{{ mapping.label }}</div>
            </div>
            <div v-if="true" class="row q-mt-md">
              <div class="col-auto q-mx-xs q-my-sm"
                v-for="setting in settingsCollection.mapLayoutTypeToListOfSettings.get(layouterKey)"
                :key="setting.id">
                <GraphVisualization :settingId="setting.id" :size="commonSettings.tileSize.getValue()" :layoutType="layouterKey" />

              </div>

              <!-- At the end, add a large round + button to add a setting with this key  -->
              <div class="col-auto q-mx-md self-center">
                <q-btn
                  round outline
                  size="lg"
                  icon="add"
                  @click="settingsCollection.addSetting(layouterKey)" />
              </div>
            </div>
          </div>
        </div>

        <q-separator />
      </div>
    </div>

    <q-page-scroller position="bottom-right" :scroll-offset="150" :offset="[18, 18]">
      <q-btn fab icon="keyboard_arrow_up" color="secondary" />
    </q-page-scroller>

  </q-page>
</template>

<script setup lang="ts">
import { useGraphStore } from 'src/stores/graph-store';
import { onMounted } from 'vue';
import { watchDebounced } from '@vueuse/core'
import GraphVisualization from 'src/graph/visualizations/GraphVisualization.vue';
import { layouterMapping } from 'src/graph/layouter/settings/settingsCollection';

const store = useGraphStore();
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

</script>


<style scoped>
div {
  border: 0px solid black;
}
</style>