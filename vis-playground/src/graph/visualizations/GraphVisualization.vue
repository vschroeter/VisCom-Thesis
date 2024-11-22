<template>
    <div @click="onClickDiv">
        <!-- :class="(isSelected ? 'bg-primary text-white' : '') + ('full-modal': isZoomed)"> -->
        <q-card :class="{ 'bg-primary': isSelected, 'text-white': isSelected, 'full-modal': isZoomed, 'card': true }">
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
            <q-card-section class="row items-start q-py-xs">
                <div class="col setting-overview-text" :style="`inline-size: ${size - iconButtonDivWidth - 10}px;`">
                    {{ settings?.shortSummary }}
                </div>
            </q-card-section>
            <q-separator inset />
            <q-card-section>
                <div class="svgContainerDiv">
                    <svg ref="refSVG" :width="svgWidth" :height="svgHeight" :viewBox="viewBox"
                        xmlns="http://www.w3.org/2000/svg">

                        <g ref="refGZoom">

                            <g ref="refGRoot">
                            </g>
                        </g>

                    </svg>
                </div>
            </q-card-section>
            <q-separator />
            <q-card-section>
                <MetricOverview :settingId="props.settingId" :width="size" :height="50" />
            </q-card-section>
        </q-card>

    </div>
</template>

<script setup lang="ts">

import { computed, onMounted, onUpdated, ref, watch } from 'vue'
import { useGraphStore } from 'src/stores/graph-store';

import * as d3 from 'd3'
import { CommunicationGraph, CommunicationNode } from 'src/graph/commGraph';
import { GraphLayouter } from 'src/graph/layouter/layouter';
import { svgInteractiveRef } from './svgDirectives';
import MetricOverview from './MetricOverview.vue';
import { Node2d } from '../graphical';
import { useThrottleFn, watchDebounced } from '@vueuse/core';
import { layouterMapping } from '../layouter/settings/settingsCollection';
import { CommonSettings } from '../layouter/settings/commonSettings';
import { UserInteractions } from './interactions';
import { VisGraph } from '../visGraph/visGraph';
// import { HilbertAlgorithm, HilbertCurve } from '../layouter/linear/spaceFilling/hilbertCurveLayouter';
// import { MooreCurve } from '../layouter/linear/spaceFilling/mooreCurveLayouter';


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
const metricsCollection = graphStore.metricsCollection;
const userInteractions = graphStore.userInteractions as UserInteractions;


////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////

const refSVG = ref<SVGSVGElement | null>(null)
const refGRoot = ref<SVGGElement | null>(null)
const refGLinks = ref<SVGGElement | null>(null)
const refGNodes = ref<SVGGElement | null>(null)
const refGLabels = ref<SVGGElement | null>(null)
const refDivIconButtons = ref<HTMLDivElement | null>(null)
const refGZoom = ref<SVGGElement | null>(null)
const interactiveRef = svgInteractiveRef(refSVG, refGZoom, undefined, undefined)

////////////////////////////////////////////////////////////////////////////
// Refs and Computed values
////////////////////////////////////////////////////////////////////////////


///++++ Graph related stuff ++++//

const commGraph = computed(() => graphStore.graph);

let layouter: GraphLayouter<any> | null = null

///++++ Metric stuff ++++///



///++++ Setting stuff ++++//

const settings = computed(() => {
    return settingsCollection.getSettings(props.settingId)
})

const isSelected = computed(() => {
    return props.settingId === graphStore.activeSettingId
})

///++++ Bounding box of the main svg ++++//

const bBox = ref<DOMRect | null>(null)

const viewBox = computed(() => {
    if (bBox.value === null) {
        return "0 0 300 300"
    }
    return `${bBox.value.x} ${bBox.value.y} ${bBox.value.width} ${bBox.value.height}`
})

const svgWidth = computed(() => {
    return !isZoomed.value ? props.size : "80vw"
})

const svgHeight = computed(() => {
    return !isZoomed.value ? props.size : "80vh"
})


//++++ Layout stuff ++++//

const iconButtonDivWidth = computed(() => {
    if (refDivIconButtons.value === null) {
        return 0
    }
    return refDivIconButtons.value.clientWidth
})



////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////

const throttledUpdate1000 = useThrottleFn(() => {
    layoutUpdated()
}, 200)


const throttledUpdateUserInteractions = useThrottleFn(() => {
    if (!isSelected.value) {
        return;
    }
    layouter?.updateStyle();
    layoutUpdated()
}, 10, true, true)



