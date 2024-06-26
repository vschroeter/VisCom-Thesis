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
                        <circle :cx="node.x" :cy="node.y" :r="10" :name="node.id">
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
import { LayoutGraph, LayoutGraphLink, LayoutGraphNode } from 'src/graph/layoutGraph';
import { FdgVisSettings } from 'src/visualizations/visualizationSettings';

////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

// const props = withDefaults(defineProps<{
//     graph: Graph,
// }>(), {
// })

const props = defineProps<{
    settings: FdgVisSettings,
}>()

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


const simulation = ref<d3.Simulation<LayoutGraphNode, LayoutGraphLink> | null>(null)




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
    console.log("[FDG] Mounted", props.settings);
})

onUpdated(() => {

})

watch(() => graphStore.graph, (newVal) => {
    console.log("[FDG] New graph", newVal);

    const graph = graphStore.graph
    const layout = graph.getLayoutGraph()
    data.layout = layout

    console.log("New nodes and links", layout.nodes, layout.links)


    updateSimulation()


    // const simulation = d3.forceSimulation(data.layout.nodes)
    //     .force("charge", d3.forceManyBody().strength(-20)) // .strength(-50)
    //     .force("link", d3.forceLink(data.layout.links).strength(0.1))

    //     // .force("chargeGrav", d3.forceManyBody().strength(250).distanceMin(300))
    //     // .force("chargeElec", d3.forceManyBody().strength(-5).distanceMax(100))
    //     // .force("collide", d3.forceCollide().radius(50).strength(0.2))
    //     // .force("collide1", d3.forceCollide().radius(200).strength(0.01))
    //     // .force("link", d3.forceLink(data.layout.links))
    //     // .force("link", d3.forceLink(data.layout.links).distance(150).strength(2))
    //     .force("center", d3.forceCenter())
    //     // .force("link", d3.forceLink(data.layout.links)) //.distance(150)
    //     // .force("collide", d3.forceCollide().radius(40))
    //     // .force("charge", d3.forceManyBody().strength(100)) // .strength(-50)
    //     // .force("center", d3.forceCenter())
    //     .on("tick", ticked);


}, { immediate: true })

function updateSimulation() {
    if (!props.settings) {
        return
    }


    if (simulation.value) {
        simulation.value.stop()
    }

    const layout = data.layout

    if (!layout) {
        return
    }

    simulation.value = d3.forceSimulation(layout.nodes)
        // .force("charge", d3.forceManyBody().strength(-20)) // .strength(-50)
        // .force("link", d3.forceLink(layout.links).strength(0.1))
        // .force("center", d3.forceCenter())
        .on("tick", ticked)
        .stop()
        ;    

    // const forces = [];

    console.log("Updating simulation", props.settings)
    const manyBodySetting = props.settings.getSetting("forceManyBody");
    if (manyBodySetting?.active) {
        simulation.value.force("charge", d3.forceManyBody().strength(props.settings.getSetting("forceManyBody")?.getParam('strength')?.value))
    }

    const linkSetting = props.settings.getSetting("forceLink");
    if (linkSetting?.active) {
        const strength = linkSetting?.getParam('strength')?.value
        const distance = linkSetting?.getParam('distance')?.value
        const force = d3.forceLink(layout.links)
        if (strength) {
            force.strength(strength)
        }
        if (distance) {
            force.distance(distance)
        }
        simulation.value.force("link", force)
    }

    const centerSetting = props.settings.getSetting("forceCenter");
    if (centerSetting?.active) {
        const strength = centerSetting?.getParam('strength')?.value
        const force = d3.forceCenter()
        if (strength) {
            force.strength(strength)
        }
        simulation.value.force("center", force)
    }

    const collideSetting = props.settings.getSetting("forceCollide");
    if (collideSetting?.active) {
        const radius = collideSetting?.getParam('radius')?.value
        const strength = collideSetting?.getParam('strength')?.value
        const force = d3.forceCollide()
        if (radius) {
            force.radius(radius)
        }
        if (strength) {
            force.strength(strength)
        }
        simulation.value.force("collide", force)
    }

    // simulation.value.force("charge", d3.forceManyBody().strength(props.settings.charge)) // .strength(-50)
    // simulation.value.force("link", d3.forceLink(data.layout?.links ?? []).strength(props.settings.linkStrength))
    // simulation.value.force("center", d3.forceCenter())
    simulation.value.alpha(0.7).restart()

}

watch(() => props.settings, (newVal) => {
    updateSimulation();
}, { immediate: true, deep: true })

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