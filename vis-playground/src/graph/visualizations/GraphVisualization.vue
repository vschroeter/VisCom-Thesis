<template>
    <div @click="onClickDiv">
        <!-- :class="(isSelected ? 'bg-primary text-white' : '') + ('full-modal': isZoomed)"> -->
        <q-card :class="{ 'bg-secondary': isSelected, 'text-white': isSelected, 'full-modal': isZoomed, 'card': true }">
            <q-card-section class="row items-start q-py-xs items-center">
                <div :class="'col q-mr-sm '"
                    :style="`inline-size: ${size - iconButtonDivWidth - 30}px; overflow-wrap: break-word;`">
                    {{ settings?.name }}
                </div>
                <div ref="refDivIconButtons" class="col-auto">
                    <q-btn size="sm" flat round icon="content_copy" @click="duplicateSettings">
                        <q-tooltip :delay="500">Duplicate</q-tooltip>
                    </q-btn>
                    <q-btn size="sm" flat round icon="download" @click="download">
                        <q-tooltip :delay="500">Download as PDF</q-tooltip>
                    </q-btn>
                    <q-btn size="sm" flat round icon="zoom_out_map" @click="toggleZoom">
                        <q-tooltip :delay="500">Full Screen</q-tooltip>
                    </q-btn>
                    <q-btn size="sm" icon="refresh" flat round @click="resetSimulation">
                        <q-tooltip :delay="500">Reset Visualization</q-tooltip>
                    </q-btn>
                    <q-btn v-if="!isZoomed" size="sm" icon="delete" flat round @click="deleteItem">
                        <q-tooltip :delay="500">Remove Visualization</q-tooltip>
                    </q-btn>
                </div>
                <!-- <div class="text-h6">Graph Visualization</div>
                <q-btn label="Reset" color="primary" size="x" flat @click="resetSimulation" /> -->
            </q-card-section>
            <q-card-section class="row items-start q-py-xs">
                <div v-if="false" class="col setting-overview-text"
                    :style="`inline-size: ${size - iconButtonDivWidth - 10}px;`">
                    {{ settings?.shortSummary }}
                </div>
            </q-card-section>
            <q-separator inset />
            <q-card-section>
                <div class="svgContainerDiv">
                    <svg ref="refSVG" :width="svgWidth" :height="svgHeight" :viewBox="viewBox"
                        xmlns="http://www.w3.org/2000/svg">


                        <g ref="refGZoom">

                            <!-- <rect :x="(visibleArea?.x ?? 0) + 10" :y="(visibleArea?.y ?? 0) + 10" :width="(visibleArea?.w ?? 0) - 20"
                                :height="(visibleArea?.h ?? 0) - 20" fill="none" stroke="red" stroke-width="1" /> -->

                            <!--<circle cx="0" cy="0" r="10" fill="red" /> -->

                            <g ref="refGExportRoot">
                                <g ref="refGRoot">
                                </g>

                                <g ref="refGDebug">
                                </g>
                            </g>


                            <!-- <rect :x="rawBbox?.x" :y="rawBbox?.y" :width="rawBbox?.width" :height="rawBbox?.height"
                                fill="none" stroke="red" stroke-width="1" /> -->
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

import { computed, onMounted, onUpdated, ref, watch, WatchStopHandle } from 'vue'
import { useGraphStore } from 'src/stores/graph-store';

import * as d3 from 'd3'

import jsPDF from 'jspdf'
import 'svg2pdf.js'

import { font as NunitoFont } from 'src/css/fonts/Nunito-VariableFont_wght-normal'
import { font as NunitoFontNormal } from 'src/css/fonts/Nunito-Regular-normal'

import { CommunicationGraph, CommunicationNode } from 'src/graph/commGraph';
import { GraphLayouter } from 'src/graph/layouter/layouter';
import { svgInteractiveRef } from './svgDirectives';
import MetricOverview from './MetricOverview.vue';
import { Connection2d, Node2d } from '../graphical';
import { useThrottleFn, watchDebounced, watchThrottled } from '@vueuse/core';
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
// const userInteractions = graphStore.userInteractions as UserInteractions;


////////////////////////////////////////////////////////////////////////////
// Template Refs
////////////////////////////////////////////////////////////////////////////

