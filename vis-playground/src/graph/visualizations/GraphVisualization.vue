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

                                <g ref="refGNodes">

                                </g>
                                <g ref="refGLinks">

                                </g>

                                <g ref="refGLabels">

                                </g>
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

import { computed, onMounted, onUpdated, reactive, ref, toValue, watch } from 'vue'
import { useGraphStore } from 'src/stores/graph-store';

import * as d3 from 'd3'
import { Graph2d } from 'src/graph/graphical/Graph2d';
import { CommunicationGraph } from 'src/graph/commGraph';
import { GraphLayouter } from 'src/graph/layouter/layouter';
import { svgInteractiveRef } from './svgDirectives';
import MetricOverview from './MetricOverview.vue';
import { EllipticArc } from '../graphical/EllipticArc';
import { Point2D, Vector2D } from '../graphical';
import { useDebounceFn, useThrottleFn, watchDebounced } from '@vueuse/core';
import { layouterMapping } from '../layouter/settings/settingsCollection';
import { CommonSettings } from '../layouter/settings/commonSettings';
import { LSystem, LSystemState, SpaceFillingCurve } from '../layouter/linear/spaceFilling/lSystem';
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

let graph2d: Graph2d | null = null
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

function layoutUpdated() {
    // console.log("[GViz] Layout updated", layouter, graph2d);

    if (!graph2d || !layouter) {
        return
    }

    // console.log("Updating nodes and links");
    d3.select(refGNodes.value)
        .call(layouter.updateNodes.bind(layouter))

    d3.select(refGLinks.value)
        .call(layouter.updateLinks.bind(layouter))

    d3.select(refGLabels.value)
        .call(layouter.updateLabels.bind(layouter))

    // console.log("BBox", bBox.value, refGRoot.value)
    bBox.value = refGRoot.value?.getBBox() ?? null

}


function layoutFinished() {
    layoutUpdated();

    setTimeout(async () => {
        await calculateMetrics();
    }, 1000)
}

async function calculateMetrics(graph?: Graph2d | null) {
    graph = graph === null ? undefined : graph2d;
    await metricsCollection.calculateMetrics(props.settingId, graph);
}


function deleteItem() {
    settingsCollection.deleteSetting(props.settingId)
}
////////////////////////////////////////////////////////////////////////////
// Lifecycle hooks
////////////////////////////////////////////////////////////////////////////

