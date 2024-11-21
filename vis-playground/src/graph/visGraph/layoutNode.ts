import { Circle, Point, Vector } from "2d-geometry";
import { CommunicationChannel, CommunicationGraph, CommunicationLink, CommunicationNode, CommunicationTopic } from "../commGraph";
import { CommonSettings } from "../layouter/settings/commonSettings";

import * as d3 from "d3";
import { VisGraph } from "./visGraph";
import { LayoutConnection } from "./layoutConnection";
import { Sorter } from "../algorithms/sortings/sorting";
import { BasicSizeCalculator } from "./layouterComponents/precalculator";
import { BasePositioner } from "./layouterComponents/positioner";
import { BaseConnectionLayouter, BaseNodeConnectionLayouter } from "./layouterComponents/connectionLayouter";
import { Anchor, Node2d } from "../graphical";

export type InstanceOrGetter<T> = T | ((node: LayoutNode) => T);

export class LayoutNode {

    // Reference to the vis graph
    visGraph: VisGraph;

    // The id of the node
    id: string;

    ////////////////////////////////////////////////////////////////////////////
    // Constructor
    ////////////////////////////////////////////////////////////////////////////

    constructor(graph: VisGraph, id: string) {
        this.visGraph = graph;
        this.id = id;
    }

    // The related communication node. Hypernodes with child nodes do not have a single related communication node.
    commNode?: CommunicationNode;

    // Parent node, if any
    parent?: LayoutNode;

    // Child nodes, if any
    children: LayoutNode[] = [];


    _index = -1;
    // The index of the node in the parent's children list or the manually set index
    get index(): number {
        if (this._index >= 0) {
            return this._index;
        }
        return this.parent?.children.indexOf(this) ?? -1;
    }
    // Set the node's index manually. If not set, the index is determined by the parent's children list.
    set index(index: number) {
        this._index = index;
    }

    // // Type of VisNode (TODO: Maybe we don't need this or make it more flexible)
    // nodeType: "normal" | "community" | "stronglyCoupled" | "broadcasting" | "similarConnections" = "normal";

    // // TODO: Associated nodes (somehow, we have to store e.g. duplicated nodes, that are related to this node)
    // associatedNodes: LayoutNode[] = [];

    ////////////////////////////////////////////////////////////////////////////
    // Layout Parts
    ////////////////////////////////////////////////////////////////////////////

    // The precalculator for the node (e.g. for calculating the size of the node)
    precalculator?: InstanceOrGetter<BasicSizeCalculator> = new BasicSizeCalculator();

    // The positioner for the node (for positioning the children of the node during the layouting process)
    positioner?: InstanceOrGetter<BasePositioner>;

    // The sorter for the node (for sorting the children of the node before layouting)
    sorter?: InstanceOrGetter<Sorter>;

    // The connector for the node
    connectionLayouter?: InstanceOrGetter<BaseNodeConnectionLayouter>;

    // // List of connections, that are waiting for this node to be layouted
    // connectionsWaitingForLayout: VisConnection[] = [];

    // Outgoing connections to other nodes
    outConnections: LayoutConnection[] = [];
    // Incoming connections from other nodes
    inConnections: LayoutConnection[] = [];

    // The layer of the node (for layered layouting). Leaf nodes have layer 0.
    protected _layer: number = 0;
    protected _layerCount: number = 0;
    get layerFromTop(): number {
        return this._layer;
    }
    get layerFromBot(): number {
        return this._layerCount - this._layer - 1;
    }

    setLayer(layerFromTop: number, layerCount: number) {
        this._layer = layerFromTop;
        this._layerCount = layerCount;
    }

    // If the node has a graphical representation at all for rendering
    hasGraphicalRepresentation: boolean = true;

    ////////////////////////////////////////////////////////////////////////////
    // Ancestor and descendant methods
    ////////////////////////////////////////////////////////////////////////////

    static firstCommonParent(node1: LayoutNode, node2: LayoutNode): LayoutNode | undefined {
        let parent: LayoutNode | undefined = node1;
        while (parent) {
            if (node2.isDescendantOf(parent)) {
                return parent;
            }
            parent = parent.parent;
        }
        return undefined;
    }

    getParent(condition?: (parent: LayoutNode) => boolean): LayoutNode | undefined {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let parent: LayoutNode | undefined = this;
        if (!condition) {
            return parent.parent;
        }
        while (parent) {
            if (condition(parent)) {
                return parent;
            }
            parent = parent.parent;
        }
        return undefined;
    }

    isDescendantOf(node: LayoutNode): boolean {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let parent: LayoutNode | undefined = this;

        while (parent) {
            if (parent == node) {
                return true;
            }
            parent = parent.parent;
        }
        return false;
    }

    isAncestorOf(node: LayoutNode): boolean {
        return node.isDescendantOf(this);
    }

    isChildOf(node: LayoutNode): boolean {
        return this.parent == node;
    }

    isParentOf(node: LayoutNode): boolean {
        return node.isChildOf(this);
    }