const refSVG = ref<SVGSVGElement | null>(null)
const refGRoot = ref<SVGGElement | null>(null)
const refGDebug = ref<SVGGElement | null>(null)
const refGExportRoot = ref<SVGGElement | null>(null)
const refGLinks = ref<SVGGElement | null>(null)
const refGNodes = ref<SVGGElement | null>(null)
const refGLabels = ref<SVGGElement | null>(null)
const refDivIconButtons = ref<HTMLDivElement | null>(null)
const refGZoom = ref<SVGGElement | null>(null)
const interactiveRef = svgInteractiveRef(refSVG, refGZoom, onZoomed, () => updateBbox(true))

const visibleArea = ref<{ x: number, y: number, w: number, h: number } | null>(null)

const updateVisibleAreaThrottled = useThrottleFn(() => {
    if (!layouter) {
        return;
    }
    layouter.visGraph.renderer.renderAll(visibleArea.value);
}, 100, true, true)

function onZoomed(transform: d3.ZoomTransform) {

    const contentBbox = bBox.value;
    if (!contentBbox) {
        return;
    }

    // Get the DOM size of the svg
    const svg = refSVG.value;
    if (!svg) {
        return;
    }

    const svgBbox = svg.getBBox();

    // Stretch the visible area bbox to the svg sizes


    // // Make the contentBbox quadratic
    const quadraticSize = Math.min(contentBbox.width, contentBbox.height) * 2;
    const widthDiff = quadraticSize - contentBbox.width;
    const heightDiff = quadraticSize - contentBbox.height;

    const quadraticBbox = {
        x: contentBbox.x - widthDiff / 2,
        y: contentBbox.y - heightDiff / 2,
        width: quadraticSize,
        height: quadraticSize
    }

    const _visibleArea = {
        x: (quadraticBbox.x - transform.x) / transform.k,
        y: (quadraticBbox.y - transform.y) / transform.k,
        w: quadraticBbox.width / transform.k,
        h: quadraticBbox.height / transform.k
    }

    visibleArea.value = _visibleArea;
    updateVisibleAreaThrottled();
}

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
const rawBbox = ref<DOMRect | null>(null)

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
}, 10, true, false)



function layoutUpdated() {
    if (!layouter) {
        return
    }


    const visGraph = layouter.visGraph;
    const renderer = visGraph.renderer;

    // renderer.


    // TODO: dont do this every time
    renderer.setRoot(d3.select(refGRoot.value));
    renderer.renderAll(visibleArea.value)
    renderer.renderDebuggingShapes(d3.select(refGDebug.value));

    updateBbox();
}


function updateBbox(reset = false) {

    if (reset) {
        bBox.value = null;
    }

    const newBBox = refGRoot.value?.getBBox() ?? null
    rawBbox.value = newBBox;

    if (!bBox.value) {
        if (newBBox) {
            newBBox.x = newBBox.x - newBBox.width * 0.1;
            newBBox.y = newBBox.y - newBBox.height * 0.1;
            newBBox.width = newBBox.width * 1.2;
            newBBox.height = newBBox.height * 1.2;
            bBox.value = newBBox;
        }
    }
    else {
        // Check if it is larger than the current one
        if (newBBox) {
            if (newBBox.width > bBox.value.width || newBBox.height > bBox.value.height) {
                bBox.value = newBBox;
            }
        }
    }
}


