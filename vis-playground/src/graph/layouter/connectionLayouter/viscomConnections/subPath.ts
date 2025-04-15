import { Anchor, EllipticArc } from "src/graph/graphical";
import { VisNode } from "./visNode";
import { Circle, Point, Segment, Vector } from "2d-geometry";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { VisConnection } from "./visConnection";
import { CombinedPathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { VisOrLayoutNode } from "./viscomConnectionLayouter";
import { RadialCircularArcConnectionLayouter } from "../radialConnections";
import { SmoothSplineSegment } from "src/graph/graphical/primitives/pathSegments/SmoothSpline";
import { DirectCircularArcConnectionMethod, DynamicSubPath } from "./dynamicSubPath";
import { RadialUtils } from "../../utils/radialUtils";
import { StraightLineSegment } from "src/graph/graphical/primitives/pathSegments/LineSegment";


export type SubPathLevelType = "sameLevel" | "levelChanging"
export type SubPathConnectionType = "pathToNode" | "nodeToPath" | "nodeToNode" | "pathToPath";
// export type SubPathConnectionType = "pathToNode" | "nodeToPath" | "nodeToNode" | "pathToPath" | "nodeToNodeDifferentParents";

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

    /**
     * The node path laid out by the sub path object.
     * In the simplest case (e.g. for connections between nodes on the same level), this is just the source and target node.
     * For level-changing connections, this is either:
     * - For node to path connections the path from the source node to the target hyper node having the next path to be connected
     * - For path to node connections the path from the path at the source hyper node to the target node.
     */
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

    getNextNonHyperNodeBetween(startNode: VisNode, endNode: VisNode): VisNode | undefined {

        const completeNodePath = this.visConnection.nodePath;
        let started = false;
        for (let i = 0; i < completeNodePath.length; i++) {
            const node = completeNodePath[i];
            const layoutNode = node.layoutNode;

            if (node == startNode) {
                started = true;
                continue;
            }

            if (node == endNode) {
                if (started) return endNode;
                else break;
            }

            if (started && !layoutNode.isHyperNode) {
                return node;
            }
        }

        started = false;
        for (let i = completeNodePath.length - 1; i >= 0; i--) {
            const node = completeNodePath[i];
            const layoutNode = node.layoutNode;

            if (node == startNode) {
                started = true;
                continue;
            }

            if (node == endNode) {
                if (started) return endNode;
                else break;
            }

            if (started && !layoutNode.isHyperNode) {
                return node;
            }
        }

        return undefined;
    }

    isCounterPathOf(path?: SubPath, allowLevelChange: boolean = true) {
        if (!path) return false;
        if (this.levelType != "sameLevel" && !allowLevelChange) return false;
        // return this.sourceVisNode === path.targetVisNode && this.targetVisNode === path.sourceVisNode;
        return this.source === path.target && this.target === path.source;
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
        return this.isCircleArcForward() !== this.isCircleArcBackward();
        // return (this.isCircleArcForward() || this.isCircleArcBackward());
    }


    get isHyperEdge() {
        return this.source.isHyperNode || this.target.isHyperNode;
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

    /**
     * Get the desired anchor for the connection for the given node.
     * @param visNode The node to calculate the anchor for
     * @param ignoreLevelDifference If true, level difference is ignored. Otherwise, there is no anchor if the level difference is more than 1
     * @returns The desired anchor or undefined if not possible
     */
    getDesiredNodeAnchor(visNode: VisNode, props?: {
        ignoreLevelDifference?: boolean,
        directConnectionAtHypernode?: boolean,
    }
    ): Anchor | undefined {

        const ignoreLevelDifference = props?.ignoreLevelDifference ?? false;
        const directConnectionAtHypernode = props?.directConnectionAtHypernode ?? true;


        const otherVisNode = this.getOppositeNodeThan(visNode);

        const sourceLayoutNode = this.getLayoutNodeInDirectionOf(visNode);
        const otherLayoutNode = this.getLayoutNodeInDirectionOf(otherVisNode);

        let debug = false;
        debug = false;
        // if (sourceLayoutNode?.id.includes("tts_guard") && otherLayoutNode?.id == "dialog_session_manager") debug = true;
        // if (sourceLayoutNode?.id.includes("tts_guard")) debug = true;
        // if (this.source.id.includes("tts_guard")) debug = true;



        // console.log("[DESIRED]", `${sourceNode.id}->${otherNode?.id}`, sourceNode.layoutNode.layerFromTop, otherNode?.layoutNode.layerFromTop, this.level);

        // If level difference is more than 1, the connection should not have a desired circle arc an anchor
        if (!ignoreLevelDifference) {
            if (Math.abs(visNode.layoutNode.layerFromTop - (otherVisNode?.layoutNode.layerFromTop ?? visNode.layoutNode.layerFromTop)) > 1) {
                return undefined;
            }
        }

        if (this.connectionType == "nodeToNode") {

            if (this.levelType == "sameLevel") {
                // There are different cases for node to node connections and their desired anchors

                if (!sourceLayoutNode || !otherLayoutNode) {
                    return undefined;
                }

                const nextNonHyperNodeOnOtherSide = this.getNextNonHyperNodeBetween(visNode, this.layouter.getVisNode(otherLayoutNode!));

                if (debug) {
                    console.error({
                        visNode: visNode.id,
                        sourceLayoutNode: sourceLayoutNode,
                        nextNonHyperNode: nextNonHyperNodeOnOtherSide,
                        otherLayoutNode: otherLayoutNode,
                        type: this.connectionType
                    });
                }

                // 1. case: this visNode is also the end of the connection
                // 1. case: this visNode is no hypernode
                // if (visNode.layoutNode == sourceLayoutNode) {
                // In this case, we define the anchor based on the node to be connected
                if (!visNode.layoutNode.isHyperNode) {
                    // if (otherVisNode?.id == "left_motor_controller") {
                    //     const x = 5;
                    // }


                    // if (this.visConnection.nodePath.length > 4) {
                    //     const x = 5;
                    // }


                    // We do not just take the next node, but the next non-hyper node (either real or virtual)
                    // in order to orient the node not to the center of the connected hypernode, but better
                    if (otherLayoutNode) {
                        const nextNonHyperNode = this.getNextNonHyperNodeBetween(visNode, this.layouter.getVisNode(otherLayoutNode));
                        if (nextNonHyperNode) {
                            return new Anchor(visNode.center, new Vector(visNode.center, nextNonHyperNode.center)).move(visNode.outerCircle.r);
                        }

                        // If there is no next non-hyper node, we take the center of the connected vis node
                        return new Anchor(visNode.center, new Vector(visNode.center, otherLayoutNode.center)).move(visNode.outerCircle.r);
                    }

                    return undefined;
                    // return new Anchor(otherLayoutNode.center, new Vector(otherLayoutNode.center, sourceNode.center)).move(otherLayoutNode.outerCircle.r);
                }
                else {
                    // 2. case: this visNode is a hypernode
                    // In this case we do the following:
                    // The hyper node has inside a next non-hyper node which is the next in the nodePath.
                    // We take this node as basis for the desired anchor.
                    const nextNonHyperNodeAtSource = this.getNextNonHyperNodeBetween(visNode, this.layouter.getVisNode(sourceLayoutNode));

                    // if (sourceLayoutNode.id == "system_information") debug = true;
                    // if (sourceLayoutNode.id == "drive_manager") debug = true;
                    // if (sourceLayoutNode.id.includes("tts_guard") && otherLayoutNode.id == "dialog_session_manager") debug = true;


                    // return new Anchor(visNode.center, new Vector(visNode.center, nextNonHyperNode?.center ?? sourceLayoutNode.center)).move(visNode.outerCircle.r);

                    if (debug) {
                        console.log({
                            isHyperNode: true,
                            nextNonHyperNode: nextNonHyperNodeAtSource?.id,
                            nPath: this.nodePath.map(n => n.id),
                            nVisPath: this.visConnection.nodePath.map(n => n.id),
                            sVis: visNode.id,
                            eVis: this.layouter.getVisNode(sourceLayoutNode)?.id,
                        })
                    }

                    if (directConnectionAtHypernode) {
                        if (nextNonHyperNodeAtSource) {
                            // If the direct connection to the other node is inside the nextNonHyperNode outside range, we take this anchor
                            const nextNonHyperVisNode = this.layouter.getVisNode(nextNonHyperNodeAtSource)!;

                            const line = new Segment(nextNonHyperNodeAtSource.center, otherLayoutNode.center);

                            if (debug) {
                                visNode.layoutNode.debugShapes.push(line);
                                // console.error({
                                //     intersections: intersections,
                                // });
                            }

                            // if (nextNonHyperVisNode.outerRange.pointIsInside(otherLayoutNode.center)) {
                            // Calculate the intersection with the line from nextNonHyperNode to the center of the other node with the outer circle of the vis node
                            const intersections = visNode.outerCircle.intersect(line);

                            if (intersections.length > 0) {
                                return new Anchor(intersections[0], new Vector(line.slope));
                                // return new Anchor(intersections[0], new Vector(visNode.center, intersections[0]));
                            }
                            // }
                        }
                    }

                    // return new Anchor(visNode.center, new Vector(visNode.center, otherLayoutNode.center)).move(visNode.outerCircle.r);


                    // If it is not inside the outer range, we extend a line from the center of the hyper node to the center of the next non-hyper node
                    // and move it to the outer circle of the hyper node.
                    return new Anchor(visNode.center, new Vector(visNode.center, nextNonHyperNodeAtSource?.center ?? sourceLayoutNode.center)).move(visNode.outerCircle.r);
                }
            }
            else if (this.levelType == "levelChanging") {

                // console.warn("[LEVEL CHANGING N2N]", this.cId, this.id, visNode.id);

                if (otherVisNode) {
                    // If the nodes are directly reachable inside their outer ranges, we take a direct connection to the other visNode
                    if (otherVisNode.outerRange.pointIsInside(visNode.center) && visNode.outerRange.pointIsInside(otherVisNode.center)) {
                        return new Anchor(visNode.center, new Vector(visNode.center, otherVisNode.center)).move(visNode.outerCircle.r);
                    }

                    // Otherwise we "unwrap" the circles of the other hypernode, so that we can calculate a proper anchor
                    else {
                        const otherVisNodeParent = this.layouter.getVisNode(otherLayoutNode!.parent!);
                        if (otherVisNodeParent) {

                            const otherVisNodeParentCenter = otherVisNodeParent.innerCircle.center;

                            const visNodeToHypernodeCenterVector = new Vector(visNode.center, otherVisNodeParentCenter);
                            const startSlope = visNodeToHypernodeCenterVector.slope;
                            const otherNodeSlope = new Vector(otherVisNodeParentCenter, otherVisNode.center).slope;

                            const forwardRadToOtherNode = RadialUtils.forwardRadBetweenAngles(startSlope, otherNodeSlope);

                            // console.warn({
                            //     id: this.cId,
                            //     startSlope,
                            //     otherNodeSlope,
                            //     forwardRadToOtherNode,
                            // })

                            let radDiffFromCenter = forwardRadToOtherNode - Math.PI;

                            if (otherVisNodeParentCenter.distanceTo(otherVisNode.center)[0] < 0.1) {
                                radDiffFromCenter = 0;
                            }

                            const circleRadius = otherVisNodeParent.innerCircle.r;
                            const moveDistance = (3 * circleRadius) * radDiffFromCenter / Math.PI;

                            const projectedPoint = new Anchor(otherVisNodeParentCenter, visNodeToHypernodeCenterVector.clone().rotate90CCW()).move(moveDistance).anchorPoint;

                            // if (visNode.id == "display_manager") {
                            //     // if (otherVisNode.id == "drive_controller") {
                            //     // visNode.layoutNode.debugShapes.push(otherVisNodeParent.innerCircle);

                            //     visNode.layoutNode.debugShapes.push(new Segment(otherVisNodeParentCenter, projectedPoint));
                            //     visNode.layoutNode.debugShapes.push(new Segment(visNode.center, otherVisNodeParentCenter));
                            //     visNode.layoutNode.debugShapes.push(otherVisNodeParent.circle);
                            //     visNode.layoutNode.debugShapes.push(new Segment(visNode.center, projectedPoint));
                            //     visNode.layoutNode.debugShapes.push(new Segment(projectedPoint, otherVisNode.center));
                            //     visNode.layoutNode.debugShapes.push(projectedPoint);
                            // }


                            return new Anchor(visNode.center, new Vector(visNode.center, projectedPoint)).move(visNode.outerCircle.r);

                        }
                    }


                }
            }


        }

        else if (this.connectionType == "nodeToPath") {

            // For node to path we have two cases:
            // 1.: The node is the end of the node path. In this case, we try to find the best (thus, a circular arc) connection for the anchor
            // 2.: The node is an intermediate node on the node path (e.g. a virtual node). In this case, there is a path before which we take as basis for our anchor

            const endLayoutNode = this.getLayoutNodeInDirectionOf(visNode);

            if (debug) {
                console.error({
                    visNode: visNode.id,
                    endLayoutNode: endLayoutNode?.id,
                });
            }

            if (endLayoutNode == visNode.layoutNode) {

                const pathAnchor = this.nextSubPath?.startAnchor;

                if (visNode && pathAnchor) {

                    const arcCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(visNode.layoutNode.center, pathAnchor);
                    try {
                        const intersections = arcCircle ? visNode.outerCircle.intersect(arcCircle) : [];
                        const nodeIntersection = RadialUtils.getClosestShapeToPoint(intersections, pathAnchor.anchorPoint);
                        if (nodeIntersection) {
                            return new Anchor(nodeIntersection, new Vector(visNode.center, nodeIntersection));
                        }
                    } catch (e) {
                        console.error("Error in direct circular arc connection layouting", {})
                        throw e;
                    }
                }

                return pathAnchor;

            } else {

                const pathBefore = this.previousSubPath;
                const pathAnchor = pathBefore?.endAnchor;
                // console.warn("Node to path connection with path before", pathBefore?.id, pathBefore?.level);

                if (pathAnchor) {
                    // Simplest case: Just extend the anchor to the other side of the node
                    const a = new Anchor(visNode.center, new Vector(pathAnchor.anchorPoint, visNode.center)).move(visNode.outerCircle.r);
                    // this.connection.debugShapes.push(a);
                    return a;
                }

            }

        } else if (this.connectionType == "pathToNode") {

            const endLayoutNode = this.getLayoutNodeInDirectionOf(visNode);

            // For node to path we have two cases:
            // 1.: The node is the end of the node path. In this case, we try to find the best (thus, a circular arc) connection for the anchor
            // 2.: The node is an intermediate node on the node path (e.g. a virtual node). In this case, there is a path after which we take as basis for our anchor

            if (endLayoutNode == visNode.layoutNode) {
                const pathAnchor = this.previousSubPath?.endAnchor;

                if (visNode && pathAnchor) {

                    const arcCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(visNode.layoutNode.center, pathAnchor);
                    try {
                        const intersections = arcCircle ? visNode.outerCircle.intersect(arcCircle) : [];
                        const nodeIntersection = RadialUtils.getClosestShapeToPoint(intersections, pathAnchor.anchorPoint);
                        if (nodeIntersection) {
                            return new Anchor(nodeIntersection, new Vector(visNode.center, nodeIntersection));
                        }
                    } catch (e) {
                        console.error("Error in direct circular arc connection layouting", {})
                        throw e;
                    }
                }

                return pathAnchor;

            } else {

                const pathAfter = this.nextSubPath;
                const pathAnchor = pathAfter?.endAnchor;

                if (pathAnchor) {
                    // Simplest case: Just extend the anchor to the other side of the node
                    const a = new Anchor(visNode.center, new Vector(pathAnchor.anchorPoint, visNode.center)).move(visNode.outerCircle.r);
                    // this.connection.debugShapes.push(a);
                    return a;
                }

            }

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

            if (this.sourceVisNode == this.targetVisNode && this.sourceVisNode.layoutNode.isVirtual) {
                this.connectionType = "pathToPath";
            } else {
                this.connectionType = "nodeToNode";
            }
        } else {
            if (this.sourceVisNode.layoutNode.isHyperNode) {
                this.connectionType = "pathToNode";
            } else if (this.targetVisNode.layoutNode.isHyperNode) {
                this.connectionType = "nodeToPath";
            } else {
                this.connectionType = "nodeToNode";
                // console.warn(this);
                // throw new Error("Invalid connection type");
            }
        }

        const useHyperEdges = this.layouter.useHyperEdges;
        // const useHyperEdges = true;

        // Connections between nodes on the same level are cached
        if (this.levelType == "sameLevel" && this.connectionType == "nodeToNode") {
            // if (this.connection.isDirectVirtualConnection || this.connection.isThroughVirtualNodes) {
            if (this.sourceVisNode.layoutNode.isVirtual || this.targetVisNode.layoutNode.isVirtual) {
                this.cachable = true;
            } else {
                this.cachable = useHyperEdges;
            }
        }

        // Update cache
        if (this.cachable) {
            const group = this.sourceVisNode.getSubPathGroup(this.targetVisNode);
            group.addSubPath(this);
            this.group = group;
        }

        if (!useHyperEdges && this.isHyperEdge) return;

        // Add to node ranges
        this.addToNodeRange();

        // Add to layouter
        this.layouter.addPathToLayouter(this);
    }


    addToNodeRange() {

        const source = this.source;
        const target = this.target;

        if (this.hasSameParent()) {

            if (this.connectionType == "pathToPath") {
                this.sourceVisNode.path2pathSubPaths.push(this);
                return;
            }

            if (!this.isCircleArc()) {
                // type = "sameParent";
                this.sourceVisNode.innerRange.registerSubPath(this, this.targetVisNode.innerRange);
                this.targetVisNode.innerRange.registerSubPath(this, this.sourceVisNode.innerRange);
            } else if (this.isCircleArcForward()) {
                // Do not add to continuum
                // type = "circleArcForward";
                this.sourceVisNode.circularRangeForward.registerSubPath(this, this.targetVisNode.circularRangeBackward);
                this.targetVisNode.circularRangeBackward.registerSubPath(this, this.sourceVisNode.circularRangeForward);
            } else if (this.isCircleArcBackward()) {
                // Do not add to continuum
                // type = "circleArcBackward";
                this.sourceVisNode.circularRangeBackward.registerSubPath(this, this.targetVisNode.circularRangeForward);
                this.targetVisNode.circularRangeForward.registerSubPath(this, this.sourceVisNode.circularRangeBackward);
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
            this.sourceVisNode.outerRange.registerSubPath(this, this.targetVisNode.outerRange);
            this.targetVisNode.outerRange.registerSubPath(this, this.sourceVisNode.outerRange);
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

        if (this.isHyperEdge) {
            console.error("Layouting hyper edge", this);
        }

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

            if (this.connectionType == "pathToPath") {
                this.layoutPathToPathConnection();
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
                this.layoutDirectOutsideConnection();
                // throw new Error("Not implemented");
            }
        }
    }

    layoutCircleArc() {
        const isForward = this.isCircleArcForward();

        const source = this.sourceVisNode.layoutNode;
        const target = this.targetVisNode.layoutNode;
        const parent = source.getCommonParent(target);

        const sourceCircle = source.outerCircle;
        const targetCircle = target.outerCircle;

        let segmentCircle = parent?.innerCircle.clone();

        const sourceRange = isForward ? this.sourceVisNode.circularRangeForward : this.sourceVisNode.circularRangeBackward;
        const targetRange = isForward ? this.targetVisNode.circularRangeBackward : this.targetVisNode.circularRangeForward;

        const rangeRad = sourceRange.getRadForPath(this);
        const rangePoint = RadialUtils.positionOnCircleAtRad(rangeRad, sourceCircle.r, sourceCircle.center);
        const radius = parent!.innerCircle.center.distanceTo(rangePoint)[0];


        // console.warn("Layout DIRECT ARC", this.sourceVisNode.id, this.targetVisNode.id, this, {
        //     sRad: sourceRange.getRadForPath(this),
        //     tRad: targetRange.getRadForPath(this),
        //     sRange: sourceRange,
        //     tRange: targetRange
        // });

        // console.log("Calculate direct circle arc connection", this.connection.source.id, this.connection.target.id);


        // this.startNode.debugShapes.push(segmentCircle?.clone());

        if (!segmentCircle || !sourceCircle || !targetCircle) {
            console.error("No segment circle for connection", this.connection, sourceCircle, targetCircle);
            return;
        };

        const arcDirection = isForward ? "clockwise" : "counter-clockwise";
        const otherDirection = isForward ? "counter-clockwise" : "clockwise";

        // Check if there is a counter connection (so a circle connection in the other direction)
        // TODO: Implement this
        // const hasCounterConnection = (isForward && this.flexNode.circleArcBackwardConnections.some(c => c.target == this.source)) || (!isForward && this.flexNode.circleArcForwardConnections.some(c => c.source == this.target));
        const hasCounterConnection = true;

        // If there is a counter connection, adapt the radius of the segment circles so that the counter connection is not too close
        // if (hasCounterConnection) {
        //     if (isForward) {
        //         segmentCircle.r += 0.0 * Math.min(sourceCircle.r, targetCircle.r);
        //         // segmentCircle.r += 2 * this.connection.weight;
        //     } else {
        //         segmentCircle.r -= 0.3 * Math.min(sourceCircle.r, targetCircle.r);
        //         // segmentCircle.r -= 2 * this.connection.weight;
        //     }
        // }
        segmentCircle.r = radius;

        // this.source.debugShapes.push(new Segment(rangePoint, parent!.innerCircle.center));
        // this.source.debugShapes.push(segmentCircle);


        // If the parent node has only two children, the circle is adapted to be larger, so that the connection is more direct
        if (parent?.children.length === 2) {
            const _centerVector = new Vector(sourceCircle.center, targetCircle.center);
            const centerTranslationVector = isForward ? _centerVector.rotate90CW() : _centerVector.rotate90CCW();
            const newCenter = parent.center.translate(centerTranslationVector);

            const smallerNode = target.radius < source.radius ? target : source;
            const newRadius = newCenter.distanceTo(smallerNode.center)[0];

            const radiusFactor = parent.innerRadius / radius;
            const scaledRadius = newRadius / radiusFactor;

            // segmentCircle = new Circle(newCenter, newRadius);
            segmentCircle = new Circle(newCenter, scaledRadius);


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

    layoutPathToPathConnection() {
        // console.warn("Layout PATH2PATH", this.cId, this);

        const previousPath = this.previousSubPath;
        const sourceAnchor = previousPath?.endAnchor;

        const nextPath = this.nextSubPath;
        const targetAnchor = nextPath?.startAnchor;

        if (!sourceAnchor || !targetAnchor) {
            console.error("No source or target anchor for path to path connection", this);
            return;
        }

        // this.connection.debugShapes.push(sourceAnchor);
        // this.connection.debugShapes.push(targetAnchor);

        this.segments = [new SmoothSplineSegment(this.connection, sourceAnchor, targetAnchor, 0.4, false, false)];
    }

    layoutPathNodeConnection() {
        // console.warn("Layout DYNAMIC", this.sourceVisNode.id, this.targetVisNode.id, this);

        const dynamicSubPath = new DynamicSubPath(this);
        dynamicSubPath.layout();
        this.segments = [dynamicSubPath];

        return;
    }

    layoutDirectOutsideConnection() {

        // console.warn("Layout DIRECT", this.sourceVisNode.id, this.targetVisNode.id, this);

        if (this.source.id == "sensor2") {
            const x = 5;
        }

        const sourceAnchor = this.sourceVisNode.outerRange.getAnchorForPath(this, "out");
        const targetAnchor = this.targetVisNode.outerRange.getAnchorForPath(this, "in");

        const extendToCircle = false;

        if (!extendToCircle) {
            this.segments = [new SmoothSplineSegment(this.connection, sourceAnchor, targetAnchor, 0.5)];
        }
        // TODO: This is bad at the moment, so don't use it
        else {

            const sourceParent = this.sourceVisNode.layoutNode.parent;
            const targetParent = this.targetVisNode.layoutNode.parent;

            if (!sourceParent || !targetParent) {
                console.error("No parent for source or target node", this);
                return;
            }

            const sourceParentCircle = sourceParent.circle;
            const targetParentCircle = targetParent.circle;

            // First, extend the anchors to the intersections with the parent circles

            const _sourceSegment = new Segment(sourceAnchor.anchorPoint, sourceAnchor.getPointInDirection(sourceParentCircle.r * 2));
            const _targetSegment = new Segment(targetAnchor.anchorPoint, targetAnchor.getPointInDirection(targetParentCircle.r * 2 * -1));

            const sourceIntersections = sourceParentCircle.intersect(_sourceSegment);
            const targetIntersections = targetParentCircle.intersect(_targetSegment);

            const splineSourceAnchor = sourceAnchor.clone();
            const splineTargetAnchor = targetAnchor.clone();

            if (sourceIntersections.length > 0) {
                splineSourceAnchor.anchorPoint = sourceIntersections[0];
            }
            if (targetIntersections.length > 0) {
                splineTargetAnchor.anchorPoint = targetIntersections[0];
            }

            this.segments = [
                new StraightLineSegment(this.connection, sourceAnchor.anchorPoint, splineSourceAnchor.anchorPoint),
                new SmoothSplineSegment(this.connection, splineSourceAnchor, splineTargetAnchor),
                new StraightLineSegment(this.connection, splineTargetAnchor.anchorPoint, targetAnchor.anchorPoint)
            ];
        }

    }
}




