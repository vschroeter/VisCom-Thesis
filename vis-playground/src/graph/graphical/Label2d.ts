import { Point } from "2d-geometry";
import { BoundingBox, SvgRenderable } from "../visGraph/renderer/renderer";

export type Alignment = 'center-left' | 'center-right' | 'center-top' | 'center-bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

export class Label2d extends SvgRenderable {

    elRoot?: d3.Selection<SVGGElement, unknown, null, undefined>;
    elGroup?: d3.Selection<SVGGElement, unknown, null, undefined>;
    elSvg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    elText?: d3.Selection<SVGTextElement, unknown, null, undefined>;

    bBox: BoundingBox = { x: 0, y: 0, w: 0, h: 0 };

    _isVisible: boolean = true;
    get isVisible() {
        return this._isVisible;
    }
    set isVisible(value: boolean) {
        if (!value) this.elText?.text("");
        this._isVisible = value;
    }

    // The width of the label
    width: number = 0;

    // The height of the label
    height: number = 0;

    // The anchor point of the label
    anchor: Point = new Point(0, 0);

    // The alignment of the label
    alignment: Alignment = 'center';

    constructor(parent?: d3.Selection<SVGGElement, unknown, null, undefined>) {
        // console.log('Creating Label2d', parent);
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
        return this.elSvg !== undefined && this.elText !== undefined && this.elGroup !== undefined;
    }
    override addSubElements(): void {
        if (!this.parentElement) {
            console.error('No parent element set for Label2d');
            return;
        }

        this.elRoot = this.elRoot ?? this.parentElement.append("g");
        this.elSvg = this.elSvg ?? this.elRoot.append("svg")
        this.elGroup = this.elGroup ?? this.elSvg.append("g");
        this.elText = this.elText ?? this.elGroup.append("text")
            .attr("x", 0).attr("y", 0).attr('pointer-events', 'none');

        this.setTextAlign('bottom-left');
    }
    override removeSubElements(): void {
        this.elText?.remove();
        this.elGroup?.remove();
        this.elSvg?.remove();
    }

    // The text of the label
    _text: string = '';

    text(text: string) {
        if (!this.isVisible) return this;
        this._text = text;
        this.elText?.text(text);

        this.updateBBox();
        return this;
    }

    setAnchorPos(x: number, y: number) {
        this.anchor = new Point(x, y);
        this.updateTranslate();
    }

    updateBBox() {

        if (!this.isVisible) return this;

        // const bbox = this.elText?.node()?.getBBox();
        const bbox = this.elGroup?.node()?.getBBox({stroke: true, fill: true});
        if (bbox) {
            this.bBox = { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
        }


        // this.elSvg?.attr('viewBox', `${this.bBox.x - this.bBox.w / 2} ${this.bBox.y - this.bBox.h / 2} ${this.bBox.w * 2} ${this.bBox.h * 2}`);
        this.elSvg?.attr('viewBox', `${this.bBox.x} ${this.bBox.y} ${this.bBox.w} ${this.bBox.h}`);
    }

    setWidth(w: number) {
        if (!this.isVisible) return this;
        const h = this.getHeightForWidth(w);
        this.elSvg?.attr('width', w).attr('height', h);

        this.width = w;
        this.height = h;

        return this;
    }

    getHeightForWidth(w: number) {
        return this.bBox.h * w / this.bBox.w;
    }

    getWidthForHeight(h: number) {
        return this.bBox.w * h / this.bBox.h;
    }

    setHeight(h: number) {
        if (!this.isVisible) return this;
        const w = this.getWidthForHeight(h);
        this.elSvg?.attr('width', w).attr('height', h);

        this.width = w;
        this.height = h;

        return this;
    }



    setAlignment(align: Alignment) {
        this.alignment = align;
        this.updateTranslate();
        return this;
    }



    protected updateTranslate() {

        if (!this.isVisible) return this;
        const p = this.anchor;
        const a = this.alignment;
        const w = this.width;
        const h = this.height;

        let x: Number = -10;
        let y: Number = -10;

        switch (a) {
            case 'center-left':
                x = p.x;
                y = p.y - h / 2;
                break;
            case 'center-right':
                x = p.x - w;
                y = p.y - h / 2;
                break;
            case 'center-top':
                x = p.x - w / 2;
                y = p.y;
                break;
            case 'center-bottom':
                x = p.x - w / 2;
                y = p.y - h;
                break;
            case 'top-left':
                x = p.x;
                y = p.y;
                break;
            case 'top-right':
                x = p.x - w;
                y = p.y;
                break;
            case 'bottom-left':
                x = p.x;
                y = p.y - h;
                break;
            case 'bottom-right':
                x = p.x - w;
                y = p.y - h;
                break;
            case 'center':
                x = p.x - w / 2;
                y = p.y - h / 2;
        }

        this.elRoot?.attr('transform', `translate(${x}, ${y})`);

    }

    protected setTextAlign(align: Alignment) {
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

        this.updateBBox();
        return this;
    }
}

