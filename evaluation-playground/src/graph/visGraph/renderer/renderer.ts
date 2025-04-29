import _ from "lodash";

import rtreeLib from "rtree"
import { VisGraph } from "../visGraph";

import * as d3 from 'd3';
import { Circle, Point, Ray, Segment, ShapeTag } from "2d-geometry";
import { Anchor } from "src/graph/graphical";

export class Renderer {

    rtree = rtreeLib(4);
    renderQueue: SvgRenderable[] = [];

    allElements: SvgRenderable[] = [];

    parent: d3.Selection<SVGGElement | null, unknown, null, undefined> | null = null;

    constructor(public visGraph: VisGraph) {
    }

    clear() {
        this.rtree = rtreeLib(4);

        this.allElements.forEach(element => {
            element.exit();
        });

        this.allElements = [];
        this.renderQueue = [];
    }

    setRoot(group: d3.Selection<SVGGElement | null, unknown, null, undefined>) {
        if (group.node() === null) {
            console.error("Root group is null");
            return;
        }

        this.parent = group;
        this.allElements.forEach(element => {
            element.parentElement = group;
        });

    }

    addElement(element: SvgRenderable) {
        if (!element.boundingBox) {
            console.error("Element has no bounding box");
            return;
        }
        this.rtree.insert(element.boundingBox, element);
        this.renderQueue.push(element);
    }

    removeElement(element: SvgRenderable) {
        if (!element.boundingBox) {
            console.error("Element has no bounding box");
            return;
        }
        this.rtree.remove(element.boundingBox, element);
    }



    renderAll(visibleArea?: BoundingBox | null) {
        let newElements = false;
        if (!visibleArea) {
            this.allElements.forEach(element => {
                newElements = element.update() || newElements;
            });
            if (newElements) {
                this.sortDomElements();
            }
            return;
        }

        const elements = this.rtree.search(visibleArea) as SvgRenderable[];
        const updateElements = [...elements, ...this.renderQueue];


        updateElements.forEach(element => {
            element.updateVisibleArea(visibleArea);
        });

        updateElements.forEach(element => {
            newElements = element.update() || newElements;
        });

        this.renderQueue = [];

        if (newElements) {
            this.sortDomElements();
        }
    }

