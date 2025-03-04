import { Anchor, EllipticArc } from "src/graph/graphical";
import { VisNode } from "./visNode";
import { Circle, Point, Vector } from "2d-geometry";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { VisConnection } from "./visConnection";
import { CombinedPathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { VisOrLayoutNode } from "./viscomConnectionLayouter";
import { RadialCircularArcConnectionLayouter } from "../radialConnections";
import { SmoothSplineSegment } from "src/graph/graphical/primitives/pathSegments/SmoothSpline";
import { DirectCircularArcConnectionMethod, DynamicSubPath } from "./dynamicSubPath";
import { RadialUtils } from "../../utils/radialUtils";


export type SubPathLevelType = "sameLevel" | "levelChanging"
export type SubPathConnectionType = "pathToNode" | "nodeToPath" | "nodeToNode" | "pathToPath";

export class SubPathGroup {

    _laidOutSubPath: SubPath | undefined;

    get laidOutSubPath(): SubPath | undefined {
        return this._laidOutSubPath;
    }

    set laidOutSubPath(subPath: SubPath) {
        this._laidOutSubPath = subPath;

        this.linkedSubPaths.forEach(sp => {
            sp.segments = [subPath];
        });
    }

    linkedSubPaths: SubPath[] = [];

    source: VisNode;
    target: VisNode;

    rangeRepresentative: SubPath | undefined;

    constructor(source: VisNode, target: VisNode) {
        this.source = source;
        this.target = target;
    }

    addSubPath(subPath: SubPath) {
        this.linkedSubPaths.push(subPath);

        if (!this.rangeRepresentative) {
            this.rangeRepresentative = subPath;
        }
    }
}



/**
 * Sub-paths are built the following:
 * - same-level sub-path: between nodes having the same parent is always a separate sub-path
 * - level-changing sub-path: between nodes that are part of same-level sub-paths
 *     - this also includes start or target to same-level sub-path
 *     - level-changing sub-paths don't have "only" nodes as source and target for the connection,
 *       but one side is the start or end of the higher level same-level sub-path as anchor
 */
export class SubPath extends CombinedPathSegment {


    ////////////////////////////////////////////////////////////////////////////
    // #region Path Information
    ////////////////////////////////////////////////////////////////////////////

    levelType: SubPathLevelType;
    connectionType: SubPathConnectionType;

    cachable = false;
    group?: SubPathGroup;

    visConnection: VisConnection;

    constraints: VisNode[] = [];
    nodePath: VisNode[] = [];

    get layouter() {
        return this.visConnection.layouter;
    }

    get id() {
        return this.sourceVisNode.id + " -> " + this.targetVisNode.id;
    }

    cachedSubPath?: SubPath;

    getOppositeNodeThan(node?: VisNode) {
        if (!node) return undefined;
        if (this.sourceVisNode == node) return this.targetVisNode;
        if (this.targetVisNode == node) return this.sourceVisNode;
        return undefined;
    }

    getLayoutNodeInDirectionOf(node?: VisNode) {
        if (!node) return undefined;
        if (this.sourceVisNode == node) return this.connectionSourceNode;
        if (this.targetVisNode == node) return this.connectionTargetNode;
        return undefined;
    }

    isCounterPathOf(path?: SubPath) {
        if (!path) return false;
        if (this.levelType != "sameLevel") return false;
        return this.sourceVisNode === path.targetVisNode && this.targetVisNode === path.sourceVisNode;
    }

    //++++ Type Determination ++++//

    hasSameParent() {
        // return this.source.parent === this.target.parent;
        return this.sourceVisNode.parent === this.targetVisNode.parent;
    }

    isCircleArcForward() {
        return this.sourceVisNode.layoutNode.isDirectPredecessorInSortingTo(this.targetVisNode.layoutNode);
    }

    isCircleArcBackward() {
        return this.sourceVisNode.layoutNode.isDirectSuccessorInSortingTo(this.targetVisNode.layoutNode);
    }

    isCircleArc() {
        return this.isCircleArcForward() || this.isCircleArcBackward();
    }




    ////////////////////////////////////////////////////////////////////////////
    // #region Nodes Information
    ////////////////////////////////////////////////////////////////////////////

    sourceVisNode: VisNode;
    targetVisNode: VisNode;


    get connectionSourceNode(): LayoutNode {
        return this.connection.source;
    }

    get connectionTargetNode(): LayoutNode {
        return this.connection.target;
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Level Information
    ////////////////////////////////////////////////////////////////////////////

    get level() {
        // return this.minLevelFromTop;
        return this.levelFromTop;
    }

    // get minLevelFromTop() {
    //     return Math.min(this.connectionSourceNode.layerFromTop, this.connectionTargetNode.layerFromTop);
    // }

    // get levelFromBot() {
    //     return Math.min(this.connectionSourceNode.layerFromBot, this.connectionTargetNode.layerFromBot);
    // }

    // get levelFromTop() {
    //     return Math.max(this.connectionSourceNode.layerFromTop, this.connectionTargetNode.layerFromTop);
    // }


    get minLevelFromTop() {
        return Math.min(this.sourceVisNode.layoutNode.layerFromTop, this.targetVisNode.layoutNode.layerFromTop);
    }

    get levelFromBot() {
        return Math.min(this.sourceVisNode.layoutNode.layerFromBot, this.targetVisNode.layoutNode.layerFromBot);
    }

    get levelFromTop() {
        return Math.max(this.sourceVisNode.layoutNode.layerFromTop, this.targetVisNode.layoutNode.layerFromTop);
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Level Changing Management
    ////////////////////////////////////////////////////////////////////////////

    previousSubPath?: SubPath;
    nextSubPath?: SubPath;

    /**
     * If the sub path is level changing, this is the fixed anchor of the connected parent sub path.
     */
    get fixedPathAnchor(): Anchor | undefined {
        if (this.connectionType == "nodeToNode") return undefined;

        if (this.connectionType == "nodeToPath") {
            return this.nextSubPath?.startAnchor;
        }

        if (this.connectionType == "pathToNode") {
            return this.previousSubPath?.endAnchor;
        }

        return undefined;
    }

    get fixedPathAnchorPoint(): Point | undefined {
        return this.fixedPathAnchor?.anchorPoint;
    }

    getDesiredNodeAnchor(sourceNode: VisNode): Anchor | undefined {

        const otherNode = this.getOppositeNodeThan(sourceNode);
        if (this.connectionType == "nodeToNode") {

            const otherLayoutNode = this.getLayoutNodeInDirectionOf(otherNode);
            if (!otherLayoutNode) return undefined;

            // return new Anchor(otherLayoutNode.center, new Vector(otherLayoutNode.center, sourceNode.center)).move(otherLayoutNode.outerCircle.r);
            return new Anchor(sourceNode.center, new Vector(sourceNode.center, otherLayoutNode.center)).move(sourceNode.outerCircle.r);
        }

        else if (this.connectionType == "nodeToPath") {
            const pathAnchor = this.nextSubPath?.startAnchor;

            if (sourceNode && pathAnchor) {

                const arcCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(sourceNode.layoutNode.center, pathAnchor);
                try {
                    const intersections = arcCircle ? sourceNode.outerCircle.intersect(arcCircle) : [];
                    const nodeIntersection = RadialUtils.getClosestShapeToPoint(intersections, pathAnchor.anchorPoint);
                    if (nodeIntersection) {
                        return new Anchor(nodeIntersection, new Vector(sourceNode.center, nodeIntersection));
                    }
                } catch (e) {
                    console.error("Error in direct circular arc connection layouting", {})
                    throw e;
                }
            }

            return pathAnchor;
        } else if (this.connectionType == "pathToNode") {

            const pathAnchor = this.previousSubPath?.endAnchor;

            if (sourceNode && pathAnchor) {

                const arcCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(sourceNode.layoutNode.center, pathAnchor);
                try {
                    const intersections = arcCircle ? sourceNode.outerCircle.intersect(arcCircle) : [];
                    const nodeIntersection = RadialUtils.getClosestShapeToPoint(intersections, pathAnchor.anchorPoint);
                    if (nodeIntersection) {
                        return new Anchor(nodeIntersection, new Vector(sourceNode.center, nodeIntersection));
                    }
                } catch (e) {
                    console.error("Error in direct circular arc connection layouting", {})
                    throw e;
                }
            }

            return pathAnchor;
        }

    }

    /**
     * The point of the connection on the other side than the given node.
     * @param node
     */
    getOppositeConnectionPoint(node: VisNode): Point | undefined {

        if (this.connectionType == "nodeToNode") {
            const otherNode = this.getOppositeNodeThan(node);
            return otherNode?.center;
        } else if (this.connectionType == "nodeToPath") {
            if (node == this.sourceVisNode) {
                // console.log("n2p next path", this.nextSubPath?.id, this.nextSubPath)
                return this.nextSubPath?.startAnchor?.anchorPoint;
            } else {
                // console.log("n2p source node")
                return this.sourceVisNode.center;
                // console.error(this, node);
                // throw new Error("Not implemented");
            }

        } else if (this.connectionType == "pathToNode") {

            if (node == this.targetVisNode) {
                // console.log("p2n prev path", this.previousSubPath?.id, this.previousSubPath, this.previousSubPath?.segments.length)
                return this.previousSubPath?.endAnchor?.anchorPoint;
            } else {
                // console.log("p2n target node")
                return this.targetVisNode.center;
                // throw new Error("Not implemented");
            }

        } else {
            throw new Error("Not implemented");
        }
    }

    // /**
    //  * The point of the connection on the other side than the given node.
    //  * @param node
    //  */
    // getOppositeConnectionAnchor(node: VisNode): Point | undefined {

    //     if (this.connectionType == "nodeToNode") {
    //         const otherNode = this.getOppositeNodeThan(node);
    //         return otherNode?.center;
    //     } else if (this.connectionType == "nodeToPath") {
    //         if (node == this.sourceVisNode) {
    //             return this.nextSubPath?.startAnchor?.anchorPoint;
    //         } else {
    //             throw new Error("Not implemented");
    //         }

    //     } else if (this.connectionType == "pathToNode") {

    //         if (node == this.targetVisNode) {
    //             return this.previousSubPath?.endAnchor?.anchorPoint;
    //         } else {
    //             throw new Error("Not implemented");
    //         }

    //     } else {
    //         throw new Error("Not implemented");
    //     }
    // }



    ////////////////////////////////////////////////////////////////////////////
    // #region Constructor
    ////////////////////////////////////////////////////////////////////////////

    constructor(options: {
        visConnection: VisConnection;
        startNode: VisOrLayoutNode;
        endNode: VisOrLayoutNode;
        constraints?: VisOrLayoutNode[];
        nodePath: VisOrLayoutNode[];
        previousSubPath?: SubPath;
    }) {
        super(options.visConnection.connection);
        this.visConnection = options.visConnection;
        this.sourceVisNode = this.layouter.getVisNode(options.startNode);
        this.targetVisNode = this.layouter.getVisNode(options.endNode);
        if (options.constraints) {
            this.constraints = options.constraints.map(constraint => this.layouter.getVisNode(constraint));
        }
        if (options.nodePath) {
            this.nodePath = options.nodePath.map(node => this.layouter.getVisNode(node));
        }

        if (options.previousSubPath) {
            this.previousSubPath = options.previousSubPath;
            options.previousSubPath.nextSubPath = this;
        }

        // LevelType determination
        if (this.hasSameParent()) {
            this.levelType = "sameLevel";
        } else {
            this.levelType = "levelChanging";
        }

        // ConnectionType determination
        if (this.hasSameParent()) {

            // TODO: Add path to path connections on virtual nodes
            this.connectionType = "nodeToNode";

        } else {
            if (this.sourceVisNode.layoutNode.isHyperNode) {
                this.connectionType = "pathToNode";
            } else if (this.targetVisNode.layoutNode.isHyperNode) {
                this.connectionType = "nodeToPath";
            } else {
                console.warn(this);
                throw new Error("Invalid connection type");
            }
        }

        // Connections between nodes on the same level are cached
        if (this.levelType == "sameLevel" && this.connectionType == "nodeToNode") {
            this.cachable = true;
        }

        // Update cache
        if (this.cachable) {
            const group = this.sourceVisNode.getSubPathGroup(this.targetVisNode);
            group.addSubPath(this);
            this.group = group;
        }


        // Add to node ranges
        this.addToNodeRange();

        // Add to layouter
        this.layouter.addPathToLayouter(this);

        // // For hyper connections, there can be multiple connections (so hyper connection + its child connections)
        // // that share the same path.
        // // In this case, the path is saved to be reused here
        // this.cachedSubPath = this.sourceVisNode.getCachedPathTo(this.targetVisNode);
        // if (this.cachedSubPath) {
        //     // If there was a linked path, the segments are just the linked path
        //     this.segments = [this.cachedSubPath];
        // }
        // // If there was no linked path, we add this path to be layouted
        // else {
        //     // Connections between the same parents are saved to be reused
        //     // This should not be done between different parents, as paths from nodes to its hypernode can be for different connections
        //     if (this.levelType == "sameLevel" && this.connectionType == "nodeToNode") {
        //         this.cachable = true;
        //         this.sourceVisNode.addCachedPathTo(this.targetVisNode, this);
        //     }
        //     this.addToNodeRange();

        //     // const pathMap = this.flexConnection.layouter.mapLayerToFlexPaths;
        //     // if (!pathMap.has(this.layerFromTop)) {
        //     //     pathMap.set(this.layerFromTop, []);
        //     // }

        //     // pathMap.get(this.layerFromTop)!.push(this);
        // }


        // // Add to layouter
        // this.layouter.addPathToLayouter(this);
    }


    addToNodeRange() {

        const source = this.source;
        const target = this.target;

        if (this.hasSameParent()) {

            if (this.isCircleArcForward()) {
                // Do not add to continuum
                // type = "circleArcForward";
            } else if (this.isCircleArcBackward()) {
                // Do not add to continuum
                // type = "circleArcBackward";
            } else {
                // type = "sameParent";
                this.sourceVisNode.innerRange.registerSubPath(this);
                this.targetVisNode.innerRange.registerSubPath(this);
            }
        } else {
            // if (source.isRealNode) this.sourceVisNode.outerRange.registerSubPath(this);
            // if (target.isRealNode) this.targetVisNode.outerRange.registerSubPath(this);
            // if (target.id == "facialexpressionmanager_node") {
            //     console.warn("ADD TO RANGE", {
            //         id: this.id,
            //         cId: this.cId,
            //         sourceId: this.sourceVisNode.id,
            //         targetId: this.targetVisNode.id
            //     });
            // }
            this.sourceVisNode.outerRange.registerSubPath(this);
            this.targetVisNode.outerRange.registerSubPath(this);
        }
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Layouting
    ////////////////////////////////////////////////////////////////////////////

    layoutCompleted = false;

    override getSvgPath(): string {
        // console.log("[SVG]", this.cId, this.segments)
        if (this.segments.length === 0) {
            return "";
        }

        return this.segments.filter(s => s !== undefined).map(s => s.getSvgPath()).join(" ");
    }

    layout() {

        if (this.layoutCompleted) return;
        this.layoutCompleted = true;

        // If this subpath is path of a group, we either take the already laid out path
        // or layout this and save it to the group
        if (this.group) {
            if (this.group.laidOutSubPath) {
                this.segments = [this.group.laidOutSubPath];
                return;
            } else {
                this.group.laidOutSubPath = this;
            }
        }

        // Connections between the same parents can just be calculated
        if (this.levelType == "sameLevel") {

            // Handle layout for circular arcs
            if (this.isCircleArc()) {
                this.layoutCircleArc();
                return;
            }

            // Handle layout for connections inside the same parent
            this.layoutInsideParent();
            return;
        }
        // For connections between different parents
        else {
            if (this.connectionType == "pathToNode" || this.connectionType == "nodeToPath") {
                this.layoutPathNodeConnection();
            } else {
                throw new Error("Not implemented");
            }
        }
    }

    layoutCircleArc() {
        // console.warn("Layout DIRECT ARC", this.sourceVisNode.id, this.targetVisNode.id, this);

        // console.log("Calculate direct circle arc connection", this.connection.source.id, this.connection.target.id);
        const source = this.sourceVisNode.layoutNode;
        const target = this.targetVisNode.layoutNode;
        const parent = source.getCommonParent(target);

        const sourceCircle = source.outerCircle;
        const targetCircle = target.outerCircle;

        let segmentCircle = parent?.innerCircle.clone();

        // this.startNode.debugShapes.push(segmentCircle?.clone());

        if (!segmentCircle || !sourceCircle || !targetCircle) {
            console.error("No segment circle for connection", this.connection, sourceCircle, targetCircle);
            return;
        };

        const isForward = this.isCircleArcForward();
        const arcDirection = isForward ? "clockwise" : "counter-clockwise";
        const otherDirection = isForward ? "counter-clockwise" : "clockwise";

        // Check if there is a counter connection (so a circle connection in the other direction)
        // TODO: Implement this
        // const hasCounterConnection = (isForward && this.flexNode.circleArcBackwardConnections.some(c => c.target == this.source)) || (!isForward && this.flexNode.circleArcForwardConnections.some(c => c.source == this.target));
        const hasCounterConnection = true;

        // If there is a counter connection, adapt the radius of the segment circles so that the counter connection is not too close
        if (hasCounterConnection) {
            if (isForward) {
                segmentCircle.r += 0.0 * Math.min(sourceCircle.r, targetCircle.r);
                // segmentCircle.r += 2 * this.connection.weight;
            } else {
                segmentCircle.r -= 0.3 * Math.min(sourceCircle.r, targetCircle.r);
                // segmentCircle.r -= 2 * this.connection.weight;
            }
        }

        // If the parent node has only two children, the circle is adapted to be larger, so that the connection is more direct
        if (parent?.children.length === 2) {
            const _centerVector = new Vector(sourceCircle.center, targetCircle.center);
            const centerTranslationVector = isForward ? _centerVector.rotate90CW() : _centerVector.rotate90CCW();
            const newCenter = parent.center.translate(centerTranslationVector);

            const smallerNode = target.radius < source.radius ? target : source;
            const newRadius = newCenter.distanceTo(smallerNode.center)[0];
            segmentCircle = new Circle(newCenter, newRadius);
            // this.startNode.debugShapes.push(segmentCircle);
            // this.startNode.debugShapes.push(parent.innerCircle);
            // this.startNode.debugShapes.push(arcSourceCircle);
            // this.startNode.debugShapes.push(arcTargetCircle);

        }

        let hyperArc: EllipticArc | undefined;

        try {
            hyperArc = RadialCircularArcConnectionLayouter.getCircularArcBetweenCircles(
                this.connection,
                sourceCircle,
                targetCircle,
                segmentCircle,
                arcDirection
            )

            // this.connection.debugShapes.push(sourceCircle);
            // this.connection.debugShapes.push(targetCircle);
            // this.connection.debugShapes.push(segmentCircle);
            // this.connection.debugShapes.push(hyperArc.startAnchor);
            // this.connection.debugShapes.push(hyperArc.endAnchor);

            this.sourceVisNode.adaptRanges(hyperArc.startAnchor);
            this.targetVisNode.adaptRanges(hyperArc.endAnchor);

            // if (this.sourceVisNode.id == "jokes_node" || this.sourceVisNode.id == "flint_node") {
            //     console.warn("[ADAPT BEFORE]", this.sourceVisNode.outerRange.range.slice(), this.id)
            //     console.warn("[ADAPT AFTER]", this.sourceVisNode.outerRange.range.slice(), this.id)

            //     const sA = hyperArc.startAnchor;
            //     const tA = hyperArc.endAnchor;

            //     sA._data = { stroke: "cyan", length: 10 };
            //     tA._data = { stroke: "cyan", length: 10 };

            //     this.connection.debugShapes.push(sA);
            //     this.connection.debugShapes.push(tA);
            // }

            this.segments = [hyperArc];
        } catch (e) {
            this.connection.debugShapes.push(sourceCircle);
            this.connection.debugShapes.push(targetCircle);
            this.connection.debugShapes.push(segmentCircle);
            console.error("Error in circular arc connection layouting", {
                connection: this.connection,
                source,
                target,
                segmentCircle
            })
            throw e;
        }
    }


    layoutInsideParent() {
        // console.warn("Layout INSIDE", this.sourceVisNode.id, this.targetVisNode.id, this);
        const sourceAnchor = this.sourceVisNode.innerRange.getAnchorForPath(this, "out");
        const targetAnchor = this.targetVisNode.innerRange.getAnchorForPath(this, "in");

        this.segments = [new SmoothSplineSegment(this.connection, sourceAnchor, targetAnchor)];
    }

    layoutPathNodeConnection() {
        // console.warn("Layout DYNAMIC", this.sourceVisNode.id, this.targetVisNode.id, this);

        const dynamicSubPath = new DynamicSubPath(this);
        dynamicSubPath.layout();
        this.segments = [dynamicSubPath];

        return;
    }


}




