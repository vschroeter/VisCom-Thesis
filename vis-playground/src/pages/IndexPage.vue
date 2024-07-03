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

    <div class="row">
      <div class="col">
        <div v-for="row in rows" :key="row.name">
          <div class="row">
            <div class="text-h6">{{ row.name }}</div>
          </div>
          <div class="row">
            <q-card v-for="(item, idx) in row.visComponents" :key="idx" class="q-mb-md"
              @click="store.currentSettings = item.settings">
              <q-card-section>
                <div class="card-title">{{ item.name }}</div>
                <component :is="item.component" v-bind="item.props" />
              </q-card-section>
            </q-card>

          </div>

          <!-- <div v-for="visComponent in row.visComponents" :key="visComponent.name">
                  <h6>{{ visComponent.name }}</h6>
                  <component :is="visComponent.component" />
                  </div> -->
        </div>

        <q-separator />
      </div>
      <div>

      </div>
    </div>





    <!-- <FDG>

    </FDG> -->
  </q-page>
</template>

<script setup lang="ts">
import FDG from 'src/components/visaulizations/FDG.vue';
import { useGraphStore } from 'src/stores/graph-store';
import { FdgVisSettings } from 'src/visaulizations/FDG/fdgSettings';
import { VisualizationSettings } from 'src/visaulizations/visualizationSettings';
import { defineAsyncComponent, markRaw, ref, watch } from 'vue';


const store = useGraphStore()



type VueComponent = any

// Extending vue component
class VisComponent<T = VueComponent> {
  name: string
  settings: VisualizationSettings<any>
  component: T

  constructor(name: string, component: T, settings: VisualizationSettings<any>) {
    this.name = name
    this.settings = settings
    this.component = component
  }

  get props() {
    return {
      settings: this.settings
    }
  }
}

class VisRow {
  name: string
  visComponents: VisComponent[]

  constructor(name: string, visComponents: VisComponent[]) {
    this.name = name
    this.visComponents = visComponents

  }
}

const rows = ref<VisRow[]>([
  new VisRow("Force Directed Graphs", [
    // new VisComponent("FDG", FDG, new VisSettings())
    new VisComponent("FDG", markRaw(defineAsyncComponent(() => import('src/visaulizations/FDG/FDG.vue'))), new FdgVisSettings())
  ])
])



</script>


<style scoped>
div {
  border: 0px solid black;
}
</style>