function layoutUpdated() {
    if (!layouter) {
        return
    }

    layouter.setParentGroup(d3.select(refGRoot.value));
    layouter.renderAll({
        nodesEvents: {
            mouseenter: (d: Node2d) => {
                // return;
                if (!isSelected.value) return;
                const id = d?.id;
                if (id) {
                    // userInteractions.addHoveredNode(id)
                    const layoutNode = layouter?.visGraph.getNode(id);
                    const nodeIdsToAdd: string[] = [];
                    if (layoutNode) {
                        nodeIdsToAdd.push(layoutNode.id)
                        layoutNode.descendants.forEach((desc) => {
                            nodeIdsToAdd.push(desc.id)
                        })
                    }
                    userInteractions.addHoveredNode(nodeIdsToAdd)

                }
            },
            mouseleave: (d: Node2d) => {
                // return;
                if (!isSelected.value) return;

                const id = d?.id;
                if (id) {
                    const layoutNode = layouter?.visGraph.getNode(id);
                    if (layoutNode) {
                        const nodesToRemove: string[] = [];
                        nodesToRemove.push(layoutNode.id)
                        layoutNode.descendants.forEach((desc) => {
                            nodesToRemove.push(desc.id)
                        })
                        userInteractions.removeHoveredNode(nodesToRemove)
                    }
                }
            },
        }
    });

    // console.log("BBox", bBox.value, refGRoot.value)
    bBox.value = refGRoot.value?.getBBox() ?? null

}


function layoutFinished() {
    layoutUpdated();

    if (layouter?.calculateMetrics) {
        setTimeout(async () => {
            await calculateMetrics();
        }, 0)
    }
}

async function calculateMetrics(graph?: VisGraph | null) {
    if (!graph) {
        graph = layouter?.visGraph;
    }
    if (!graph) {
        console.error("No graph found for metrics calculation");
        return
    }
    await metricsCollection.calculateMetrics(props.settingId, graph);
}


function deleteItem() {
    settingsCollection.deleteSetting(props.settingId)
}
////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

onMounted(() => {

    console.log("[VIS] Mounted"); //, props.settings);

    userInteractions.emitter.on('update', () => {
        throttledUpdateUserInteractions()
    })

    watch(commGraph, (newVal) => {
        //updateSimulation();
        // console.log("[GViz] Graph updated", commGraph.value, commGraph.value instanceof CommunicationGraph);
        if (!settings.value) {
            console.error("No settings found for ", props.settingId, settingsCollection);
            return
        }

        const cls = layouterMapping[props.layoutType].layouter;

        layouter?.on('update', null);
        layouter?.on('end', null);
        if (layouter?.calculateMetrics) {
            metricsCollection.initMetrics(props.settingId, true);
            metricsCollection.clearMetrics(props.settingId);
        }
        if (commGraph.value.nodes.length === 0) {
            return
        }
        layouter = new cls({
            commGraph: commGraph.value as CommunicationGraph,
            settings: settings.value,
            commonSettings: settingsCollection.commonSettings as CommonSettings,
            userInteractions: userInteractions,
            nodes: commGraph.value.nodes as CommunicationNode[],
        });

        watchDebounced(settings, (newVal) => {
            layouter?.updateLayout(true);
        }, { debounce: 1000, immediate: false, deep: true })

        watch(settingsCollection.commonSettings, (newVal) => {
            layouter?.updateGraphByCommonSettings();
            layoutUpdated()
        }, { immediate: false, deep: true })



        layouter.on('update', () => {
            throttledUpdate1000();
        })
        layouter.on('end', layoutFinished)
        layouter.updateLayout();


    }, { immediate: true, deep: true })

})

onUpdated(() => {

})

function resetSimulation() {
    console.log("Reset simulation");
    if (layouter?.calculateMetrics) {
        metricsCollection.clearMetrics(props.settingId);
    }
    layouter?.reset();
}

function onClickDiv(event: MouseEvent) {
    graphStore.currentSettings = settings.value ? settings.value : undefined;
    graphStore.activeSettingId = props.settingId;
    // console.log(graphStore.currentSettings);

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

<style>
.edgePath path {
    stroke: #333;
    stroke-width: 1.5px;
}

.node rect {
    stroke: #999;
    fill: #fff;
    stroke-width: 1.5px;
}
</style>

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

.card {}

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

.setting-overview-text {
    /* overflow-wrap: break-word; */

    /* Scroll sideways */
    white-space: nowrap;
    overflow-x: auto;
    scrollbar-width: thin;

    /* Smaller and grey */
    font-size: 0.6em;
    opacity: 0.7;

}
</style>