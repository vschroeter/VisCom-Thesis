import { CombinedPathSegment, PathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { FlexNode } from "./flexNode";
import { FlexConnectionLayouter, FlexOrLayoutNode } from "./flexLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { Vector, Circle } from "2d-geometry";
import { EllipticArc } from "src/graph/graphical";
import { RadialCircularArcConnectionLayouter } from "../radialConnections";


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


        console.log("FLEX", {
            source: this.source.id,
            target: this.target.id,
            path: nodePath,
            parts: this.parts.map(part => part.sourceFlexNode.id + " -> " + part.targetFlexNode.id + " (" + part.layerFromBot + ")")
        })

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

        this.addToContinuum();

        const partMap = this.flexConnection.layouter.mapLayerToFlexParts;
        if (!partMap.has(this.layerFromTop)) {
            partMap.set(this.layerFromTop, []);
        }

        partMap.get(this.layerFromTop)!.push(this);
    }

    // override getSvgPath(): string {
    //     if (this.segments.length === 0) {
    //         return "";
    //     }

    //     return this.segments.filter(s => s !== undefined).map(s => s.getSvgPath()).join(" ");
    // }

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

        if (this.isCircleArc()) {
            this.layoutCircleArc();
            return;
        }
    }


    layoutCircleArc() {
        console.log("Calculate direct circle arc connection", this.connection.source.id, this.connection.target.id);
        const source = this.connection.source;
        const target = this.connection.target;
        // const parent = source.parent;
        const parent = source.getCommonParent(target);

        const hyperSource = parent?.getChildNodeContainingNodeAsDescendant(source);
        const hyperTarget = parent?.getChildNodeContainingNodeAsDescendant(target);

        const sourceCircle = source.outerCircle;
        const targetCircle = target.outerCircle;

        const arcSourceCircle = hyperSource?.outerCircle;
        const arcTargetCircle = hyperTarget?.outerCircle;

        let segmentCircle = parent?.innerCircle.clone();

        if (!segmentCircle || !arcSourceCircle || !arcTargetCircle) {
            console.error("No segment circle for connection", this.connection, arcSourceCircle, arcTargetCircle);
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
                segmentCircle.r += 0.0 * Math.min(arcSourceCircle.r, arcTargetCircle.r);
                // segmentCircle.r += 2 * this.connection.weight;
            } else {
                segmentCircle.r -= 0.3 * Math.min(arcSourceCircle.r, arcTargetCircle.r);
                // segmentCircle.r -= 2 * this.connection.weight;
            }
        }

        // If the parent node has only two children, the circle is adapted to be larger, so that the connection is more direct
        if (parent?.children.length === 2) {
            const _centerVector = new Vector(arcSourceCircle.center, arcTargetCircle.center);
            const centerTranslationVector = isForward ? _centerVector.rotate90CW() : _centerVector.rotate90CCW();
            const newCenter = parent.center.translate(centerTranslationVector);
            const newRadius = newCenter.distanceTo(source.center)[0];
            segmentCircle = new Circle(newCenter, newRadius);
            // node.debugShapes.push(adaptedCircle);
        }

        let hyperArc: EllipticArc | undefined;

        try {
            hyperArc = RadialCircularArcConnectionLayouter.getCircularArcBetweenCircles(
                this.connection,
                arcSourceCircle,
                arcTargetCircle,
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


