import { Point } from "2d-geometry";
import { BoundingBox, SvgRenderable } from "../visGraph/renderer/renderer";

export type Alignment = 'center-left' | 'center-right' | 'center-top' | 'center-bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

export class Label2d extends SvgRenderable {

    elRoot?: d3.Selection<SVGGElement, unknown, null, undefined>;
    elSvg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    elText?: d3.Selection<SVGTextElement, unknown, null, undefined>;

    bBox: BoundingBox = { x: 0, y: 0, w: 0, h: 0 };


    // The width of the label
    width: number = 0;

    // The height of the label
    height: number = 0;

    // The anchor point of the label
    anchor: Point = new Point(0, 0);

    // The alignment of the label
    // alignment: Alignment = 'center';

    constructor(parent?: d3.Selection<SVGGElement, unknown, null, undefined>) {
        console.log('Creating Label2d', parent);
        super();
        if (parent) {
            this.parentElement = parent;
            this.addSubElements();
        }
    }

    override updateVisibleArea(visibleArea: BoundingBox): void {
        return;
    }
    override subElementsExist(): boolean {
        return this.elSvg !== undefined && this.elText !== undefined;
    }
    override addSubElements(): void {
        if (!this.parentElement) {
            console.error('No parent element set for Label2d');
            return;
        }

        this.elRoot = this.elRoot ?? this.parentElement.append("g");
        this.elSvg = this.elSvg ?? this.elRoot.append("svg")
        this.elText = this.elText ?? this.elSvg.append("text")
            .attr("x", 0).attr("y", 0).attr('pointer-events', 'none');
        
        console.log('Added sub elements for Label2d', this.elRoot, this.elSvg, this.elText);
    }
    override removeSubElements(): void {
        this.elText?.remove();
        this.elSvg?.remove();
    }

    // The text of the label
    _text: string = '';

    text(text: string) {
        this._text = text;
        this.elText?.text(text);

        this.updateBBox();
        return this;
    }

    setPos(x: number, y: number) {
        this.elRoot?.attr('transform', `translate(${x}, ${y})`);
    }

    updateBBox() {
        const bbox = this.elText?.node()?.getBBox();
        if (bbox) {
            this.bBox = { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
        }

        this.elSvg?.attr('viewBox', `${this.bBox.x} ${this.bBox.y} ${this.bBox.w} ${this.bBox.h}`);
    }

    setWidth(w: number) {
        const h = this.bBox.w * w / this.bBox.h;
        this.elSvg?.attr('width', w).attr('height', h);
        
        this.width = w;
        this.height = h;

        return this;
    }

    setHeight(h: number) {
        const w = this.bBox.h * h / this.bBox.w;
        this.elSvg?.attr('width', w).attr('height', h);

        this.width = w;
        this.height = h;

        return this;
    }


    setAlign(align: Alignment) {
        switch (align) {
            case 'center-left':
                this.elText?.attr('dominant-baseline', 'middle');
                this.elText?.attr('anchor', 'end');
                break;
            case 'center-right':
                this.elText?.attr('dominant-baseline', 'middle');
                this.elText?.attr('anchor', 'start');
                break;
            case 'center-top':
                this.elText?.attr('dominant-baseline', 'hanging');
                this.elText?.attr('anchor', 'middle');
                break;
            case 'center-bottom':
                this.elText?.attr('dominant-baseline', 'auto');
                this.elText?.attr('anchor', 'middle');
                break;
            case 'top-left':
                this.elText?.attr('dominant-baseline', 'hanging');
                this.elText?.attr('anchor', 'end');
                break;
            case 'top-right':
                this.elText?.attr('dominant-baseline', 'hanging');
                this.elText?.attr('anchor', 'start');
                break;
            case 'bottom-left':
                this.elText?.attr('dominant-baseline', 'auto');
                this.elText?.attr('anchor', 'end');
                break;
            case 'bottom-right':
                this.elText?.attr('dominant-baseline', 'auto');
                this.elText?.attr('anchor', 'start');
                break;
            case 'center':
                this.elText?.attr('dominant-baseline', 'middle');
                this.elText?.attr('anchor', 'middle');
                break;
        }

        return this;
    }
}

