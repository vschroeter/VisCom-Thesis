<template>
    <div @click="onClickDiv">
        <q-card :class="isSelected ? 'bg-primary text-white' : ''">
            <q-card-section class="row items-start">
                <div :class="'col q-mr-sm '"
                    :style="`inline-size: ${size - iconButtonDivWidth - 30}px; overflow-wrap: break-word;`">
                    {{ settings?.name }}
                </div>
                <div ref="refDivIconButtons" class="col-auto">
                    <!-- Button to rerender visualization -->
                    <q-btn size="sm" icon="refresh" flat round @click="resetSimulation" />
                    <q-btn size="sm" icon="delete" flat round @click="deleteItem" />
                </div>
                <!-- <div class="text-h6">Graph Visualization</div>
                <q-btn label="Reset" color="primary" size="x" flat @click="resetSimulation" /> -->
            </q-card-section>
            <q-separator inset />
            <q-card-section>

                <div class="svgContainerDiv">
                    <svg ref="refSVG" :width="size" :height="size" :viewBox="viewBox"
                        xmlns="http://www.w3.org/2000/svg">
                        <g ref="refGRoot">
                            <g ref="refGLinks">

                            </g>

                            <g ref="refGNodes">

                            </g>

                            <g ref="refGLabels">

                            </g>
                        </g>

                    </svg>
                </div>
            </q-card-section>
        </q-card>

    </div>
</template>

<script setup lang="ts">

import { computed, onMounted, onUpdated, ref, toValue, watch } from 'vue'
import { useGraphStore } from 'src/stores/graph-store';

import * as d3 from 'd3'
import { Graph2d } from 'src/graph/graphical/Graph2d';
import { CommunicationGraph } from 'src/graph/commGraph';
import { layouterMapping } from 'src/graph/layouter/settingsCollection';
import { GraphLayouter } from 'src/graph/layouter/layouter';


////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

const props = withDefaults(defineProps<{
    layoutType: string,
    settingId: number,
    size: number,
}>(), {
    size: 250
})

// const props = defineProps<{
//     settings: FdgVisSettings,
// }>()

////////////////////////////////////////////////////////////////////////////
// Stores
////////////////////////////////////////////////////////////////////////////

const graphStore = useGraphStore();
const settingsCollection = graphStore.settingsCollection;
const commGraph = computed(() => graphStore.graph);

let graph2d: Graph2d | null = null
let layouter: GraphLayouter<any> | null = null

////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////

const refSVG = ref<SVGSVGElement | null>(null)
const refGRoot = ref<SVGGElement | null>(null)
const refGLinks = ref<SVGGElement | null>(null)
const refGNodes = ref<SVGGElement | null>(null)
const refGLabels = ref<SVGGElement | null>(null)

const refDivIconButtons = ref<HTMLDivElement | null>(null)

////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////

const bBox = ref<DOMRect | null>(null)

const viewBox = computed(() => {
    if (bBox.value === null) {
        return "0 0 300 300"
    }
    return `${bBox.value.x} ${bBox.value.y} ${bBox.value.width} ${bBox.value.height}`
})


const iconButtonDivWidth = computed(() => {
    if (refDivIconButtons.value === null) {
        return 0
    }
    return refDivIconButtons.value.clientWidth
})

const settings = computed(() => {
    return settingsCollection.getSettings(props.settingId)
})

const isSelected = computed(() => {
    return props.settingId === graphStore.activeSettingId
})

////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////

function layoutUpdated() {
    // console.log("ticked")
    bBox.value = refGRoot.value?.getBBox() ?? null
    // console.log("Ticket in GViz", graph2d);

    if (!graph2d || !layouter) {
        return
    }

    d3.select(refGNodes.value)
        .call(layouter.updateNodes.bind(layouter))

    d3.select(refGLinks.value)
        .call(layouter.updateLinks.bind(layouter))

    d3.select(refGLabels.value)
        .call(layouter.updateLabels.bind(layouter))

    // console.log("BBox", bBox.value, refGRoot.value)
    // emit('updated')
}

function deleteItem() {
    settingsCollection.deleteSetting(props.settingId)
}
////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

onMounted(() => {
    console.log("[VIS] Mounted"); //, props.settings);
})

onUpdated(() => {

})

function resetSimulation() {
    console.log("Reset simulation");
    layouter?.reset();
}

function onClickDiv(event: MouseEvent) {
    graphStore.currentSettings = settings.value ? settings.value : undefined;
    graphStore.activeSettingId = props.settingId;
    console.log(graphStore.currentSettings);

    // Stop propagation
    event.stopPropagation();
}

watch(commGraph, (newVal) => {
    //updateSimulation();
    console.log("[GViz] Graph updated", commGraph.value, commGraph.value instanceof CommunicationGraph);
    if (!settings.value) {
        console.error("No settings found for ", props.settingId, settingsCollection);
        return
    }

    const cls = layouterMapping[props.layoutType].layouter;

    graph2d = new Graph2d(toValue(commGraph.value) as CommunicationGraph);
    layouter = new cls(graph2d, settings.value);

    watch(settings, (newVal) => {
        layouter?.layout(true);
    }, { immediate: true, deep: true })


    layouter.on('update', layoutUpdated)
    layouter.layout();

}, { immediate: true, deep: true })

</script>

<style scoped>
.svgContainerDiv {
    border: 1px solid #00000025;
    /* width: 100%;
    border: 1px solid #000; */
    border-radius: 5px;
    background-color: white;
    /* padding: 5px; */
    /* margin: 5px; */
}

/* .activeCard {
    background-color: #00000010;
} */
</style>