    sortDomElements() {
        // this.allElements.sort((a, b) => a.zOrder - b.zOrder);

        const parent = this.parent;
        const parentNode = parent?.node();
        if (!parentNode) {
            console.error("Parent group not set");
            return;
        }


        const elements = Array.from(parentNode.children ?? []) as Element[];

        elements.sort((a, b) => {
            const aZ = parseInt(a.getAttribute('z-order') ?? '1000');
            const bZ = parseInt(b.getAttribute('z-order') ?? '1000');
            return aZ - bZ;
        });

        elements.forEach(element => {
            parentNode.appendChild(element);
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Debug Shapes
    ////////////////////////////////////////////////////////////////////////////


    renderDebuggingShapes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>) {
        selection.selectChildren('g.debug')
            .data(this.visGraph.debugShapes)
            .join('g').classed('debug', true)
            .each((shape, i, g) => {
                const d = d3.select(g[i]);
                d.selectChildren('*').remove();

                switch (shape.tag) {
                    // case ShapeTag.Segment: {
                    //     drawSegment(shape as Segment); break
                    // }
                    case ShapeTag.Circle: {
                        const c = shape as Circle;
                        d.append('circle')
                            .attr('cx', c.center.x)
                            .attr('cy', c.center.y)
                            .attr('r', c.r)
                            .attr('fill', 'none')
                            .attr('stroke', c._data?.stroke ?? 'blue')
                            .attr('stroke-width', 0.3)
                            .attr('opacity', 0.3)

                        break;
                    }
                    case ShapeTag.Segment: {
                        d.append('line')
                            .attr('x1', (shape as Segment).start.x)
                            .attr('y1', (shape as Segment).start.y)
                            .attr('x2', (shape as Segment).end.x)
                            .attr('y2', (shape as Segment).end.y)
                            .attr('stroke', shape._data?.stroke ?? 'gray')
                            .attr('stroke-width', shape._data?.strokeWidth ?? 0.5)
                            .attr('opacity', 0.5)

                        break;
                    }
                    case ShapeTag.Point: {
                        const p = shape as Point;
                        d.append('circle')
                            .attr('cx', p.x)
                            .attr('cy', p.y)
                            .attr('r', p._data?.r ?? 1)
                            .attr('fill', p._data?.fill ?? 'green')
                            .attr('stroke', 'none')
                            .attr('opacity', 0.5)
                        break;
                    }
                    case ShapeTag.Ray: {
                        const ray = shape as Ray;

                        const length = 500;
                        const end = ray.pt.translate(ray.norm.rotate90CCW().multiply(length));

                        d.append('line')
                            .attr('x1', ray.start.x)
                            .attr('y1', ray.start.y)
                            .attr('x2', end.x)
                            .attr('y2', end.y)
                            .attr('stroke', 'blue')
                            .attr('stroke-width', 0.5)
                            .attr('opacity', 0.5)
                        break;
                    }

                    case "Anchor": {
                        const anchor = shape as Anchor;

                        const r = 1.5;  //1;
                        const l = 20; //10;
                        const o = 0.3; // 0.5;
                        const sw = 1; // 0.5;

                        d.append('circle')
                            .attr('cx', anchor.anchorPoint.x)
                            .attr('cy', anchor.anchorPoint.y)
                            .attr('r', r)
                            .attr('fill', anchor.anchorPoint._data?.fill ?? 'blue')
                            .attr('stroke', 'none')
                            .attr('opacity', anchor._data?.opacity ?? o)

                        d.append('line')
                            .attr('x1', anchor.anchorPoint.x)
                            .attr('y1', anchor.anchorPoint.y)
                            .attr('x2', anchor.anchorPoint.x + anchor.direction.x * (anchor._data?.length ?? l))
                            .attr('y2', anchor.anchorPoint.y + anchor.direction.y * (anchor._data?.length ?? l))
                            .attr('stroke', anchor._data?.stroke ?? 'red')
                            .attr('stroke-width', anchor._data?.strokeWidth ?? sw)
                            .attr('opacity', anchor._data?.opacity ?? o)




                    }
                }

            })
    }

}



export type BoundingBox = {
    x: number,
    y: number,
    w: number,
    h: number
}

export type SvgUpdateCallback = () => void;

// SvgElement one of "cirlce", "rect", "line", "path", "text", "g", "svg"
export abstract class SvgRenderable {

    protected updateCallbacks: SvgUpdateCallback[] = [];

    parentElement: d3.Selection<SVGGElement | any, any, any, any> | null = null;

    boundingBox: BoundingBox | undefined = { x: 0, y: 0, w: 0, h: 0 };

    zOrder = 1000;

    constructor(public renderer?: Renderer) {
        renderer?.allElements.push(this);
        renderer?.renderQueue.push(this);
    }

    setBoundingBox(bBox: BoundingBox) {
        if (!this.boundingBox) {
            this.boundingBox = bBox;
            console.log("setBoundingBox", this.boundingBox);
            this.renderer?.addElement(this);
        } else {
            if (this.boundingBox.x !== bBox.x || this.boundingBox.y !== bBox.y || this.boundingBox.w !== bBox.w || this.boundingBox.h !== bBox.h) {
                this.renderer?.removeElement(this);
                this.boundingBox = bBox;
                this.renderer?.addElement(this);
            }
        }
    }

    abstract updateVisibleArea(visibleArea: BoundingBox): void;

    ////////////////////////////////////////////////////////////////////////////
    // Style update methods
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Check if a given property has changed and add an update callback if it has.
     * @param values The values to check. Each value must have either currentValuePath (object path in this as string) or valueGetter and valueSetter defined. The current value is defined against the new value, which must be defined.
     * @param updateCallback If the value has changed, the update callback is added to the list of update callbacks
     */
    protected checkValueAndAddUpdateCallback(
        values: {
            currentValuePath?: string
            valueGetter?: () => any,
            valueSetter?: (value: any) => void
            newValue: any
        }[],
        updateCallback?: SvgUpdateCallback): boolean {
        let changed = false;
        values.forEach(value => {

            if (value.newValue === undefined) {
                return;
            }

            if (!value.currentValuePath && (!value.valueGetter || !value.valueSetter)) {
                throw new Error("Either currentValuePath or valueGetter & valueSetter must be defined");
            }

            const currentValue = value.currentValuePath ? _.get(this, value.currentValuePath) : value.valueGetter!();

            if (currentValue !== value.newValue) {
                if (value.currentValuePath) {
                    _.set(this, value.currentValuePath, value.newValue);
                } else {
                    value.valueSetter!(value.newValue);
                }
                changed = true;

                if (updateCallback) {
                    // Check if callback is already in the list
                    if (!this.updateCallbacks.includes(updateCallback)) {
                        this.updateCallbacks.push(updateCallback);
                    }
                }
            }
        });
        return changed;
    }

    protected addUpdateCallback(callback: SvgUpdateCallback, checkIfExist = true) {
        if (checkIfExist && (this.updateCallbacks.includes(callback, this.updateCallbacks.length - 1) || this.updateCallbacks.includes(callback))) {
            return;
        }
        this.updateCallbacks.push(callback);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Render methods
    ////////////////////////////////////////////////////////////////////////////


    /**
     * Helper method to add a sub element to the renderable's root element.
     * @param subElement Type of the sub element (e.g. "circle", "rect", etc.)
     * @param className Optional class name of the sub element
     */
    addSubElement(
        subElement: string,
        className?: string,
        parentElement?: d3.Selection<SVGGElement | any, any, any, any>,
        zOrder?: number
    ): d3.Selection<SVGGElement | any, any, any, any> {
        const p = parentElement ?? this.parentElement;
        if (!p) {
            // console.error("Root selection not set");
            throw new Error("No parent element provided");
        }

        const sub = p.append(subElement)
        if (className) {
            sub.classed(className, true);
        }
        sub.attr('z-order', zOrder ?? this.zOrder);
        return sub;
    }

    abstract subElementsExist(): boolean;

    /**
     * Method to add sub elements to the renderable during the enter phase.
     * Override this method to add sub elements to the renderable.
     */
    abstract addSubElements(): void;

    abstract removeSubElements(): void;

    /**
     * Method to add the renderable elements to the selection
     */
    enter(): void {
        this.addSubElements();
    }

    /**
     * Method to remove the renderable elements from the selection
     */
    exit(): void {
        this.updateCallbacks = [];
        this.removeSubElements();
    }

    /**
     * Method to update the renderable elements in the selection
     */
    update(): boolean {
        if (!this.parentElement) return false;
        let somethingEntered = false;

        if (!this.subElementsExist()) {
            this.enter();
            somethingEntered = true;
        }

        // Call all update callbacks
        this.updateCallbacks.forEach(callback => callback.bind(this)());

        // Clear the update callbacks
        this.updateCallbacks = [];

        return somethingEntered;
    }





}

