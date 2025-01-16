import _ from "lodash";

import rtreeLib from "rtree"
import { VisGraph } from "../visGraph";

export class Renderer {

    rtree = rtreeLib(4);
    renderQueue: SvgRenderable[] = [];

    allElements: SvgRenderable[] = [];

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

        if (!visibleArea) {
            this.allElements.forEach(element => {
                element.update();
            });
            return;
        }

        const elements = this.rtree.search(visibleArea) as SvgRenderable[];
        const updateElements = [...elements, ...this.renderQueue];


        updateElements.forEach(element => {
            element.updateVisibleArea(visibleArea);
        });

        updateElements.forEach(element => {
            element.update();
        });

        this.renderQueue = [];
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
    addSubElement(subElement: string, className?: string, parentElement?: d3.Selection<SVGGElement | any, any, any, any>): d3.Selection<SVGGElement | any, any, any, any> {
        const p = parentElement ?? this.parentElement;
        if (!p) {
            // console.error("Root selection not set");
            throw new Error("No parent element provided");
        }

        const sub = p.append(subElement)
        if (className) {
            sub.classed(className, true);
        }
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
        this.removeSubElements();
    }

    /**
     * Method to update the renderable elements in the selection
     */
    update(): void {
        if (!this.parentElement) return;

        if (!this.subElementsExist()) {
            console.log("Renderable sub elements do not exist", this);
            this.enter();
        }

        // Call all update callbacks
        this.updateCallbacks.forEach(callback => callback.bind(this)());

        // Clear the update callbacks
        this.updateCallbacks = [];
    }

}

