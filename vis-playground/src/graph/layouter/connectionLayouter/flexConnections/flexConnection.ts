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

    parts: FlexPart[] = [];


    constructor(connection: LayoutConnection, layouter: FlexConnectionLayouter) {
        super(connection);
        this.layouter = layouter;
        this.flexSource = layouter.getFlexNode(connection.source);
        this.flexTarget = layouter.getFlexNode(connection.target);

        // this.type = type;
        this.connection.pathSegment = this;
        // this.init();
        this.initFlexParts();
    }

    initFlexParts() {

        const path = this.connection.getConnectionPathViaHyperAndVirtualNodes()
        const nodePath = path.map(node => node.id).join(" -> ")



        let lastPart: FlexPart | undefined = undefined;
        for (let i = 0; i < path.length - 1; i++) {
            const sNode = path[i];
            const tNode = path[i + 1];

            // sNode.layerFromBot

            if (sNode.parent == tNode.parent) {
                // Inside parent connection
                // lastPart = new SameParentConnection();  // Create new FlexConnectionPart instance
                const part = new FlexPart({
                    flexConnection: this,
                    startNode: sNode,
                    endNode: tNode
                });  // Create new FlexConnectionPart instance
                this.parts.push(part); // Add to parts
                lastPart = part; // Update lastPart

            } else {

                let realNode: LayoutNode | undefined = tNode;
                const constrainingNodes: LayoutNode[] = [];
                let j = i + 1;
                while (realNode && realNode.isHyperNode) {
                    constrainingNodes.push(realNode)
                    realNode = path[++j];
                }

                const part = new FlexPart({
                    flexConnection: this,
                    startNode: sNode,
                    endNode: tNode,
                    constraints: constrainingNodes
                });
                this.parts.push(part);
                lastPart = part;
            }
        }

        for (let i = 0; i < this.parts.length - 1; i++) {
            this.parts[i].nextPart = this.parts[i + 1];
            this.parts[i + 1].previousPart = this.parts[i];
        }


        // console.log("FLEX", {
        //     source: this.source.id,
        //     target: this.target.id,
        //     path: nodePath,
        //     parts: this.parts.map(part => part.sourceFlexNode.id + " -> " + part.targetFlexNode.id + " (" + part.layerFromBot + ")")
        // })

        this.segments = this.parts.map(part => part);

    }

    init(): void {

    }

    calculate(): void {

    }

    // override get segments(): PathSegment[] {
    //     return this.parts.map(part => part);
    // }
}


////////////////////////////////////////////////////////////////////////////
// #region Flex Part
////////////////////////////////////////////////////////////////////////////

export class FlexPart extends CombinedPathSegment {


    flexConnection: FlexConnection;

    sourceFlexNode: FlexNode;
    targetFlexNode: FlexNode;

    nextPart: FlexPart | undefined;
    previousPart: FlexPart | undefined;

    linkedPart: FlexPart | undefined;

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

        this.linkedPart = this.sourceFlexNode.getPartTo(this.targetFlexNode);
        if (this.linkedPart) {
            this.segments = [this.linkedPart]
        } else {
            // Connections between the same parents are saved to be reused
            // This should not be done between different parents, as parts from nodes to its hypernode can be for different connections
            if (this.hasSameParent()) this.sourceFlexNode.mapTargetNodeToPart.set(this.targetFlexNode, this);
            this.addToContinuum();

            const partMap = this.flexConnection.layouter.mapLayerToFlexParts;
            if (!partMap.has(this.layerFromTop)) {
                partMap.set(this.layerFromTop, []);
            }

            partMap.get(this.layerFromTop)!.push(this);
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

    isCounterPartOf(nextPart?: FlexPart) {
        if (!nextPart) return false;
        return this.sourceFlexNode === nextPart.targetFlexNode && this.targetFlexNode === nextPart.sourceFlexNode;
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
                this.sourceFlexNode.innerContinuum.addPart(this);
                this.targetFlexNode.innerContinuum.addPart(this);
            }
        } else {
            if (source.isRealNode) this.sourceFlexNode.outerContinuum.addPart(this);
            if (target.isRealNode) this.targetFlexNode.outerContinuum.addPart(this);
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
            this.layoutPartNodeConnection();
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
        const sourceAnchor = this.sourceFlexNode.innerContinuum.getAnchorForPart(this, "out");
        const targetAnchor = this.targetFlexNode.innerContinuum.getAnchorForPart(this, "in");

        this.segments = [new SmoothSplineSegment(this.connection, sourceAnchor, targetAnchor)];
    }