function layoutFinished() {
    layoutUpdated();
    setTimeout(() => {
        updateBbox(true);
        interactiveRef.resetZoom();
    }, 100)

    layouter?.visGraph.userInteractions?.emitter.on('update', () => {
        throttledUpdateUserInteractions()
    })

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

function duplicateSettings() {
    if (!settings.value) return;

    // First, add a new setting of the same type
    settingsCollection.addSetting(props.layoutType);

    // Get the id of the newly created setting (should be the last one added)
    const newSettingsList = settingsCollection.mapLayoutTypeToListOfSettings.get(props.layoutType) || [];
    if (newSettingsList.length === 0) return;

    const newSetting = newSettingsList[newSettingsList.length - 1];

    // Copy the settings from the current one
    const currentSettingJson = settings.value.getJson();

    // Add " (copy)" to the name
    currentSettingJson.name = (currentSettingJson.name ? currentSettingJson.name + " (copy)" : "");

    // Load the settings into the new one
    newSetting.loadFromJson(currentSettingJson);

    // Optional: select the new setting
    graphStore.currentSettings = newSetting;
    graphStore.activeSettingId = newSetting.id;

    // Stop event propagation
    event?.stopPropagation();
}

////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

let settingWatcher: WatchStopHandle | null = null;

onMounted(() => {

    console.log("[VIS] Mounted"); //, props.settings);

    watch(settingsCollection.commonSettings, (newVal) => {
        console.warn("[COMMON SETTINGS CHANGED]");
        layouter?.updateGraphByCommonSettings();
        layoutUpdated()
    }, { immediate: false, deep: true })



    watch(commGraph, (newVal) => {
        //updateSimulation();
        // console.log("[GViz] Graph updated", commGraph.value, commGraph.value instanceof CommunicationGraph);
        if (!settings.value) {
            console.error("No settings found for ", props.settingId, settingsCollection);
            return
        }

        const cls = layouterMapping[props.layoutType].layouter;

        bBox.value = null;
        layouter?.on('update', null);
        layouter?.on('end', null);
        layouter?.renderer?.clear();
        if (layouter?.calculateMetrics) {
            // metricsCollection.initMetrics(props.settingId, true);
            metricsCollection.clearMetrics(props.settingId);
        }
        if (commGraph.value.nodes.length === 0) {
            return
        }
        layouter = new cls({
            commGraph: commGraph.value as CommunicationGraph,
            settings: settings.value,
            commonSettings: settingsCollection.commonSettings as CommonSettings,
            nodes: commGraph.value.nodes as CommunicationNode[],
            initOnConstruction: false,
        });

        // watchDebounced(settings, (newVal) => {
        //     layouter?.updateLayout(true);
        // }, { debounce: 1000, immediate: false, deep: true })

        if (settingWatcher) {
            settingWatcher();
        }
        settingWatcher = watchThrottled(settings, (newVal) => {
            console.warn("[SETTINGS CHANGED]", newVal);
            layouter?.updateLayout(true);
        }, { throttle: 500, immediate: false, deep: true, leading: false, trailing: true })






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

async function download() {
    await downloadPDF();
}

async function downloadPDF() {
    const svg = refSVG.value;

    // Print the svg as text on the console
    // console.log(svg?.outerHTML);

    const svgGroup = refGExportRoot.value;
    rawBbox.value = refGExportRoot.value?.getBBox() ?? null;

    if (!svgGroup || !rawBbox.value) {
        console.error("No SVG found");
        return;
    }



    const x = -(rawBbox.value?.x ?? 0);
    const y = -(rawBbox.value?.y ?? 0);
    const width = rawBbox.value?.width ?? 0;
    const height = rawBbox.value?.height ?? 0;

    const marginFactor = 0.99;

    const adaptedWidth = width / marginFactor;
    const adaptedHeight = height / marginFactor;

    const adaptedX = x - (width - adaptedWidth) / 2;
    const adaptedY = y - (height - adaptedHeight) / 2;

    const doc = new jsPDF({
        unit: 'px',
        // format: [width, height],
        format: [adaptedWidth, adaptedHeight],
        orientation: width > height ? 'l' : 'p',
    })

    // doc.rect(1, 1, adaptedWidth - 2, adaptedHeight - 2, 'S');
    // doc.circle(0, 0, 10, 'S');
    // doc.circle(width, height, 10, 'S');
    // doc.circle(x + width, y, 10, 'S');
    // doc.circle(x, y + height, 10, 'S');
    // doc.circle(x + width, y + height, 10, 'S');

    // add the font to jsPDF
    doc.addFileToVFS("Nunito.ttf", NunitoFontNormal);
    doc.addFont("Nunito.ttf", "Nunito", "normal");
    doc.setFont("Nunito");

    // console.log("Download PDF", width, height, NunitoFont);

    const graphName = (settings.value?.name ?? "").length > 0 ? settings.value?.name : "Graph";
    const settingsType = settings.value?.type ?? "";
    const fileName = graphName + "_" + settingsType + "_" + layouter?.visGraph.allLeafLayoutNodes.length + "_nodes" + ".pdf";

    // svg2pdf adds the method to PDFDocument, but its not in the types
    doc.svg(svgGroup, {
        x: adaptedX,
        y: adaptedY,
        width: adaptedWidth,
        height: adaptedHeight,
        loadExternalStyleSheets: true,
    }).then(() => {
        doc.save(fileName)
    })
    // svg2pdf adds the method to PDFDocument, but its not in the types
    // doc.svg(svgGroup, {
    //     x: adaptedX,
    //     y: adaptedY,
    //     width,
    //     height,
    //     loadExternalStyleSheets: true,
    // }).then(() => {
    //     doc.save(fileName)
    // })
}

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
