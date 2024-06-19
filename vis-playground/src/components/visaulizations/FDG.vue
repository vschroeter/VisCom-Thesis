<template>
    <div>
        <svg ref="refSVG" width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <g ref="refNodes">
                <circle cx="10" cy="10" r="5" fill="blue"></circle>                
            </g>

        </svg>
    </div>
</template>

<script setup lang="ts">

import { computed, onMounted, onUpdated, ref, watch, type Ref } from 'vue'
import { Graph } from 'ngraph.graph';

////////////////////////////////////////////////////////////////////////////
// Props
////////////////////////////////////////////////////////////////////////////

const props = withDefaults(defineProps<{
    graph: Graph,
}>(), {
})

////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

onMounted(() => {

})

onUpdated(() => {

})

watch([() => props.graph], () => {
    if (!props.nodes || props.nodes.length == 0) {
        // console.log("No nodes")
        return
    }
    data.graph = new RosGraphData(props.nodes)
    data.layout = data.graph.getGraphLayout()

    console.log("New nodes and links", props.nodes, data.layout.nodes, data.layout.links)

    if (data.layout.links === undefined) {
        console.log("Links undefined")
        return
    }

    if (data.layout.nodes === undefined) {
        console.log("Nodes undefined")
        return
    }

    nodeMap.clear()
    for (const node of data.layout.nodes) {
        nodeMap.set(node.id, node)
    }

    simulation = d3.forceSimulation(data.layout.nodes)
        .force("charge", d3.forceManyBody().strength(100)) // .strength(-50)
        .force("chargeGrav", d3.forceManyBody().strength(250).distanceMin(300))
        .force("chargeElec", d3.forceManyBody().strength(-5).distanceMax(100))
        .force("collide", d3.forceCollide().radius(50).strength(0.2))
        // .force("collide1", d3.forceCollide().radius(200).strength(0.01))
        .force("link", d3.forceLink(data.layout.links))
        // .force("link", d3.forceLink(data.layout.links).distance(150))
        .force("center", d3.forceCenter())
        // .force("link", d3.forceLink(data.layout.links)) //.distance(150)
        // .force("collide", d3.forceCollide().radius(40))
        // .force("charge", d3.forceManyBody().strength(100)) // .strength(-50)
        // .force("center", d3.forceCenter())
        .on("tick", ticked);
}, { immediate: true })

</script>

<style scoped></style>