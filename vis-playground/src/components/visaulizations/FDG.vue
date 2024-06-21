<template>
    <div>
        <svg ref="refSVG" width="300" height="300" :viewBox="viewBox" xmlns="http://www.w3.org/2000/svg">
            <g ref="refGRoot">

                <g v-if="data.layout?.links">
                    <line v-for="(link, i) in data.layout.links"
                        :key="i.toString() + ':' + link.source.id + '->' + link.target.id"
                        :name="link.source.id + '->' + link.target.id" :x1="link.source.x" :y1="link.source.y"
                        :x2="link.target.x"
                        :y2="link.target.y" stroke="black" stroke-width="2"></line>
                </g>

                <g v-if="data.layout?.nodes">
                    <!-- @click="selectNode(node)"
                    @mouseenter="hoverNode(node)"
                    @mouseleave="hoverNode(null)" -->
                    <g v-for="node in data.layout.nodes" :key="node.id">
                        <!-- stroke="white" stroke-width="1" fill="red"-->
                        <!-- :class="circleClass(node)" -->
                        <circle :cx="node.x" :cy="node.y" :r="15" :name="node.id">
                        </circle>
                        <!-- <text :x="node.x" :y="node.y - nodeRadius - 2" fill="var(--q-stroke)" :name="node.id"
                            text-anchor="middle"
                            :font-size="fontSize">{{ node.id }}</text> -->
                    </g>
                </g>
            </g>

        </svg>
    </div>
</template>

<script setup lang="ts">

import { computed, onMounted, onUpdated, reactive, ref, watch, type Ref } from 'vue'
import { Graph } from 'ngraph.graph';
import { useGraphStore } from 'src/stores/graph-store';

import * as d3 from 'd3'
import { LayoutGraph } from 'src/graph/layoutGraph';

////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

// const props = withDefaults(defineProps<{
//     graph: Graph,
// }>(), {
// })

////////////////////////////////////////////////////////////////////////////
// Stores
////////////////////////////////////////////////////////////////////////////

const graphStore = useGraphStore()


////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////

const refSVG = ref<SVGSVGElement | null>(null)
const refGRoot = ref<SVGGElement | null>(null)

////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////

class Data {
    layout?: LayoutGraph = undefined
}

const data = reactive(new Data())

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
    // console.log("BBox", bBox.value, refGRoot.value)
    // emit('updated')
}

////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

onMounted(() => {

})

onUpdated(() => {

})

watch(() => graphStore.graph, (newVal) => {
    console.log("[FDG] New graph", newVal);

    const graph = graphStore.graph
    const layout = graph.getLayoutGraph()
    data.layout = layout

    console.log("New nodes and links", layout.nodes, layout.links)

    const simulation = d3.forceSimulation(data.layout.nodes)
        .force("charge", d3.forceManyBody().strength(-20)) // .strength(-50)
        .force("link", d3.forceLink(data.layout.links).strength(0.1))


        // .force("chargeGrav", d3.forceManyBody().strength(250).distanceMin(300))
        // .force("chargeElec", d3.forceManyBody().strength(-5).distanceMax(100))
        // .force("collide", d3.forceCollide().radius(50).strength(0.2))
        // .force("collide1", d3.forceCollide().radius(200).strength(0.01))
        // .force("link", d3.forceLink(data.layout.links))
        // .force("link", d3.forceLink(data.layout.links).distance(150).strength(2))
        .force("center", d3.forceCenter())
        // .force("link", d3.forceLink(data.layout.links)) //.distance(150)
        // .force("collide", d3.forceCollide().radius(40))
        // .force("charge", d3.forceManyBody().strength(100)) // .strength(-50)
        // .force("center", d3.forceCenter())
        .on("tick", ticked);


}, { immediate: true })

// watch([() => props.graph], () => {
//     if (!props.nodes || props.nodes.length == 0) {
//         // console.log("No nodes")
//         return
//     }
//     data.graph = new RosGraphData(props.nodes)
//     data.layout = data.graph.getGraphLayout()

//     console.log("New nodes and links", props.nodes, data.layout.nodes, data.layout.links)

//     if (data.layout.links === undefined) {
//         console.log("Links undefined")
//         return
//     }

//     if (data.layout.nodes === undefined) {
//         console.log("Nodes undefined")
//         return
//     }

//     nodeMap.clear()
//     for (const node of data.layout.nodes) {
//         nodeMap.set(node.id, node)
//     }

//     simulation = d3.forceSimulation(data.layout.nodes)
//         .force("charge", d3.forceManyBody().strength(100)) // .strength(-50)
//         .force("chargeGrav", d3.forceManyBody().strength(250).distanceMin(300))
//         .force("chargeElec", d3.forceManyBody().strength(-5).distanceMax(100))
//         .force("collide", d3.forceCollide().radius(50).strength(0.2))
//         // .force("collide1", d3.forceCollide().radius(200).strength(0.01))
//         .force("link", d3.forceLink(data.layout.links))
//         // .force("link", d3.forceLink(data.layout.links).distance(150))
//         .force("center", d3.forceCenter())
//         // .force("link", d3.forceLink(data.layout.links)) //.distance(150)
//         // .force("collide", d3.forceCollide().radius(40))
//         // .force("charge", d3.forceManyBody().strength(100)) // .strength(-50)
//         // .force("center", d3.forceCenter())
//         .on("tick", ticked);
// }, { immediate: true })

</script>

<style scoped></style>