onMounted(() => {


    // const lHilbert = new LSystem({
    //     variables: ['X', 'Y'],
    //     constants: ['F', '+', '-'],
    //     axiom: 'X',
    //     rules: {
    //         'X': '+YF-XFX-FY+',
    //         'Y': '-XF+YFY+FX-'
    //     },
    //     moveRules: {
    //         'F': (state: LSystemState) => state.goForward(1),
    //         '+': (state: LSystemState) => state.turn(90),
    //         '-': (state: LSystemState) => state.turn(-90),
    //     }
    // })

    // const lSierpinski = new LSystem({
    //     variables: ['X'],
    //     constants: ['F', '+', '-'],
    //     axiom: 'F--XF--F--XF',
    //     rules: {
    //         'X': 'XF+F+XF--F--XF+F+X',
    //     },
    //     moveRules: {
    //         'F': (state: LSystemState) => state.goForward(1),
    //         '+': (state: LSystemState) => state.turn(45),
    //         '-': (state: LSystemState) => state.turn(-45),

    //     }
    // })

    // const lGosper = new LSystem({
    //     variables: ['G', 'F'],
    //     constants: ['+', '-'],
    //     axiom: 'F',
    //     rules: {
    //         'F': 'F-G--G+F++FF+G-',
    //         'G': '+F-GG--G-F++F+G'
    //     },
    //     moveRules: {
    //         'F': (state: LSystemState) => state.goForward(1),
    //         'G': (state: LSystemState) => state.goForward(1),
    //         '+': (state: LSystemState) => state.turn(60),
    //         '-': (state: LSystemState) => state.turn(-60),
    //     }
    // })


    // const curve = new SpaceFillingCurve(lGosper, 1);
    // // const curve2 = new SpaceFillingCurve(2, lGosper);
    // // const curve3 = new SpaceFillingCurve(3, lGosper);
    // // const curve4 = new SpaceFillingCurve(4, lGosper);
    // // const mooreCurve = new HilbertAlgorithm(2);

 
    // console.log("Curve Points:", curve.totalPointCount, curve.points);

    // // Map interval [0, 1] to the curve
    // // const t = 0.5; // Midpoint of the interval
    // // const position = mooreCurve.mapToMooreCurve(t);

    // // console.log("Position at t = 0.5:", position);

    // const size = 10;

    // // Map points to a polyline
    // // Distances = [0...max_h]
    // const points = [];

    // for (let h = 0; h < curve.totalPointCount; h++) {
    //     const p = curve.getPointAtIndex(h);
    //     points.push(p);
    // }

    // console.log("Points:", points);

    // d3.select(refGRoot.value)
    //     .append("polyline")
    //     .attr("points", points.map((p) => `${p.x * size},${p.y * size}`).join(" "))
    //     .attr("fill", "none")
    //     .attr("stroke", "black")
    //     .attr("stroke-width", 2)


    // let nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 10]);

    // d3.select(refGRoot.value)
    //     .selectAll("circle")
    //     .data(nums)
    //     .enter()
    //     .append("circle")
    //     .attr("cx", (d, i) => 20 + i * 20)
    //     .attr("cy", 20)
    //     .attr("r", 10)
    //     // .attr("fill", (d) => colorScale(d / 10))
    //     .attr("fill", (d) => colorScale(d))

    // <path d="M 0 100 A 60 60 0 0 0 100 0"/>

    // const e = new EllipticArc(
    //     new Point2D(120, 100),
    //     new Point2D(130, 170),
    //     50,
    //     150,
    //     0,
    //     // -145,
    //     0,
    //     1
    // )

    // d3.select(refGRoot.value)
    //     .append("path")
    //     .attr("d", e.getSvgPath())
    //     .attr("fill", "none")
    //     .attr("stroke", "black")
    //     .attr("stroke-width", 2.5)

    // // Little circles for start and end
    // d3.select(refGRoot.value)
    //     .append("circle")
    //     .attr("cx", e._start!.x)
    //     .attr("cy", e._start!.y)
    //     .attr("r", 2)
    //     .attr("fill", "none")
    //     .attr("stroke", "red")

    // d3.select(refGRoot.value)
    //     .append("circle")
    //     .attr("cx", e._end!.x)
    //     .attr("cy", e._end!.y)
    //     .attr("r", 2)
    //     .attr("fill", "none")
    //     .attr("stroke", "red")


    // const descr = e.getCenterParameters()!;
    // // console.log(descr);
    // const c = descr.center;

    // const len = 330;
    // const globalLine1 = {
    //     x0: c.x,
    //     y0: c.y,
    //     x1: c.x + len * Math.cos(descr.startAngleGlobal),
    //     y1: c.y + len * Math.sin(descr.startAngleGlobal)
    // }

    // const globalLine2 = {
    //     x0: c.x,
    //     y0: c.y,
    //     x1: c.x + len * Math.cos(descr.endAngleGlobal),
    //     y1: c.y + len * Math.sin(descr.endAngleGlobal)
    // }

    // const localLine1 = {
    //     x0: c.x,
    //     y0: c.y,
    //     x1: c.x + len * Math.cos(descr.startAngle),
    //     y1: c.y + len * Math.sin(descr.startAngle)
    // }

    // const localLine2 = {
    //     x0: c.x,
    //     y0: c.y,
    //     x1: c.x + len * Math.cos(descr.endAngle),
    //     y1: c.y + len * Math.sin(descr.endAngle)
    // }

    // d3.select(refGRoot.value)
    //     .append("circle")
    //     .attr("cx", c.x)
    //     .attr("cy", c.y)
    //     .attr("r", 2)
    //     .attr("fill", "none")
    //     .attr("stroke", "red")

    // // Lines for the radii
    // d3.select(refGRoot.value)
    //     .append("line")
    //     .attr("x1", c.x)
    //     .attr("y1", c.y)
    //     .attr("x2", c.x + e._rx)
    //     .attr("y2", c.y)
    //     .attr("stroke", "blue")
    //     .attr("transform", `rotate(${e._rotation} ${c.x} ${c.y})`)

    // d3.select(refGRoot.value)
    //     .append("line")
    //     .attr("x1", c.x)
    //     .attr("y1", c.y)
    //     .attr("x2", c.x)
    //     .attr("y2", c.y + e._ry)
    //     .attr("stroke", "blue")
    //     .attr("transform", `rotate(${e._rotation} ${c.x} ${c.y})`)

    // d3.select(refGRoot.value)
    //     .append("ellipse")
    //     .attr("cx", c.x)
    //     .attr("cy", c.y)
    //     .attr("rx", e._rx)
    //     .attr("ry", e._ry)
    //     .attr("fill", "none")
    //     .attr("stroke", "red")
    //     .attr("stroke-dasharray", "5,5")
    //     .attr("stroke-width", 0.5)
    //     .attr("transform", `rotate(${e._rotation} ${c.x} ${c.y})`)

    // d3.select(refGRoot.value)
    //     .append("line")
    //     .attr("x1", globalLine1.x0)
    //     .attr("y1", globalLine1.y0)
    //     .attr("x2", globalLine1.x1)
    //     .attr("y2", globalLine1.y1)
    //     .attr("stroke", "red")

    // d3.select(refGRoot.value)
    //     .append("line")
    //     .attr("x1", globalLine2.x0)
    //     .attr("y1", globalLine2.y0)
    //     .attr("x2", globalLine2.x1)
    //     .attr("y2", globalLine2.y1)
    //     .attr("stroke", "red")

    // d3.select(refGRoot.value)
    //     .append("line")
    //     .attr("x1", localLine1.x0)
    //     .attr("y1", localLine1.y0)
    //     .attr("x2", localLine1.x1)
    //     .attr("y2", localLine1.y1)
    //     .attr("stroke", "cyan")
    //     .attr("transform", `rotate(${e._rotation} ${c.x} ${c.y})`)

    // d3.select(refGRoot.value)
    //     .append("line")
    //     .attr("x1", localLine2.x0)
    //     .attr("y1", localLine2.y0)
    //     .attr("x2", localLine2.x1)
    //     .attr("y2", localLine2.y1)
    //     .attr("stroke", "cyan")
    //     .attr("transform", `rotate(${e._rotation} ${c.x} ${c.y})`)


    console.log("[VIS] Mounted"); //, props.settings);

    watch(commGraph, (newVal) => {
        //updateSimulation();
        console.log("[GViz] Graph updated", commGraph.value, commGraph.value instanceof CommunicationGraph);
        if (!settings.value) {
            console.error("No settings found for ", props.settingId, settingsCollection);
            return
        }

        const cls = layouterMapping[props.layoutType].layouter;

        layouter?.on('update', null);
        layouter?.on('end', null);
        metricsCollection.clearMetrics(props.settingId);
        // calcluateMetrics(null);
        if (commGraph.value.nodes.length === 0) {
            return
        }
        graph2d = new Graph2d(toValue(commGraph.value) as CommunicationGraph);
        layouter = new cls(graph2d, settings.value, settingsCollection.commonSettings as CommonSettings);

        watchDebounced(settings, (newVal) => {
            layouter?.updateLayout(true);
        }, { debounce: 1000, immediate: false, deep: true })

        watch(settingsCollection.commonSettings, (newVal) => {
            // layouter?.updateLayout(true);
            layouter?.updateGraphByCommongSettings();
            layoutUpdated()
        }, { immediate: false, deep: true })

        const throttledUpdate = useThrottleFn(() => {
            layoutUpdated()
        }, 1000)

        layouter.on('update', () => {
            throttledUpdate();
        })
        layouter.on('end', layoutFinished)
        layouter.updateLayout();


    }, { immediate: true, deep: true })

})

onUpdated(() => {

})

function resetSimulation() {
    console.log("Reset simulation");
    metricsCollection.clearMetrics(props.settingId);
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