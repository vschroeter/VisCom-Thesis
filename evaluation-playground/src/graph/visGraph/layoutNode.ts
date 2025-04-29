import { Circle, Point, Segment, Shape, Vector } from "2d-geometry";
import { CommunicationChannel, CommunicationGraph, CommunicationLink, CommunicationNode, CommunicationTopic } from "../commGraph";
import { CommonSettings } from "../layouter/settings/commonSettings";

import * as d3 from "d3";
import { LayoutNodeOrId, VisGraph } from "./visGraph";
import { LayoutConnection } from "./layoutConnection";
import { Sorter } from "../algorithms/sortings/sorting";
import { BasicSizeCalculator } from "./layouterComponents/precalculator";
import { BasePositioner } from "./layouterComponents/positioner";
import { BaseConnectionLayouter, BaseNodeConnectionLayouter } from "./layouterComponents/connectionLayouter";
import { Anchor, Node2d } from "../graphical";
import { RadialUtils } from "../layouter/utils/radialUtils";

export type InstanceOrGetter<T> = T | ((node: LayoutNode) => T);

export class LayoutNode {

    // Reference to the vis graph
    visGraph: VisGraph;

    // The id of the node
    id: string;

    // Rendered shapes for debugging
    debugShapes: (Shape | Anchor)[] = [];

    ////////////////////////////////////////////////////////////////////////////
    // #region Constructor
    ////////////////////////////////////////////////////////////////////////////

    constructor(graph: VisGraph, id: string) {
        this.visGraph = graph;
        this.id = id;
    }

    clone(id: string, props: { cloneConnections: boolean, parent?: LayoutNode } = {
        cloneConnections: true
    }): LayoutNode {
        const clone = new LayoutNode(this.visGraph, id);
        clone.label = this.label;
        clone.score = this.score;

        const parent = props.parent ?? this.parent;

        this.visGraph.addNode(clone, parent);
        if (props.cloneConnections) {
            this.outConnections.forEach(connection => {
                this.visGraph.addLink(clone, connection.target, connection.getLinks());
            });
            this.inConnections.forEach(connection => {
                this.visGraph.addLink(connection.source, clone, connection.getLinks());
            });
        }
        return clone;
    }