    layoutPartNodeConnection() {

        // First, determine the direction of the connection:
        // - node to part OR
        // - part to node

        // TODO:: is this reliable?
        // Path to node if the source node is a hyper node
        const isPartToNode = this.sourceFlexNode.layoutNode.isHyperNode;
        const adjacentPart = isPartToNode ? this.previousPart : this.nextPart;
        const flexNode = isPartToNode ? this.targetFlexNode : this.sourceFlexNode;
        const node = flexNode.layoutNode;

        if (!adjacentPart) {
            console.error("No adjacent part for connection", this);
            return;
        }

        const partAnchor = isPartToNode ? adjacentPart.endAnchor : adjacentPart.startAnchor;

        if (!partAnchor) {
            console.error("No part anchor for connection", this);
            return;
        }

        let segment: PathSegment | undefined = undefined;

        // In the best case, we can connect the part to the node with a single circular arc
        const connectingCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(node.center, partAnchor);
        if (connectingCircle) {
            const intersections = node.outerCircle.intersect(connectingCircle);
            const nodeIntersectionPoint = RadialUtils.getClosestShapeToPoint(intersections, partAnchor.anchorPoint);

            const startPoint = isPartToNode ? partAnchor.anchorPoint : nodeIntersectionPoint;
            const endPoint = isPartToNode ? nodeIntersectionPoint : partAnchor.anchorPoint;

            segment = new EllipticArc(this.connection,
                startPoint,
                endPoint,
                connectingCircle.r,
                connectingCircle.r
            ).direction("clockwise");

            // Check if the anchor is correctly oriented
            const segmentAnchor = isPartToNode ? segment.startAnchor : segment.endAnchor;
            if (!partAnchor.isSimilarTo(segmentAnchor)) {
                (segment as EllipticArc).direction("counter-clockwise");
            }
        }

        // The circle segment could be outside the valid outer range of the node
        // In this case, we have to adapt it
        const anchorAtNode = isPartToNode ? segment?.endAnchor : segment?.startAnchor;
        const arcRad = anchorAtNode ? RadialUtils.radOfPoint(anchorAtNode?.anchorPoint, node.center) : undefined;

        // TODO: Better construction of the spline points. Not just take a straight line from the hyperarc to the node, but instead take a point that respects the curvature

        // If the arc is not valid valid, we construct something better
        const continuum = flexNode.outerContinuum;
        if (!arcRad || !continuum.isInside(arcRad)) {

            // If the arc is not valid, we construct a spline from the hyperarc to the node
            const vectorNodeToPartAnchor = new Vector(node.center, partAnchor.anchorPoint);
            // isPartToNode ?
            // new Vector(partAnchor.anchorPoint, node.center).rotate(Math.PI) :
            // new Vector(node.center, partAnchor.anchorPoint);

            if (continuum.isInside(vectorNodeToPartAnchor.slope)) {
                const nodeAnchor = new Anchor(node.center, vectorNodeToPartAnchor).move(node.outerRadius);
                segment = isPartToNode ?
                    new SmoothSplineSegment(this.connection, partAnchor, nodeAnchor.cloneReversed()) :
                    new SmoothSplineSegment(this.connection, nodeAnchor, partAnchor);
            } else {
                const anchor1 = new Anchor(node.center, new Vector(continuum.range[0])).move(node.outerRadius);
                const anchor2 = new Anchor(node.center, new Vector(continuum.range[1])).move(node.outerRadius);
                const closerAnchor = RadialUtils.getClosestShapeToPoint([anchor1, anchor2], partAnchor.anchorPoint, a => a.anchorPoint);
                if (closerAnchor) {
                    segment = isPartToNode ?
                        new SmoothSplineSegment(this.connection, partAnchor, closerAnchor.cloneReversed()) :
                        new SmoothSplineSegment(this.connection, closerAnchor, partAnchor);
                }
            }
        }


        // console.log("Calculate path to node", {
        //     source: this.sourceFlexNode.id,
        //     target: this.targetFlexNode.id,
        //     part: adjacentPart.id,
        //     node: flexNode.id,
        //     // previousPart: this.previousPart,
        //     // nextPart: this.nextPart,
        //     isPathToNode: isPartToNode,
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


