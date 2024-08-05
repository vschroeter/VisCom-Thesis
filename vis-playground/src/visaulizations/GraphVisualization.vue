<template>
    <div @click="onClickDiv">
        <svg ref="refSVG" width="300" height="300" :viewBox="viewBox" xmlns="http://www.w3.org/2000/svg">
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
</template>

<script setup lang="ts">

import { computed, onMounted, onUpdated, reactive, ref, toValue, watch, type Ref } from 'vue'
import { Graph } from 'ngraph.graph';
import { useGraphStore } from 'src/stores/graph-store';

import * as d3 from 'd3'
import { Graph2d } from 'src/graph/graphical/Graph2d';
import { CommunicationGraph } from 'src/graph/commGraph';
import { FdgLayouterSettings } from 'src/graph/layouter/fdg/fdgSettings';
import { FdgLayouter } from 'src/graph/layouter/fdg/fdgLayouter';
import { AbstractNode2d } from 'src/graph/graphical';
// import { LayoutGraph, LayoutGraphLink, LayoutGraphNode } from 'src/graph/layoutGraph';
// import { FdgVisSettings } from './fdgSettings';

////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

// const props = withDefaults(defineProps<{
//     graph: Graph,
// }>(), {
// })

// const props = defineProps<{
//     settings: FdgVisSettings,
// }>()

////////////////////////////////////////////////////////////////////////////
// Stores
////////////////////////////////////////////////////////////////////////////

const graphStore = useGraphStore()
const commGraph = computed(() => graphStore.graph)

let graph2d: Graph2d | null = null
let layouter: FdgLayouter | null = null
let settings: FdgLayouterSettings | null = null

////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////

const refSVG = ref<SVGSVGElement | null>(null)
const refGRoot = ref<SVGGElement | null>(null)
const refGLinks = ref<SVGGElement | null>(null)
const refGNodes = ref<SVGGElement | null>(null)
const refGLabels = ref<SVGGElement | null>(null)

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


////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////

function ticked() {
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

////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

onMounted(() => {
    console.log("[VIS] Mounted"); //, props.settings);



})

onUpdated(() => {

})

function updateSimulation() {
    console.log("Update simulation");
}

function onClickDiv() {
    graphStore.currentSettings = settings ? settings : undefined;
    console.log(graphStore.currentSettings);
}

watch(commGraph, (newVal) => {
    //updateSimulation();
    console.log("[GViz] Graph updated", commGraph.value, commGraph.value instanceof CommunicationGraph);
    graph2d = new Graph2d(toValue(commGraph.value) as CommunicationGraph);
    settings = reactive(new FdgLayouterSettings()) as FdgLayouterSettings;
    layouter = new FdgLayouter(graph2d, settings);


    watch(settings, (newVal) => {
        console.log("New settings", newVal);
        layouter?.layout();

        // updateSimulation();
        // layouter?.updateSettings(newVal);
    }, { immediate: true, deep: true })

    console.log("Graph2d", graph2d);

    layouter.on('tick', ticked)
    layouter.layout();

}, { immediate: true, deep: true })

</script>

<style scoped></style>