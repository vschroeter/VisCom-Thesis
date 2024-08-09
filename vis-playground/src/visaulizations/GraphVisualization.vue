<template>
    <div @click="onClickDiv">
        <!-- :class="(isSelected ? 'bg-primary text-white' : '') + ('full-modal': isZoomed)"> -->
        <q-card
            :class="{ 'bg-primary': isSelected, 'text-white': isSelected, 'full-modal': isZoomed, 'card': true }">
            <q-card-section class="row items-start q-py-xs items-center">
                <div :class="'col q-mr-sm '"
                    :style="`inline-size: ${size - iconButtonDivWidth - 30}px; overflow-wrap: break-word;`">
                    {{ settings?.name }}
                </div>
                <div ref="refDivIconButtons" class="col-auto">
                    <q-btn size="sm" flat round icon="zoom_out_map" @click="toggleZoom" />
                    <q-btn size="sm" icon="refresh" flat round @click="resetSimulation" />
                    <q-btn v-if="!isZoomed" size="sm" icon="delete" flat round @click="deleteItem" />
                </div>
                <!-- <div class="text-h6">Graph Visualization</div>
                <q-btn label="Reset" color="primary" size="x" flat @click="resetSimulation" /> -->
            </q-card-section>
            <q-separator inset />
            <q-card-section>

                <div class="svgContainerDiv">
                    <svg ref="refSVG" :width="svgWidth" :height="svgHeight" :viewBox="viewBox"
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


const svgWidth = computed(() => {
    return !isZoomed.value ? props.size : "90vw"
})

const svgHeight = computed(() => {
    return !isZoomed.value ? props.size : "90vh"
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
    console.log("[GViz] Layout updated", layouter, graph2d);

    if (!graph2d || !layouter) {
        return
    }

    console.log("Updating nodes and links");
    d3.select(refGNodes.value)
        .call(layouter.updateNodes.bind(layouter))

    d3.select(refGLinks.value)
        .call(layouter.updateLinks.bind(layouter))

    d3.select(refGLabels.value)
        .call(layouter.updateLabels.bind(layouter))

    // console.log("BBox", bBox.value, refGRoot.value)
    bBox.value = refGRoot.value?.getBBox() ?? null

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
        }, { immediate: false, deep: true })


        layouter.on('update', layoutUpdated)
        layouter.on('end', layoutUpdated)
        layouter.layout();



    }, { immediate: true, deep: true })

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


const isZoomed = ref(false);

const toggleZoom = () => {
    isZoomed.value = !isZoomed.value;
};

const cardStyle = computed(() => {
    return isZoomed.value
        ? {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
        }
        : {};
});

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

.card {
}

.full-modal {
    /* transition: all 0.3s ease; */

    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    /* top: 3vw;
    left: 3vw;
    width: 90vw;
    height: 90vh; */
    z-index: 9999;
    background-color: rgba(0, 0, 0, 0.5);
    box-shadow: 0 0 10px 5px rgba(0, 0, 0, 0.5);
}
</style>