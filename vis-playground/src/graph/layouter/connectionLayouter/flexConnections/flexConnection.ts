import { CombinedPathSegment, PathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { FlexNode } from "./flexNode";
import { FlexConnectionLayouter, FlexOrLayoutNode } from "./flexLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { Vector, Circle } from "2d-geometry";
import { Anchor, EllipticArc } from "src/graph/graphical";
import { RadialCircularArcConnectionLayouter } from "../radialConnections";
import { SmoothSplineSegment } from "src/graph/graphical/primitives/pathSegments/SmoothSpline";
import { RadialUtils } from "../../utils/radialUtils";


export type FlexConnectionParentType = "sameParent" | "differentParent";

export type FlexConnectionType =
    "sameParentDirectForward" | "sameParentDirectBackward" |
    "sameParent" |
    "sameHyperParentDirectForward" | "sameHyperParentDirectBackward" |
    "sameHyperParentDirectForwardBetweenAnchors" | "sameHyperParentDirectBackwardBetweenAnchors" |
    "differentParent" |

    "circleArcForward" | "circleArcBackward" |

    "unknown";



////////////////////////////////////////////////////////////////////////////
// #region Flex Connection
////////////////////////////////////////////////////////////////////////////

export class FlexConnection extends CombinedPathSegment {
    type: FlexConnectionType = "unknown"

    flexSource: FlexNode;
    flexTarget: FlexNode;

    layouter: FlexConnectionLayouter;

    paths: FlexPath[] = [];


    constructor(connection: LayoutConnection, layouter: FlexConnectionLayouter) {
        super(connection);
        this.layouter = layouter;
        this.flexSource = layouter.getFlexNode(connection.source);
        this.flexTarget = layouter.getFlexNode(connection.target);

        // this.type = type;
        this.connection.pathSegment = this;
        // this.init();
        this.initFlexPaths();
    }

    initFlexPaths() {

        const connPath = this.connection.getConnectionPathViaHyperAndVirtualNodes()
        const nodePath = connPath.map(node => node.id).join(" -> ")



        let lastPath: FlexPath | undefined = undefined;
        for (let i = 0; i < connPath.length - 1; i++) {
            const sNode = connPath[i];
            const tNode = connPath[i + 1];

            // sNode.layerFromBot

            if (sNode.parent == tNode.parent) {
                // Inside parent connection
                // lastPath = new SameParentConnection();  // Create new FlexConnectionPath instance
                const path = new FlexPath({
                    flexConnection: this,
                    startNode: sNode,
                    endNode: tNode
                });  // Create new FlexConnectionPath instance
                this.paths.push(path); // Add to paths
                lastPath = path; // Update lastPath

            } else {

                let realNode: LayoutNode | undefined = tNode;
                const constrainingNodes: LayoutNode[] = [];
                let j = i + 1;
                while (realNode && realNode.isHyperNode) {
                    constrainingNodes.push(realNode)
                    realNode = connPath[++j];
                }

                const path = new FlexPath({
                    flexConnection: this,
                    startNode: sNode,
                    endNode: tNode,
                    constraints: constrainingNodes
                });
                this.paths.push(path);
                lastPath = path;
            }
        }

        for (let i = 0; i < this.paths.length - 1; i++) {
            this.paths[i].nextPath = this.paths[i + 1];
            this.paths[i + 1].previousPath = this.paths[i];
        }


        // console.log("FLEX", {
        //     source: this.source.id,
        //     target: this.target.id,
        //     path: nodePath,
        //     paths: this.paths.map(path => path.sourceFlexNode.id + " -> " + path.targetFlexNode.id + " (" + path.layerFromBot + ")")
        // })

        this.segments = this.paths.map(path => path);

    }

    init(): void {

    }

    calculate(): void {

    }

    // override get segments(): PathSegment[] {
    //     return this.paths.map(path => path);
    // }
}


////////////////////////////////////////////////////////////////////////////
// #region Flex Path
////////////////////////////////////////////////////////////////////////////

export class FlexPath extends CombinedPathSegment {


    flexConnection: FlexConnection;

    sourceFlexNode: FlexNode;
    targetFlexNode: FlexNode;

    nextPath: FlexPath | undefined;
    previousPath: FlexPath | undefined;

    linkedPath: FlexPath | undefined;

    constraints: FlexNode[] = [];

    get id() {
        return this.sourceFlexNode.id + " -> " + this.targetFlexNode.id;
    }

    get layerFromBot() {
        return Math.min(this.sourceFlexNode.layoutNode.layerFromBot, this.targetFlexNode.layoutNode.layerFromBot);
    }

    get layerFromTop() {
        return Math.max(this.sourceFlexNode.layoutNode.layerFromTop, this.targetFlexNode.layoutNode.layerFromTop);
    }

    constructor(options: {
        flexConnection: FlexConnection;
        startNode: FlexOrLayoutNode;
        endNode: FlexOrLayoutNode;
        constraints?: FlexOrLayoutNode[];
    }) {
        super(options.flexConnection.connection);
        this.flexConnection = options.flexConnection;
        this.sourceFlexNode = this.flexConnection.layouter.getFlexNode(options.startNode);
        this.targetFlexNode = this.flexConnection.layouter.getFlexNode(options.endNode);
        if (options.constraints) {
            this.constraints = options.constraints.map(constraint => this.flexConnection.layouter.getFlexNode(constraint));
        }

        this.linkedPath = this.sourceFlexNode.getPathTo(this.targetFlexNode);
        if (this.linkedPath) {
            this.segments = [this.linkedPath]
        } else {
            // Connections between the same parents are saved to be reused
            // This should not be done between different parents, as paths from nodes to its hypernode can be for different connections
            if (this.hasSameParent()) this.sourceFlexNode.mapTargetNodeToPath.set(this.targetFlexNode, this);
            this.addToContinuum();

            const pathMap = this.flexConnection.layouter.mapLayerToFlexPaths;
            if (!pathMap.has(this.layerFromTop)) {
                pathMap.set(this.layerFromTop, []);
            }

            pathMap.get(this.layerFromTop)!.push(this);
        }

    }

    override getSvgPath(): string {
        if (this.segments.length === 0) {
            return "";
        }

        return this.segments.filter(s => s !== undefined).map(s => s.getSvgPath()).join(" ");
    }

    getOppositeNodeThan(node: FlexNode) {
        if (this.sourceFlexNode == node) return this.targetFlexNode;
        if (this.targetFlexNode == node) return this.sourceFlexNode;
        return undefined;
    }

    isCounterPathOf(nextPath?: FlexPath) {
        if (!nextPath) return false;
        return this.sourceFlexNode === nextPath.targetFlexNode && this.targetFlexNode === nextPath.sourceFlexNode;
    }

    //++++ Type Determination ++++//

    hasSameParent() {
        return this.sourceFlexNode.layoutNode.parent == this.targetFlexNode.layoutNode.parent;
    }

    isCircleArcForward() {
        return this.sourceFlexNode.layoutNode.isDirectPredecessorInSortingTo(this.targetFlexNode.layoutNode);
    }

    isCircleArcBackward() {
        return this.sourceFlexNode.layoutNode.isDirectSuccessorInSortingTo(this.targetFlexNode.layoutNode);
    }

    isCircleArc() {
        return this.isCircleArcForward() || this.isCircleArcBackward();
    }




    addToContinuum() {

        const source = this.sourceFlexNode.layoutNode;
        const target = this.targetFlexNode.layoutNode;

        if (this.hasSameParent()) {

            if (this.isCircleArcForward()) {
                // Do not add to continuum
                // type = "circleArcForward";
            } else if (this.isCircleArcBackward()) {
                // Do not add to continuum
                // type = "circleArcBackward";
            } else {
                // type = "sameParent";
                this.sourceFlexNode.innerContinuum.addPath(this);
                this.targetFlexNode.innerContinuum.addPath(this);
            }
        } else {
            if (source.isRealNode) this.sourceFlexNode.outerContinuum.addPath(this);
            if (target.isRealNode) this.targetFlexNode.outerContinuum.addPath(this);
        }
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Layout Methods
    ////////////////////////////////////////////////////////////////////////////

    layout() {

        // Connections between the same parents can just be calculated
        if (this.hasSameParent()) {

            // Handle layout for circular arcs
            if (this.isCircleArc()) {
                this.layoutCircleArc();
                return;
            }

            // Handle layout for connections inside the same parent
            this.layoutInsideParent();
        }
        // For connections between different parents
        else {
            this.layoutPathNodeConnection();
        }
    }


    layoutCircleArc() {
        // console.log("Calculate direct circle arc connection", this.connection.source.id, this.connection.target.id);
        const source = this.sourceFlexNode.layoutNode;
        const target = this.targetFlexNode.layoutNode;
        // const parent = source.parent;
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

            this.segments = [hyperArc];
        } catch (e) {
            // connection.source.debugShapes.push(start.outerCircle);
            // connection.source.debugShapes.push(end.outerCircle);
            // connection.source.debugShapes.push(segmentCircle);
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
        const sourceAnchor = this.sourceFlexNode.innerContinuum.getAnchorForPath(this, "out");
        const targetAnchor = this.targetFlexNode.innerContinuum.getAnchorForPath(this, "in");

        this.segments = [new SmoothSplineSegment(this.connection, sourceAnchor, targetAnchor)];
    }


    layoutPathNodeConnection() {

        // First, determine the direction of the connection:
        // - node to path OR
        // - path to node

        // TODO:: is this reliable?
        // Path to node if the source node is a hyper node
        const isPathToNode = this.sourceFlexNode.layoutNode.isHyperNode;
        const adjacentPath = isPathToNode ? this.previousPath : this.nextPath;
        const flexNode = isPathToNode ? this.targetFlexNode : this.sourceFlexNode;
        const node = flexNode.layoutNode;

        if (!adjacentPath) {
            console.error("No adjacent path for connection", this);
            return;
        }

        const pathAnchor = isPathToNode ? adjacentPath.endAnchor : adjacentPath.startAnchor;

        if (!pathAnchor) {
            console.error("No path anchor for connection", this);
            return;
        }

        let segment: PathSegment | undefined = undefined;

        // In the best case, we can connect the path to the node with a single circular arc
        const connectingCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(node.center, pathAnchor);
        if (connectingCircle) {
            const intersections = node.outerCircle.intersect(connectingCircle);
            const nodeIntersectionPoint = RadialUtils.getClosestShapeToPoint(intersections, pathAnchor.anchorPoint);

            const startPoint = isPathToNode ? pathAnchor.anchorPoint : nodeIntersectionPoint;
            const endPoint = isPathToNode ? nodeIntersectionPoint : pathAnchor.anchorPoint;

            segment = new EllipticArc(this.connection,
                startPoint,
                endPoint,
                connectingCircle.r,
                connectingCircle.r
            ).direction("clockwise");

            // Check if the anchor is correctly oriented
            const segmentAnchor = isPathToNode ? segment.startAnchor : segment.endAnchor;
            if (!pathAnchor.isSimilarTo(segmentAnchor)) {
                (segment as EllipticArc).direction("counter-clockwise");
            }
        }

        // The circle segment could be outside the valid outer range of the node
        // In this case, we have to adapt it
        const anchorAtNode = isPathToNode ? segment?.endAnchor : segment?.startAnchor;
        const arcRad = anchorAtNode ? RadialUtils.radOfPoint(anchorAtNode?.anchorPoint, node.center) : undefined;

        // TODO: Better construction of the spline points. Not just take a straight line from the hyperarc to the node, but instead take a point that respects the curvature

        // If the arc is not valid valid, we construct something better
        const continuum = flexNode.outerContinuum;
        if (!arcRad || !continuum.isInside(arcRad)) {

            // If the arc is not valid, we construct a spline from the hyperarc to the node
            const vectorNodeToPathAnchor = new Vector(node.center, pathAnchor.anchorPoint);
            // isPathToNode ?
            // new Vector(pathAnchor.anchorPoint, node.center).rotate(Math.PI) :
            // new Vector(node.center, pathAnchor.anchorPoint);

            if (continuum.isInside(vectorNodeToPathAnchor.slope)) {
                const nodeAnchor = new Anchor(node.center, vectorNodeToPathAnchor).move(node.outerRadius);
                segment = isPathToNode ?
                    new SmoothSplineSegment(this.connection, pathAnchor, nodeAnchor.cloneReversed()) :
                    new SmoothSplineSegment(this.connection, nodeAnchor, pathAnchor);
            } else {
                const anchor1 = new Anchor(node.center, new Vector(continuum.range[0])).move(node.outerRadius);
                const anchor2 = new Anchor(node.center, new Vector(continuum.range[1])).move(node.outerRadius);
                const closerAnchor = RadialUtils.getClosestShapeToPoint([anchor1, anchor2], pathAnchor.anchorPoint, a => a.anchorPoint);
                if (closerAnchor) {
                    segment = isPathToNode ?
                        new SmoothSplineSegment(this.connection, pathAnchor, closerAnchor.cloneReversed()) :
                        new SmoothSplineSegment(this.connection, closerAnchor, pathAnchor);
                }
            }
        }


        // console.log("Calculate path to node", {
        //     source: this.sourceFlexNode.id,
        //     target: this.targetFlexNode.id,
        //     path: adjacentPath.id,
        //     node: flexNode.id,
        //     // previousPath: this.previousPath,
        //     // nextPath: this.nextPath,
        //     isPathToNode: isPathToNode,
        // });

        if (!segment) {
            console.error("No segment for connection", this);
            return;
        }
        this.segments = [segment];


    }

}










// export class EmptyFlexConnection extends FlexConnection {
//     init(): void {
//         // this.segments = [];
//     }
//     calculate(): void {
//     }
// }


// export class FlexConnection extends CombinedPathSegment {

//     type: FlexConnectionType = "unknown";

//     flexNode: FlexNode;

//     constructor(connection: LayoutConnection, flexNode: FlexNode) {
//         super(connection);
//         connection.pathSegment = this;

//         this.flexNode = flexNode;

//         const source = connection.source;
//         const target = connection.target;

//         if (source.parent === target.parent) {
//             if (this.source.isDirectPredecessorInSortingTo(this.target)) {
//                 this.type = "circleArcForward";
//             } else if (this.source.isDirectSuccessorInSortingTo(this.target)) {
//                 this.type = "circleArcBackward";
//             } else {
//                 this.type = "sameParent"
//             }
//         } else {
//             const commonParent = source.getCommonParent(target);

//             // if ((commonParent == source.parent || commonParent == source.parent?.parent) && (commonParent == target.parent || commonParent == target.parent?.parent)) {
//             //     const firstChildContainingSource = commonParent?.getChildNodeContainingNodeAsDescendant(source);
//             //     const firstChildContainingTarget = commonParent?.getChildNodeContainingNodeAsDescendant(target);

//             //     if (firstChildContainingSource?.isDirectPredecessorInSortingTo(firstChildContainingTarget)) {
//             //         this.type = "sameHyperParentDirectForward";
//             //     } else if (firstChildContainingSource?.isDirectSuccessorInSortingTo(firstChildContainingTarget)) {
//             //         this.type = "sameHyperParentDirectBackward";
//             //     }
//             // }

//             if (source.isAnchor || target.isAnchor) {

//                 const firstChildContainingSource = commonParent?.getChildNodeContainingNodeAsDescendant(source);
//                 const firstChildContainingTarget = commonParent?.getChildNodeContainingNodeAsDescendant(target);

//                 if (firstChildContainingSource?.isDirectPredecessorInSortingTo(firstChildContainingTarget)) {
//                     this.type = "circleArcForward";
//                 } else if (firstChildContainingSource?.isDirectSuccessorInSortingTo(firstChildContainingTarget)) {
//                     this.type = "circleArcBackward";
//                 }
//             }

//             if (this.type == "unknown") {
//                 this.type = "differentParent";
//             }
//         }
//     }
// }


