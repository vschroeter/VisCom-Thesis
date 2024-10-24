import _ from "lodash";


export type SvgUpdateCallback = (selection: d3.Selection<any, any, any, any>) => void;

// SvgElement one of "cirlce", "rect", "line", "path", "text", "g", "svg"
export class SvgRenderable {

    protected updateCallbacks: SvgUpdateCallback[] = [];

    protected parentSelection: d3.Selection<SVGGElement | any, any, any, any> | null = null;
    protected renderableSelection: d3.Selection<SVGGElement | any, any, any, any> | null = null;

    constructor(public svgElement: string = "g", public svgClass: string = "") {
    }

    ////////////////////////////////////////////////////////////////////////////
    // Internal selector methods
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Select the root element for the renderable.
     * @param selection Optional parent selection for the renderable. If not provided, the stored parent selection is used.
     * @returns The selection of renderable root elements
     */
    protected selectElement(selection?: d3.Selection<SVGGElement | any, any, any, any>): d3.Selection<SVGGElement | any, any, any, any> {
        const selector = this.svgElement + (this.svgClass !== "" ? ("." + this.svgClass) : "");
        const element = (selection ?? this.parentSelection)?.select(selector);
        if (!element) {
            console.error("Element not found", selector, selection, this.parentSelection);
            throw new Error("Element not found");
        }
        return element;
    }

    /**
     * Select sub elements of the renderable.
     * @param subElementSelector The subelement selector
     * @param selection Optional parent selection for the renderable. If not provided, the stored parent selection is used.
     * @returns Selection of sub elements from the renderable
     */
    protected selectSubElement(subElementSelector: string, selection?: d3.Selection<SVGGElement | any, any, any, any>): d3.Selection<SVGGElement | any, any, any, any> {
        const element = this.selectElement(selection);
        return element.select(subElementSelector);
    }

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
     * @param selection Optional parent selection to add the sub element to. If not provided, the root selection is used.
     */
    addSubElement(subElement: string, className?: string, selection?: d3.Selection<SVGGElement | any, any, any, any>): d3.Selection<SVGGElement | any, any, any, any> {
        const sub = this.selectElement(selection).append(subElement)
        if (className) {
            sub.classed(className, true);
        }
        return sub;
    }

    /**
     * Method to add sub elements to the renderable during the enter phase.
     * Override this method to add sub elements to the renderable.
     */
    addSubElements() {
        // By default, do nothing
    }

    /**
     * Method to add the renderable elements to the selection
     * @param selection The parent selection containing the renderable
     */
    enter(selection: d3.Selection<SVGGElement | any, any, any, any>): void {
        this.parentSelection = selection;
        this.renderableSelection = selection.append(this.svgElement)
        if (this.svgClass !== "") {
            this.renderableSelection.classed(this.svgClass, true);
        }

        this.addSubElements();
        // console.log("enter", this.renderableSelection)

        this.update(selection);
    }

    /**
     * Method to remove the renderable elements from the selection
     * @param selection The parent selection containing the renderable
     */
    exit(selection: d3.Selection<SVGGElement | any, any, any, any>): void {
        selection.remove();
    }

    /**
     * Method to update the renderable elements in the selection
     * @param selection The parent selection containing the renderable
     */
    update(selection: d3.Selection<SVGGElement | any, any, any, any>): void {
        this.parentSelection = selection;
        const element = this.selectElement(selection);

        // Call all update callbacks
        this.updateCallbacks.forEach(callback => element.call(callback.bind(this)));

        // Clear the update callbacks
        this.updateCallbacks = [];
    }

}

