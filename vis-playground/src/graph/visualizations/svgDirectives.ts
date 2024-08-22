import { onMounted, ref, Ref, shallowRef } from "vue";

import * as d3 from "d3";

export function svgInteractiveRef(
    svgRef: Ref<SVGElement | null>,
    gRef: Ref<SVGGElement | null>,
    transformCallback:
        | ((transform: d3.ZoomTransform) => void)
        | undefined = undefined,
    dblclickCallback: (() => void) | undefined = undefined
) {
    const elementRef = gRef;
    const currentTransition = shallowRef<d3.Transition<SVGGElement, unknown, null, undefined> | null>(null);

    const funcRef = (el: SVGSVGElement | null) => {
        elementRef.value = el;
    };

    const lastTransform = shallowRef(d3.zoomIdentity);
    const svgSelection = ref<d3.Selection<
        SVGSVGElement,
        unknown,
        null,
        undefined
    > | null>(null);
    const zoom = ref<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    onMounted(() => {
        console.log('svgInteractiveRef onMounted', elementRef.value, svgRef.value);

        const svg = d3.select(svgRef.value as SVGSVGElement);
        svgSelection.value = svg;

        zoom.value = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.05, 20])
            .on('zoom', zoomed);

        svg.call(zoom.value).on('dblclick.zoom', () => {
            resetZoom();
            if (dblclickCallback) {
                dblclickCallback();
            }
        });
    });

    function resetZoom(duration = 200) {
        const svg = svgSelection.value;
        if (svg && zoom.value) {
            svg
                .transition()
                .duration(duration)
                .call(zoom.value.transform, d3.zoomIdentity);
            lastTransform.value = d3.zoomIdentity;
        }
    }

    function zoomed(event: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
        // console.log('zoomed', event)
        const g = d3.select(elementRef.value as SVGGElement);

        if (lastTransform.value.k == event.transform.k) {
            g.attr('transform', event.transform.toString());
        } else {

            let easing = d3.easeCubic;
            if (currentTransition.value) {
                easing = d3.easeCubicOut;
            }

            currentTransition.value = g.transition()
                .duration(100)
                .ease(easing)
                .attr('transform', event.transform.toString())
                .on('end', () => {
                    currentTransition.value = null;
                });
        }

        lastTransform.value = event.transform;
        if (transformCallback) {
            transformCallback(event.transform);
        }
    }

    return { resetZoom: resetZoom };
}