    remove() {
        this.visGraph.removeNode(this);
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Node relations
    ////////////////////////////////////////////////////////////////////////////

    // The related communication node. Hypernodes with child nodes do not have a single related communication node.
    commNode?: CommunicationNode;

    // Parent node, if any
    parent?: LayoutNode;

    // Child nodes, if any
    children: LayoutNode[] = [];

    get isHyperNode(): boolean {
        return this.children.length > 0;
    }

    // If there are children, the anchor node is the defining node for position and alignment
    anchorNode?: LayoutNode;

    // If this node is the anchor node of its parent
    get isAnchor(): boolean {
        return this.parent?.anchorNode == this;
    }

    // If this node is a split node, this is the parent node
    splitParent?: LayoutNode;

    // If the node is a splitted node from another actual node
    get isSplitNode(): boolean {
        return this.splitParent != undefined;
    }

    // If this node is a split node, these are the children
    splitChildren: LayoutNode[] = [];


    // If this node is a virtual node, this is the parent node
    virtualParent?: LayoutNode;

    get isVirtual(): boolean {
        return this.virtualParent != undefined;
    }

    get hasVirtualChildren(): boolean {
        return this.virtualChildren.length > 0;
    }

    // If the node is has virtual child nodes, these are the children
    virtualChildren: LayoutNode[] = [];


    // Map to store, if for a given node id, a virtual child node exists
    existingVirtualChildren: Map<string, LayoutNode> = new Map();

    get isRealNode(): boolean {
        return !this.isVirtual && !this.isSplitNode && !this.isHyperNode;
    }

    addSplitChild(child: LayoutNode) {
        this.splitChildren.push(child);
        child.splitParent = this;
    }

    addVirtualChild(child: LayoutNode) {
        this.virtualChildren.push(child);
        child.virtualParent = this;

        child.parent?.existingVirtualChildren.set(this.id, child);
    }

    static moveNodesToParent(nodes: LayoutNode[], newParentNode: LayoutNode) {
        nodes.forEach(node => {
            const oldParent = node.parent;
            // if (oldParent) {
            //     oldParent.children.splice(oldParent.children.indexOf(node), 1);
            // }
            // node.parent = newParentNode;
            // newParentNode.children.push(node);
            node.moveNodeToParent(newParentNode);

            // We can check here, if the old parent now only contains the new parent as single child
            // If so, we can move the children of the new parent to the old parent and remove the new parent
            if (oldParent && oldParent.children.length === 1 && oldParent.children[0] === newParentNode) {
                LayoutNode.moveNodesToParent(Array.from(newParentNode.children), oldParent);
                newParentNode.remove();
            }

        });
    }

    moveNodeToParent(newParent: LayoutNode) {
        const oldParent = this.parent;
        if (oldParent) {
            oldParent.children.splice(oldParent.children.indexOf(this), 1);
            const virtualParent = this.virtualParent;
            if (virtualParent) {
                oldParent.existingVirtualChildren.delete(virtualParent.id);
                newParent.existingVirtualChildren.set(virtualParent.id, this);
            }
        }
        this.parent = newParent;
        newParent.children.push(this);
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Layout Parts
    ////////////////////////////////////////////////////////////////////////////

    private _index = -1;
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

    // The precalculator for the node (e.g. for calculating the size of the node)
    precalculator?: InstanceOrGetter<BasicSizeCalculator> = new BasicSizeCalculator();

    // The positioner for the node (for positioning the children of the node during the layouting process)
    positioner?: InstanceOrGetter<BasePositioner>;

    // The sorter for the node (for sorting the children of the node before layouting)
    sorter?: InstanceOrGetter<Sorter>;

    // The layouter (or list of layouters) to calculate the connections of the node
    connectionLayouter: BaseNodeConnectionLayouter | BaseNodeConnectionLayouter[] = new BaseNodeConnectionLayouter();
    protected _currentConnectionLayouterIndex = 0;

    // Outgoing connections to other nodes
    outConnections: LayoutConnection[] = [];
    // Incoming connections from other nodes
    inConnections: LayoutConnection[] = [];

    get outConnectionsWithoutSelfLoops(): LayoutConnection[] {
        return this.outConnections.filter(c => c.source.id != c.target.id);
    }

    get inConnectionsWithoutSelfLoops(): LayoutConnection[] {
        return this.inConnections.filter(c => c.source.id != c.target.id);
    }

    // The layer of the node (for layered layouting). Leaf nodes have layer 0.
    protected _layer: number = 0;
    protected _layerCount: number = 0;
    get layerFromTop(): number {
        return this._layer;
    }
    get layerFromBot(): number {
        return this._layerCount - this._layer - 1;
    }

    // Set the layer of the node (for layered layouting)
    setLayer(layerFromTop: number, layerCount: number) {
        this._layer = layerFromTop;
        this._layerCount = layerCount;
    }

    // If the node has a graphical representation at all for rendering
    hasGraphicalRepresentation: boolean = true;

    ////////////////////////////////////////////////////////////////////////////
    // #region Ancestor & Descendant Methods
    ////////////////////////////////////////////////////////////////////////////

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


    /**
     * Get the first common parent of two nodes
     * @param node1 Node 1
     * @param node2 Node 2
     * @returns The first common parent of the two nodes, if any
     */
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

    /**
     * Get the first common parent of this node and the given node.
     * @param node The other node
     * @returns The first common parent of the two nodes, if any
     */
    getCommonParent(node: LayoutNode): LayoutNode | undefined {
        return LayoutNode.firstCommonParent(this, node);
    }

    /**
     * If node is a descendant of this node, return the direct child node that contains the given node as a descendant.
     * E.g.: root->1->2->3, root.getChildNodeContainingNodeAsDescendant(3) would return 1
     * @param node The descendant to search for
     */
    getChildNodeContainingNodeAsDescendant(node: LayoutNode): LayoutNode | undefined {
        if (node.parent == this) {
            return node;
        }

        let parent: LayoutNode | undefined = node.parent;
        while (parent) {
            if (parent.parent == this) {
                return parent;
            }
            parent = parent.parent;
        }

        return undefined;
    }

    // /**
    //  * Returns the parent node of the node that has the same parent as the given node.
    //  * So having nodes root->1->2->3 and root->1->4,
    //  * 3.getParentNodeHavingTheSameParentAs(4) would return 2
    //  * @param node The other node
    //  * @returns The parent node that has the same parent as the given node, if any
    //  */
    // getParentNodeHavingTheSameDirectParentAs(node: LayoutNode): LayoutNode | undefined {
    //     if (this.parent == node.parent) {
    //         return this
    //     }

    //     let parent: LayoutNode | undefined = this.parent;
    //     while (parent) {
    //         if (parent.parent == node.parent) {
    //             return parent;
    //         }
    //         parent = parent.parent;
    //     }
    //     return undefined;
    // }

    /**
     * Returns the first parent of the node that satisfies a given condition
     * @param condition The condition that the parent node should satisfy
     * @returns The first parent node that satisfies the condition, if any
     */
    getFirstParentByCondition(condition?: (parent: LayoutNode) => boolean): LayoutNode | undefined {
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

    /**
     * @param node The other node
     * @returns True, if the node is a descendant of the other node
     */
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

    /**
     * @param node The other node
     * @returns True, if the node is an ancestor of the other node
     */
    isAncestorOf(node: LayoutNode): boolean {
        return node.isDescendantOf(this);
    }

    /**
     * @param node The other node
     * @returns True, if the node is a child of the other node
     */
    isChildOf(node: LayoutNode): boolean {
        return this.parent == node;
    }

    /**
     * @param node The other node
     * @returns True, if the node is a parent of the other node
     */
    isParentOf(node: LayoutNode): boolean {
        return node.isChildOf(this);
    }

    /**
     * The descendants of the node
     */
    get descendants(): LayoutNode[] {
        const descendants: LayoutNode[] = [];
        this.children.forEach(child => {
            descendants.push(child);
            descendants.push(...child.descendants);
        });
        return descendants;
    }

    /**
     * The successors of the node
     */
    get successors(): LayoutNode[] {
        return this.getSuccessors();
    }

    /**
     * The predecessors of the node
     */
    get predecessors(): LayoutNode[] {
        return this.getPredecessors();
    }

    /**
     * The ancestors of the node
     */
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
    // #region Connection Methods
    ////////////////////////////////////////////////////////////////////////////

    getConnectionTo(node: LayoutNodeOrId): LayoutConnection | undefined {
        const target = this.visGraph.getNode(node)
        return this.visGraph.getConnectionBetweenNodes(this, target);
    }

    getBidirectionalConnections(channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.outConnections.filter(c => c.opposite !== undefined);
    }

    getOutgoingConnections(channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.outConnections;
    }

    getIncomingConnections(channels?: CommunicationChannel[]): LayoutConnection[] {
        return this.inConnections;
    }

    removeConnections(predicate: (connection: LayoutConnection) => boolean) {

        const connectionsToRemove = [
            ...this.inConnections.filter(predicate),
            ...this.outConnections.filter(predicate)
        ]

        // Remove the connections at this and the other nodes
        connectionsToRemove.forEach(connection => {
            connection.remove();
        });
    }

    removeHyperConnections(predicate: (connection: LayoutConnection) => boolean = () => true) {
        this.removeConnections(c => c.isHyperConnection && predicate(c));
    }

    removeCalculatedHyperConnections() {
        this.removeHyperConnections(c => c.isCalculated);
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Node Information
    ////////////////////////////////////////////////////////////////////////////

    // The score of the node (e.g. for ranking the significance of nodes)
    score: number = 0;

    get scoreIncludingChildren(): number {
        return this.children.reduce((acc, child) => acc + child.scoreIncludingChildren, this.score);
    }

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

    isDirectSuccessorInSortingTo(node?: LayoutNode): boolean {

        if (!node) return false;

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

    isDirectPredecessorInSortingTo(node?: LayoutNode): boolean {
        return node?.isDirectSuccessorInSortingTo(this) ?? false;
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

    getIndexOfNodeContainingDescendant(descendant: LayoutNode): number {
        let node: LayoutNode | undefined = descendant;
        while (node?.parent != this) {
            if (!node) {
                return -1;
            }
            node = node.parent;
        }

        return node.index;
    }

    getNodeAtIndex(index: number): LayoutNode {
        index = (index + this.children.length) % this.children.length;
        return this.children[index];
    }



    ////////////////////////////////////////////////////////////////////////////
    // #region Position & Size of the Node
    ////////////////////////////////////////////////////////////////////////////
    /**
     * The radius should be calculated by the precalculator or the layouter during the layouting process, based on the score and children of the node.
     */
    radius: number = 0;

    // For child node placements inside this node
    _innerRadius?: number;

    // For connections to this node
    _outerRadius?: number;

    _innerEnclosingRadius?: number = 0;

    /**
     * The inner radius of the node.
     * For hypernodes, this is the radius of the inner circle on which  the child nodes are placed.
     * For normal nodes, this is the same as the radius.
     */
    get innerRadius(): number {
        return this._innerRadius ?? this.radius;
    }

    set innerRadius(value: number) {
        this._innerRadius = value;
    }

    set innerEnclosingRadius(value: number) {
        this._innerEnclosingRadius = value;
    }

    get innerEnclosingRadius(): number {
        if (this._innerEnclosingRadius) {
            return this._innerEnclosingRadius;
        }
        return this.innerRadius;
    }

    /**
     * If the enclosing circle of the node is adapted, this is the translation of the inner circle.
     * This is used for reducing the unused space in hypernodes when the child nodes have different sizes.
     */
    innerCenterTranslation: Vector = new Vector(0, 0);

    /**
     * The outer radius of the node.
     * This can be the radius of the node adapted by a margin factor.
     */
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

    /**
     * The circle representing the node.
     */
    get circle() {
        return new Circle(this.center, this.radius);
    }

    /**
     * The circle where the child nodes are placed on.
     */
    get innerCircle() {
        return new Circle(this.center.translate(this.innerCenterTranslation.scale(-1)), this.innerRadius);
    }

    /**
     * The inner circle of the node enclosing the child nodes.
     */
    get innerEnclosingCircle() {
        return new Circle(this.center.translate(this.innerCenterTranslation.scale(-1)), this.innerEnclosingRadius);
    }

    /**
     * The circle where the connections to the node are placed on.
     * This is normally a little bit larger than the node circle so that the connections do not overlap with the node.
     */
    get outerCircle() {
        return new Circle(this.center, this.outerRadius);
    }

    get translationRelativeToParent(): Vector {
        return new Vector(this.center.x - (this.parent?.center.x ?? 0), this.center.y - (this.parent?.center.y ?? 0));
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Transformation Methods for the Node
    ////////////////////////////////////////////////////////////////////////////

    rotateChildrenLocally(rad: number, center: Point = new Point(0, 0)) {
        this.innerCenterTranslation = this.innerCenterTranslation.rotate(rad);
        this.children.forEach(child => {
            child.center = child.center.rotate(rad, center);
            child.rotateChildrenLocally(rad, center);
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Style of the node
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
    // #region Anchor methods
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

    getValidInnerRadRange(factor = 1, isHyperNode = false): [number, number] {

        const parent = this.parent;
        const nextNode = this.getNextNodeInSorting();
        const previousNode = this.getPreviousNodeInSorting();
        if (!parent || !nextNode || !previousNode) {
            return [0, 0];
        }

        let range = [0, 0];



        const nextTangents = RadialUtils.getTangentsFromPointToCircle(this.center, nextNode.outerCircle);
        const prevTangents = RadialUtils.getTangentsFromPointToCircle(this.center, previousNode.outerCircle);

        let nextTangent = RadialUtils.getClosestShapeToPoint(nextTangents, parent.center, (tangent) => tangent.end);
        let prevTangent = RadialUtils.getClosestShapeToPoint(prevTangents, parent.center, (tangent) => tangent.end);


        // When this node is a hyper node, we take the lines to the next and prev centers
        if (isHyperNode) {
            nextTangent = new Segment(this.center, nextNode.center);
            prevTangent = new Segment(this.center, previousNode.center);
        }


        if (nextNode == previousNode) {
            nextTangent = nextTangents[0];
            prevTangent = nextTangents[1];
        }

        if (!nextTangent || !prevTangent) {
            return [0, 0];
        }

        const nextRad = RadialUtils.radOfPoint(nextTangent.end, this.center);
        const prevRad = RadialUtils.radOfPoint(prevTangent.end, this.center);
        range = [nextRad, prevRad];

        if (nextNode == previousNode) {

            const nodeRad = RadialUtils.radOfPoint(nextNode.center, this.center);

            if (RadialUtils.radIsBetween(nodeRad, prevRad, nextRad)) {
                range = [prevRad, nextRad];
            } else {
                range = [nextRad, prevRad];
            }

            // Double the range size
            const diff = RadialUtils.forwardRadBetweenAngles(range[0], range[1]);
            const mid = range[0] + diff / 2;
            range = [mid - diff, mid + diff];

        }

        if (factor != 1) {
            const diff = RadialUtils.forwardRadBetweenAngles(range[0], range[1]);
            const mid = range[0] + diff / 2;
            range = [mid - diff / 2 * factor, mid + diff / 2 * factor];
        }
        range.forEach((rad, i, arr) => {
            arr[i] = RadialUtils.normalizeRad(rad);
        });
        return range as [number, number];
    }

    /**
     * Get the valid range of the node in radians.
     * @param factor Shrink or stretch factor for the range
     * @param includeParentCircle If true, not only the neighboring nodes are considered for the valid range, but also the parent circle.
     * @returns
     */
    getValidOuterRadRange(factor = 1, includeParentCircle = true): [number, number] {



        const onlyOneNodeInHyperNode = this.parent?.children.length == 1;

        // If there is only one node in the hypernode, we can assign the full range as outer range
        if (onlyOneNodeInHyperNode) {
            const fromCenterSlope = new Vector(this.parent!.parent!.center!, this.center).rotate(0).slope;
            return [fromCenterSlope + 0.1, fromCenterSlope - 0.1];
        }


        const parent = this.parent;
        const nextNode = this.getNextNodeInSorting();
        const previousNode = this.getPreviousNodeInSorting();
        let range = [0, 0];

        if (!parent || !nextNode || !previousNode) {
            return range as [number, number];
        }

        // We calculate the tangents to the outer circle of the next and previous node
        // These tangents define the valid range for the outer radius of the node
        const nextTangents = RadialUtils.getTangentsFromPointToCircle(this.center, nextNode.outerCircle);
        const prevTangents = RadialUtils.getTangentsFromPointToCircle(this.center, previousNode.outerCircle);

        // Take the outer tangents
        let nextTangent = RadialUtils.getFurthestShapeToPoint(nextTangents, parent.center, (tangent) => tangent.end);
        let prevTangent = RadialUtils.getFurthestShapeToPoint(prevTangents, parent.center, (tangent) => tangent.end);

        // If there is only one other node, we take the both tangents to it
        if (nextNode == previousNode) {
            nextTangent = nextTangents[0];
            prevTangent = nextTangents[1];
        }

        if (!nextTangent || !prevTangent) {
            return range as [number, number];
        }

        const nextRad = RadialUtils.radOfPoint(nextTangent.end, this.center);
        const prevRad = RadialUtils.radOfPoint(prevTangent.end, this.center);

        range = [prevRad, nextRad];

        // If there is only one other node, we have to sort the radians correctly
        if (nextNode == previousNode) {
            const nodeRad = RadialUtils.radOfPoint(nextNode.center, this.center);

            // Bring the radians into the correct order
            if (RadialUtils.radIsBetween(nodeRad, prevRad, nextRad)) {
                range = [nextRad, prevRad];
            } else {
                range = [prevRad, nextRad];
            }
        }

        // If the parent circle should be included in the range, we check which of both ranges is smaller --> this one is the valid one
        if (includeParentCircle) {

            const parentCircle = parent.innerCircle;
            const parentCenterRad = RadialUtils.radOfPoint(parent.center, this.center);
            const circleIntersections = parentCircle.intersect(this.outerCircle);

            // There should be 2 intersections
            if (circleIntersections.length == 2) {

                // We calculate the angle of the intersection points
                let radCircleEnd = RadialUtils.radOfPoint(circleIntersections[0], this.center);
                let radCircleStart = RadialUtils.radOfPoint(circleIntersections[1], this.center);

                // Reorder the angles to have the correct range
                if (!RadialUtils.radIsBetween(parentCenterRad, radCircleEnd, radCircleStart)) {
                    [radCircleEnd, radCircleStart] = [radCircleStart, radCircleEnd];
                }

                // Now choose the range that is smaller
                const diffCircle = RadialUtils.forwardRadBetweenAngles(radCircleStart, radCircleEnd);
                const diffTangent = RadialUtils.forwardRadBetweenAngles(range[0], range[1]);

                if (diffCircle < diffTangent) {
                    range = [radCircleStart, radCircleEnd];
                }
            }
        }

        // If there is a stretch or shrink factor, we adjust the range
        if (factor != 1) {
            const diff = RadialUtils.forwardRadBetweenAngles(range[0], range[1]);
            const mid = range[0] + diff / 2;
            range = [mid - diff / 2 * factor, mid + diff / 2 * factor];
        }

        range.forEach((rad, i, arr) => {
            arr[i] = RadialUtils.normalizeRad(rad);
        });
        return range as [number, number];
    }


    getValidCircularRadRange(startRadiusFactor = 0.0, endRadiusFactor = -0.3, direction: "clockwise" | "counterclockwise"): [number, number] {

        if (!this.parent) return [0, 0];

        const center = this.center;
        const parentCenter = this.parent.innerCircle.center;

        const circle1 = this.parent.innerCircle.clone();
        const circle2 = this.parent.innerCircle.clone();

        const otherNode = direction == "clockwise" ? this.getNextNodeInSorting() : this.getPreviousNodeInSorting();
        const minRadius = Math.min(this.outerRadius, otherNode?.outerRadius ?? 0);
        circle1.r = circle1.r + minRadius * startRadiusFactor;
        circle2.r = circle2.r + minRadius * endRadiusFactor;

        const intersections1 = this.outerCircle.intersect(circle1);
        const intersections2 = this.outerCircle.intersect(circle2);

        // if (this.id.includes("hypernode") && this.children.length == 4 || this.children.length > 8) {
        //     circle2._data = { stroke: "green" };
        //     circle1._data = { stroke: "red" };
        //     this.debugShapes.push(circle1, circle2);
        //     this.debugShapes.push(...intersections1);
        //     this.debugShapes.push(...intersections2);


        //     console.warn("VALID", {
        //         id: this.id,
        //         c: this.children.length,
        //         other: otherNode?.id,
        //         dir: direction,
        //         minRadius,
        //         circle1: circle1.r,
        //         circle2: circle2.r,
        //     })

        // }

        if (intersections1.length != 2 || intersections2.length != 2) {

            // Clear the intersection arrays
            intersections1.splice(0, intersections1.length);
            intersections2.splice(0, intersections2.length);

            // Calculate new intersections based on the next parent center
            const nextParent = this.parent?.parent;

            if (nextParent) {

                const center = nextParent.innerCircle.center;
                const distanceToNode = center.distanceTo(this.center)[0]
                const _circle = new Circle(center, distanceToNode);

                const _circle1 = _circle.clone();
                const _circle2 = _circle.clone();

                // this.debugShapes.push(_circle, _circle1, _circle2);

                _circle1.r = _circle.r + minRadius * startRadiusFactor;
                _circle2.r = _circle.r + minRadius * endRadiusFactor;

                const _intersections1 = this.outerCircle.intersect(_circle1);
                const _intersections2 = this.outerCircle.intersect(_circle2);

                if (_intersections1.length == 2 && _intersections2.length == 2) {
                    intersections1.push(..._intersections1);
                    intersections2.push(..._intersections2);
                }
            }

            if (intersections1.length != 2 || intersections2.length != 2) {
                return [0, 0];
                // this.debugShapes.push(circle1, circle2, this.outerCircle, this.parent.innerCircle, center, parentCenter);

                // console.error("Invalid intersection points for circular range calculation", intersections1, intersections2, this.id);
                // throw new Error("Invalid intersection points for circular range calculation");
            }
        }

        const forwardIntersection1 = RadialUtils.forwardRadBetweenAngles(RadialUtils.radOfPoint(intersections1[0], parentCenter), RadialUtils.radOfPoint(intersections1[1], parentCenter)) < Math.PI ? intersections1[1] : intersections1[0];
        const backwardIntersection1 = forwardIntersection1 == intersections1[0] ? intersections1[1] : intersections1[0];

        const forwardIntersection2 = RadialUtils.forwardRadBetweenAngles(RadialUtils.radOfPoint(intersections2[0], parentCenter), RadialUtils.radOfPoint(intersections2[1], parentCenter)) < Math.PI ? intersections2[1] : intersections2[0];
        const backwardIntersection2 = forwardIntersection2 == intersections2[0] ? intersections2[1] : intersections2[0];

        if (direction == "clockwise") {
            return [RadialUtils.radOfPoint(forwardIntersection1, center), RadialUtils.radOfPoint(forwardIntersection2, center)];
        } else {
            return [RadialUtils.radOfPoint(backwardIntersection2, center), RadialUtils.radOfPoint(backwardIntersection1, center)];
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Layouting methods
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
        if (_sorter == undefined) {
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

    async calculatePositionOfChildren(positionerOverride?: BasePositioner) {
        if (this.children.length == 0) return;

        const _positioner = this.getInstance(positionerOverride ?? this.positioner);
        await _positioner?.positionChildren(this);
    }

    refinePositionOfChildren(positionerOverride?: BasePositioner) {
        if (this.children.length == 0) return;

        const _positioner = this.getInstance(positionerOverride ?? this.positioner);
        _positioner?.refinePositions(this);
    }

    // calculateConnectionPoints(connectorOverride?: BaseConnectionLayouter) {
    //     this.outConnections.forEach(connection => {
    //         connection.calculateLayoutPoints(connectorOverride)
    //     });
    // }

    ////////////////////////////////////////////////////////////////////////////
    // #region Connection layouting methods
    ////////////////////////////////////////////////////////////////////////////

    initConnectionLayouter() {
        this.outConnections.forEach(connection => {
            connection.resetPoints();
        });
        this._currentConnectionLayouterIndex = 0;
        // this.connectionLayouter = this.getInstance(this.connectionLayouter);
    }

    protected getConnectionLayouter(): BaseNodeConnectionLayouter[] {
        return (Array.isArray(this.connectionLayouter) ? this.connectionLayouter : [this.connectionLayouter]);
    }

    getConnectionLayouterByTag(tag: string): BaseNodeConnectionLayouter | undefined {
        return this.getConnectionLayouter().find(layouter => layouter.TAG == tag);
    }

    iterateConnectionLayouter(): boolean {
        const layouters = (Array.isArray(this.connectionLayouter) ? this.connectionLayouter : [this.connectionLayouter]);
        if (layouters.length == 0) {
            return false;
        }

        if (this._currentConnectionLayouterIndex >= layouters.length) {
            return false;
        }

        const layouter = layouters[this._currentConnectionLayouterIndex];
        // console.log('[NODE] iterateConnectionLayouter', this.id, layouter);
        layouter.layoutConnections(this);
        this._currentConnectionLayouterIndex++;
        return true;
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Rendering methods
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