    get descendants(): LayoutNode[] {
        const descendants: LayoutNode[] = [];
        this.children.forEach(child => {
            descendants.push(child);
            descendants.push(...child.descendants);
        });
        return descendants;
    }

    get ancestors(): LayoutNode[] {
        const ancestors: LayoutNode[] = [];
        let parent = this.parent;
        while (parent) {
            ancestors.push(parent);
            parent = parent.parent;
        }
        return ancestors;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Information about the node
    ////////////////////////////////////////////////////////////////////////////

    // The score of the node (e.g. for ranking the significance of nodes)
    score: number = 0;

    get inDegree(): number {
        return this.inConnections.length;
    }

    get outDegree(): number {
        return this.outConnections.length;
    }

    get degree(): number {
        return this.inDegree + this.outDegree;
    }

    get successorCount(): number {
        // return this.successorNodes.length;
        return this.getSuccessors().length;
    }

    get predecessorCount(): number {
        // return this.predecessorNodes.length;
        return this.getPredecessors().length;
    }

    isDirectSuccessorInSortingTo(node: LayoutNode): boolean {
        const parent = this.parent;
        const otherParent = node.parent;

        if (!parent || !otherParent) {
            return false;
        }

        if (parent != otherParent) {
            return false;
        }

        const startIndex = node.index;
        const endIndex = this.index;
        const isDirectLink = (endIndex - startIndex) == 1 || (startIndex - endIndex) == ((parent?.children.length ?? 0) - 1);
        return isDirectLink;
    }

    isDirectPredecessorInSortingTo(node: LayoutNode): boolean {
        return node.isDirectSuccessorInSortingTo(this);
    }

    getNextNodeInSorting(): LayoutNode | undefined {
        if (!this.parent) {
            return undefined;
        }
        const nextIndex = (this.index + 1) % this.parent.children.length;
        return this.parent.children[nextIndex];
    }

    getPreviousNodeInSorting(): LayoutNode | undefined {
        if (!this.parent) {
            return undefined;
        }
        const previousIndex = (this.index - 1 + this.parent.children.length) % this.parent.children.length;
        return this.parent.children[previousIndex];
    }



    ////////////////////////////////////////////////////////////////////////////
    // Position and size of the node
    ////////////////////////////////////////////////////////////////////////////
    /**
     * The radius should be calculated by the precalculator or the layouter during the layouting process, based on the score and children of the node.
     */
    radius: number = 0;

    // For child node placements inside this node
    _innerRadius?: number;

    // For connections to this node
    _outerRadius?: number;
    get innerRadius(): number {
        return this._innerRadius ?? this.radius;
    }
    set innerRadius(value: number) {
        this._innerRadius = value;
    }

    get outerRadius(): number {
        return this._outerRadius ?? this.radius;
    }
    set outerRadius(value: number) {
        this._outerRadius = value;
    }

    sizeFactor: number = 1;

    center: Point = new Point(0, 0);

    get x(): number { return this.center.x; }
    get y(): number { return this.center.y; }
    set x(x: number) { this.center.x = x; }
    set y(y: number) { this.center.y = y; }

    // The circle object representing the node
    get circle() {
        return new Circle(this.center, this.radius);
    }

    get innerCircle() {
        return new Circle(this.center, this.innerRadius);
    }

    get outerCircle() {
        return new Circle(this.center, this.outerRadius);
    }

    get translationRelativeToParent(): Vector {
        return new Vector(this.center.x - (this.parent?.center.x ?? 0), this.center.y - (this.parent?.center.y ?? 0));
    }

    ////////////////////////////////////////////////////////////////////////////
    // Style of the node
    ////////////////////////////////////////////////////////////////////////////

    // The color of the node. If not set, the color is determined by default values, scoring and user interaction.
    color?: string;

    childrenColorScheme?: (t: number) => string;
    childrenColorSchemeRange: [number, number] = [0, 1];

    // The stroke color of the node. If not set, the color is determined by default values, scoring and user interaction.
    stroke?: string;

    // The stroke width of the node
    strokeWidth?: number;

    // // The fill color of the node
    // fill?: string;

    filled: boolean = true;

    strokeColor?: string;

    label?: string;
    showLabel: boolean = true;

    applyChildrenColorScheme(scheme: (t: number) => string, range: [number, number]) {
        this.childrenColorScheme = scheme;
        this.childrenColorSchemeRange = range;

        const min = range[0];
        const max = range[1];
        let mid = 0;
        if (min < max) {
            mid = (min + max) / 2;
        } else {
            // Becausem it's cyclic
            mid = (min + max + 1) / 2;
            if (mid > 1) {
                mid -= 1;
            }
        }

        this.color = scheme(mid);

        const rangeDiff = range[1] - range[0];

        this.children.forEach((child, i, arr) => {
            const t = i / (arr.length);
            const t1 = (i + 1) / (arr.length);
            const start = range[0] + rangeDiff * t;
            const end = range[0] + rangeDiff * t1;
            child.applyChildrenColorScheme(scheme, [start, end]);
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Connection methods
    ////////////////////////////////////////////////////////////////////////////

    getBidirectionalConnections(channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.outConnections.filter(c => c.opposite !== undefined);
    }

    getOutgoingConnections(channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.outConnections;
    }

    getIncomingConnections(channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.inConnections;
    }

    // TODO: Channel einbauen
    getSuccessors(channels?: CommunicationChannel[]): LayoutNode[] {
        // if (channels) {
        //     const channelTypes = channels.map(c => c.type);
        //     return this.outConnections.filter(c => c.links.some(l => channelTypes.include(l.channel.type))).map(c => c.target);
        // }
        return this.outConnections.map(c => c.target);
    }

    getPredecessors(channels?: CommunicationChannel[]): LayoutNode[] {
        return this.inConnections.map(c => c.source);
    }


    ////////////////////////////////////////////////////////////////////////////
    // Anchor methods
    ////////////////////////////////////////////////////////////////////////////


    /**
     * Get the anchor of the node directed towards a given point
     * @param point The point, towards which the anchor should be directed
     */
    getAnchor(point: Point): Anchor;
    /**
     * Get the anchor of the node directed towards a given vector
     * @param vector The vector originating from the node's center, towards which the anchor should be directed
     */
    getAnchor(vector: Vector): Anchor;
    getAnchor(param: Point | Vector): Anchor {

        // TODO: This is for round nodes only

        let vector: Vector | null = null;
        if (param instanceof Point) {
            vector = new Vector(param.x - this.center.x, param.y - this.center.y);
        } else if (param instanceof Vector) {
            vector = param;
        }

        if (!vector) {
            throw new Error("Invalid parameter type");
        }

        // For the abstract circle node, the direction is the same as the vector
        // The anchor point is the intersection of the circle and the vector

        const direction = vector;
        // console.log('[NODE] getAnchor', direction, this);
        let anchorPoint: Point;
        if (direction.length == 0) {
            anchorPoint = this.center;
        } else {
            anchorPoint = this.center.translate(direction.normalize().multiply(this.radius));
        }
        return new Anchor(anchorPoint, direction);

    }



    ////////////////////////////////////////////////////////////////////////////
    // Layouting methods
    ////////////////////////////////////////////////////////////////////////////
    protected getInstance<T>(instanceOrGetter: InstanceOrGetter<T>): T {
        if (instanceOrGetter instanceof Function) {
            return instanceOrGetter(this);
        }
        return instanceOrGetter;
    }

    calculateNodeSize(precalculatorOverride?: BasicSizeCalculator) {
        const _precalculator = this.getInstance(precalculatorOverride ?? this.precalculator);
        _precalculator?.precalculate(this, this.visGraph);
    }

    sortChildren(sorterOverride?: Sorter) {
        if (this.children.length == 0) return;

        const _sorter = this.getInstance(sorterOverride ?? this.sorter);
        if (!_sorter) {
            return;
        }

        this.children = _sorter.getSorting(this.children);
    }

    propagatePositionToChildNodes() {
        this.children.forEach(child => {
            child.center = child.center.translate(this.center);
        });
    }

    propagateSizeToChildNodes() {
        this.children.forEach(child => {

            const nodeSize = this.radius;
            const childSize = child.radius;
            // const parentSize = this.parent?.radius ?? this.radius;

            const nodeSizeFactor = this.sizeFactor;
            const childSizeFactor = nodeSizeFactor * (childSize / nodeSize);

            child.sizeFactor = childSizeFactor;
            // const parentSizeFactor = this.sizeFactor;
            // const parentSize = this.radius;
            // const childSize = child.radius;
            // const childSizeFactor = childSize / parentSize;
            // const combinedSizeFactor = parentSizeFactor * childSizeFactor;
            // child.sizeFactor = combinedSizeFactor;
        });
    }

    calculatePositionOfChildren(positionerOverride?: BasePositioner) {
        if (this.children.length == 0) return;

        const _positioner = this.getInstance(positionerOverride ?? this.positioner);
        _positioner?.positionChildren(this);
    }

    // calculateConnectionPoints(connectorOverride?: BaseConnectionLayouter) {
    //     this.outConnections.forEach(connection => {
    //         connection.calculateLayoutPoints(connectorOverride)
    //     });
    // }

    calculateConnections(connectionLayouterOverride?: BaseNodeConnectionLayouter) {
        const _connectionLayouter = this.getInstance(connectionLayouterOverride ?? this.connectionLayouter);
        _connectionLayouter?.layoutConnectionsOfNode(this);
    }

    resetConnectionPoints() {
        this.outConnections.forEach(connection => {
            connection.resetPoints();
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Rendering methods
    ////////////////////////////////////////////////////////////////////////////

    node2d: Node2d | undefined;

    createGraphicalElements() {
        if (this.hasGraphicalRepresentation && !this.node2d) {
            this.node2d = new Node2d(this);
        }

        this.outConnections.forEach(connection => {
            connection.createGraphicalElements();
        });
    }

    updateGraphicalLayout() {

        this.node2d?.updatePositionAndSize(this.center.x, this.center.y, this.radius);
        // this.node2d?.update();

        this.outConnections.forEach(connection => {
            connection.updatePoints();
        });
    }

}
