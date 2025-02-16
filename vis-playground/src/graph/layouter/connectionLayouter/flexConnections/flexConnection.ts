import { CombinedPathSegment, PathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { FlexNode } from "./flexNode";
import { FlexConnectionLayouter, FlexOrLayoutNode } from "./flexLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { Vector, Circle, Point } from "2d-geometry";
import { Anchor, EllipticArc } from "src/graph/graphical";
import { RadialCircularArcConnectionLayouter } from "../radialConnections";
import { SmoothSplineSegment } from "src/graph/graphical/primitives/pathSegments/SmoothSpline";
import { RadialUtils } from "../../utils/radialUtils";
import { SmoothCircleSegment } from "src/graph/graphical/primitives/pathSegments/SmoothCircleSegment";


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
        const flexNodePath = connPath.map(node => this.layouter.getFlexNode(node));
        const nodePath = connPath.map(node => node.id).join(" -> ")



        let lastPath: FlexPath | undefined = undefined;

        for (let i = 0; i < connPath.length - 1; i++) {
            // const sNode = connPath[i];
            // const tNode = connPath[i + 1];


            // i is always the start node
            const sNode = connPath[i];
            // the end node is the next node, that either has the same parent as s OR that is a node before a node with the same parent
            let j = i + 1;
            let tNode = connPath[j];

            while (tNode.parent != sNode.parent) {
                const nextNode = connPath[j + 1];
                if (!nextNode || nextNode.parent == tNode.parent) {
                    break;
                }
                tNode = nextNode;
                j++;
            }

            // sNode.layerFromBot

            if (sNode.parent == tNode.parent) {
                // Inside parent connection
                // lastPath = new SameParentConnection();  // Create new FlexConnectionPath instance
                const path = new FlexPath({
                    flexConnection: this,
                    startNode: sNode,
                    endNode: tNode,
                    nodePath: flexNodePath.slice(i, i + 2)
                });  // Create new FlexConnectionPath instance
                this.paths.push(path); // Add to paths
                lastPath = path; // Update lastPath

            } else {

                // let realNode: LayoutNode | undefined = tNode;
                // const constrainingNodes: LayoutNode[] = [];
                // let j = i + 1;
                // while (realNode && realNode.isHyperNode) {
                //     constrainingNodes.push(realNode)
                //     realNode = connPath[++j];
                // }

                // const path = new FlexPath({
                //     flexConnection: this,
                //     startNode: sNode,
                //     endNode: tNode,
                //     nodePath: flexNodePath.slice(i, j + 1),
                //     constraints: constrainingNodes
                // });

                const path = new FlexPath({
                    flexConnection: this,
                    startNode: sNode,
                    endNode: tNode,
                    nodePath: flexNodePath.slice(i, j + 1),
                    // constraints: flexNodePath.slice(i, j + 1)
                });


                let debug = false;
                if (this.connection.source.id == "equalizer" && this.connection.target.id == "facialexpressionmanager_node") {
                    debug = true;

                    console.log("ADDED FLEX PATH", {
                        path,
                        flexNodePath,
                        nodePath: path.nodePath,
                        i,
                        j,
                        id: this.connection.id,
                    })
                }

                this.paths.push(path);
                lastPath = path;
            }

            i = j - 1;
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

    nodePath: FlexNode[] = [];

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
        nodePath?: FlexNode[];
    }) {
        super(options.flexConnection.connection);
        this.flexConnection = options.flexConnection;
        this.sourceFlexNode = this.flexConnection.layouter.getFlexNode(options.startNode);
        this.targetFlexNode = this.flexConnection.layouter.getFlexNode(options.endNode);
        if (options.constraints) {
            this.constraints = options.constraints.map(constraint => this.flexConnection.layouter.getFlexNode(constraint));
        }
        if (options.nodePath) {
            this.nodePath = Array.from(options.nodePath);
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
        const direction = isPathToNode ? "pathToNode" : "nodeToPath";
        const adjacentPath = isPathToNode ? this.previousPath : this.nextPath;
        const flexNode = isPathToNode ? this.targetFlexNode : this.sourceFlexNode;
        const node = flexNode.layoutNode;

        if (!adjacentPath) {
            console.error("No adjacent path for connection", this);
            return;
        }


        let debug = false;
        if (this.source.id == "flint_node" && this.target.id == "tts_pico") {
            debug = true;
        }

        if (debug) {
            // this.source.debugShapes.push(...this.targetFlexNode.outerContinuum.getValidRangeAnchors());
        }

        const pathAnchor = isPathToNode ? adjacentPath.endAnchor : adjacentPath.startAnchor;

        if (!pathAnchor) {
            console.error("No path anchor for connection", this);
            return;
        }


        if (this.connection.source.id == "equalizer" && this.connection.target.id == "facialexpressionmanager_node") {
            debug = true;
            // console.log("[INVALID]", this);

            // const c1 = this.arcCircle!.clone();
            // const c2 = node.layoutNode.innerCircle.clone();

            // c1._data = { stroke: "blue" };
            // c2._data = { stroke: "green" };

            // this.connection.debugShapes.push(c1);
            // this.connection.debugShapes.push(c2);

            console.log("NEW FLEX PATH1", {
                nodePath: this.nodePath,
                this: this
            });
        }

        const flexPath = new FlexPath1(this.connection, this.nodePath, pathAnchor, direction);
        flexPath.layoutFlexConnection();
        this.segments = [flexPath];

        return;


        // if (!pathAnchor) {
        //     console.error("No path anchor for connection", this);
        //     return;
        // }

        // let segment: PathSegment | undefined = undefined;

        // // In the best case, we can connect the path to the node with a single circular arc
        // const connectingCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(node.center, pathAnchor);
        // if (connectingCircle) {
        //     const intersections = node.outerCircle.intersect(connectingCircle);
        //     const nodeIntersectionPoint = RadialUtils.getClosestShapeToPoint(intersections, pathAnchor.anchorPoint);

        //     const startPoint = isPathToNode ? pathAnchor.anchorPoint : nodeIntersectionPoint;
        //     const endPoint = isPathToNode ? nodeIntersectionPoint : pathAnchor.anchorPoint;

        //     segment = new EllipticArc(this.connection,
        //         startPoint,
        //         endPoint,
        //         connectingCircle.r,
        //         connectingCircle.r
        //     ).direction("clockwise");

        //     // Check if the anchor is correctly oriented
        //     const segmentAnchor = isPathToNode ? segment.startAnchor : segment.endAnchor;
        //     if (!pathAnchor.isSimilarTo(segmentAnchor)) {
        //         (segment as EllipticArc).direction("counter-clockwise");
        //     }

        //     if (debug) {
        //         // this.source.debugShapes.push(connectingCircle);
        //     }

        // }



        // // The circle segment could be outside the valid outer range of the node
        // // In this case, we have to adapt it
        // const anchorAtNode = isPathToNode ? segment?.endAnchor : segment?.startAnchor;
        // const arcRad = anchorAtNode ? RadialUtils.radOfPoint(anchorAtNode?.anchorPoint, node.center) : undefined;

        // // TODO: Better construction of the spline points. Not just take a straight line from the hyperarc to the node, but instead take a point that respects the curvature

        // // If the arc is not valid, we construct something better
        // const continuum = flexNode.outerContinuum;
        // if (!arcRad || !continuum.radIsInside(arcRad)) {

        //     // If the arc is not valid, we construct either:
        //     // - a smooth spline from the hyperarc to the node, IF the arc is inside the valid range of the node
        //     // - a circle segment from the hyperarc to the node, IF the arc is outside the valid range of the node

        //     const vectorNodeToPathAnchor = new Vector(node.center, pathAnchor.anchorPoint);

        //     if (continuum.radIsInside(vectorNodeToPathAnchor.slope)) {
        //         const nodeAnchor = new Anchor(node.center, vectorNodeToPathAnchor).move(node.outerRadius);
        //         segment = isPathToNode ?
        //             new SmoothSplineSegment(this.connection, pathAnchor, nodeAnchor.cloneReversed()) :
        //             new SmoothSplineSegment(this.connection, nodeAnchor, pathAnchor);
        //     } else {
        //         const anchor1 = new Anchor(node.center, new Vector(continuum.range[0])).move(node.outerRadius);
        //         const anchor2 = new Anchor(node.center, new Vector(continuum.range[1])).move(node.outerRadius);
        //         const closerAnchor = RadialUtils.getClosestShapeToPoint([anchor1, anchor2], pathAnchor.anchorPoint, a => a.anchorPoint);
        //         if (closerAnchor) {
        //             const correctlyOrientedAnchor = isPathToNode ? closerAnchor.cloneReversed() : closerAnchor;
        //             // segment = isPathToNode ?
        //             //     new SmoothSplineSegment(this.connection, pathAnchor, closerAnchor.cloneReversed()) :
        //             //     new SmoothSplineSegment(this.connection, closerAnchor, pathAnchor);


        //             // Create a smooth connecting circle

        //             // const registeredAnchor = flexNode.outerContinuum.registerAnchor(pathAnchor);

        //             const circle = node.parent!.circle.clone();
        //             circle.r *= 0.9;
        //             // const circleSegment = new SmoothCircleSegment(this.connection, pathAnchor, correctlyOrientedAnchor, circle);

        //             const circleSegment = isPathToNode ?
        //                 new SmoothCircleSegment(this.connection, pathAnchor, correctlyOrientedAnchor, circle) :
        //                 new SmoothCircleSegment(this.connection, correctlyOrientedAnchor, pathAnchor, circle);

        //             segment = circleSegment;
        //             // if (debug) {
        //             //     circleSegment.getSvgPath();
        //             // }
        //         }

        //         // segment = circleSegment;
        //     }
        // }


        // if (!segment) {
        //     console.error("No segment for connection", this);
        //     return;
        // }
        // this.segments = [segment];


    }




}


export type FlexConnectionDirection = "pathToNode" | "nodeToPath";

export abstract class FlexConnectionMethod {
    // nodePath: FlexNode[] = [];

    connection: LayoutConnection;

    node: FlexNode;
    pathAnchor: Anchor;

    constrainingNodes: FlexNode[] = [];

    direction: FlexConnectionDirection;

    constructor(connection: LayoutConnection, node: FlexNode, pathAnchor: Anchor, constrainingNodes: FlexNode[], direction: FlexConnectionDirection) {
        this.connection = connection;
        this.node = node;
        this.pathAnchor = pathAnchor;
        this.constrainingNodes = constrainingNodes;
        this.direction = direction;
    }


    isValidPath(): boolean {
        return this.constrainingNodes.every(node => this.isValidForNode(node));
    }

    abstract isValidForNode(node: FlexNode): boolean;

    abstract getPath(): PathSegment | undefined;
}


export class DirectCircularArcConnectionMethod extends FlexConnectionMethod {

    arcCircle: Circle | undefined;
    nodeIntersection: Point | undefined;

    constructor(connection: LayoutConnection, node: FlexNode, pathAnchor: Anchor, constrainingNodes: FlexNode[], direction: FlexConnectionDirection) {
        super(connection, node, pathAnchor, constrainingNodes, direction);

        this.arcCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(this.node.layoutNode.center, this.pathAnchor);
        const intersections = this.arcCircle ? node.outerCircle.intersect(this.arcCircle) : [];
        this.nodeIntersection = RadialUtils.getClosestShapeToPoint(intersections, this.pathAnchor.anchorPoint);
    }

    override isValidForNode(node: FlexNode): boolean {

        if (!this.arcCircle || !this.nodeIntersection) return false;

        // Here we check, whether the arc crosses the inner circle of the node
        // If it does, the connection is not valid
        const intersections = node.layoutNode.innerCircle.intersect(this.arcCircle);
        if (intersections.length > 0) {

            const pathDirection = this.pathAnchor.getDirectionRegardingCircle(this.arcCircle);

            const innerCircleIntersection = RadialUtils.getClosestShapeToPoint(intersections, this.pathAnchor.anchorPoint)!;

            const radOfPathAnchor = RadialUtils.radOfPoint(this.pathAnchor.anchorPoint, this.arcCircle.center);
            const radOfNodeIntersection = RadialUtils.radOfPoint(this.nodeIntersection, this.arcCircle.center);
            const radOfInnerCircleIntersection = RadialUtils.radOfPoint(innerCircleIntersection, this.arcCircle.center);

            const forwardRadPathToNode = RadialUtils.forwardRadBetweenAngles(radOfPathAnchor, radOfNodeIntersection);
            const forwardRadPathToInnerCircle = RadialUtils.forwardRadBetweenAngles(radOfPathAnchor, radOfInnerCircleIntersection);

            // If the inner circle intersection is further away than the node intersection, the connection is valid

            if (this.direction == "nodeToPath") {
                if (pathDirection == "counter-clockwise") {
                    return RadialUtils.forwardRadBetweenAngles(radOfPathAnchor, radOfInnerCircleIntersection) > RadialUtils.forwardRadBetweenAngles(radOfPathAnchor, radOfNodeIntersection);
                } else {
                    return RadialUtils.forwardRadBetweenAngles(radOfInnerCircleIntersection, radOfPathAnchor) > RadialUtils.forwardRadBetweenAngles(radOfNodeIntersection, radOfPathAnchor);
                }

                // if ((pathDirection == "clockwise" && forwardRadPathToInnerCircle > forwardRadPathToNode) ||
                //     (pathDirection == "counter-clockwise" && forwardRadPathToInnerCircle < forwardRadPathToNode)
                // ) {
                //     return true;
                // }
            } else {
                if (pathDirection == "counter-clockwise") {
                    return RadialUtils.forwardRadBetweenAngles(radOfInnerCircleIntersection, radOfPathAnchor) > RadialUtils.forwardRadBetweenAngles(radOfNodeIntersection, radOfPathAnchor);
                } else {
                    return RadialUtils.forwardRadBetweenAngles(radOfPathAnchor, radOfInnerCircleIntersection) > RadialUtils.forwardRadBetweenAngles(radOfPathAnchor, radOfNodeIntersection);
                }
            }



            return false;
        }
        return true;

        // This checks, if the arc is at the outer valid range of the node
        // However, this would be wrong, as direct circular connections already arrive at an invalid range
        // const intersections = this.arcCircle.intersect(node.outerCircle);
        // const nodeIntersection = RadialUtils.getClosestShapeToPoint(intersections, this.pathAnchor.anchorPoint);

        // if (!nodeIntersection) return true;

        // return node.outerContinuum.pointIsInside(nodeIntersection);
    }


    override getPath(): PathSegment | undefined {
        // In the best case, we can connect the path to the node with a single circular arc

        const isPathToNode = this.direction === "pathToNode";

        if (this.arcCircle && this.nodeIntersection) {
            const startPoint = isPathToNode ? this.pathAnchor.anchorPoint : this.nodeIntersection;
            const endPoint = isPathToNode ? this.nodeIntersection : this.pathAnchor.anchorPoint;

            const segment = new EllipticArc(this.connection,
                startPoint,
                endPoint,
                this.arcCircle.r,
                this.arcCircle.r
            ).direction("clockwise");

            // Check if the anchor is correctly oriented
            const segmentAnchor = isPathToNode ? segment.startAnchor : segment.endAnchor;
            if (!this.pathAnchor.isSimilarTo(segmentAnchor)) {
                (segment as EllipticArc).direction("counter-clockwise");
            }

            return segment;
        }

        return undefined;
    }
}

export class SmoothSplineConnectionMethod extends FlexConnectionMethod {

    vectorForNode: Vector;

    constructor(connection: LayoutConnection, node: FlexNode, pathAnchor: Anchor, constrainingNodes: FlexNode[], direction: FlexConnectionDirection) {
        super(connection, node, pathAnchor, constrainingNodes, direction);

        // const vectorForNode = new Vector(node.center, pathAnchor.anchorPoint);

        this.vectorForNode = node.outerContinuum.getValidVectorTowardsDirection(pathAnchor.anchorPoint)

    }

    override isValidForNode(node: FlexNode): boolean {

        // TODO: this has to be improved
        // At the moment, it just checks, whether the control points of the bezier are outside


        return true;



        // const vectorNodeToPathAnchor = new Vector(node.center, pathAnchor.anchorPoint);

        // if (continuum.radIsInside(vectorNodeToPathAnchor.slope)) {
        //     const nodeAnchor = new Anchor(node.center, vectorNodeToPathAnchor).move(node.outerRadius);
        //     segment = isPathToNode ?
        //         new SmoothSplineSegment(this.connection, pathAnchor, nodeAnchor.cloneReversed()) :
        //         new SmoothSplineSegment(this.connection, nodeAnchor, pathAnchor);
        // }

    }

    override getPath(): PathSegment | undefined {
        const isPathToNode = this.direction === "pathToNode";
        const anchor = this.node.outerContinuum.getValidAnchorTowardsDirection(this.pathAnchor.anchorPoint);

        const segment = isPathToNode ?
            new SmoothSplineSegment(this.connection, this.pathAnchor, anchor.cloneReversed()) :
            new SmoothSplineSegment(this.connection, anchor, this.pathAnchor);
        return segment;
    }
}


export class FlexPath1 extends CombinedPathSegment {


    static candidates = [
        DirectCircularArcConnectionMethod,
        SmoothSplineConnectionMethod,
        // CircleSegmentConnectionMethod
    ]

    nodePath: FlexNode[] = [];

    pathAnchor: Anchor;

    direction: FlexConnectionDirection;

    constructor(connection: LayoutConnection, nodePath: FlexNode[], pathAnchor: Anchor, direction: FlexConnectionDirection) {
        super(connection);
        this.nodePath = nodePath;
        this.pathAnchor = pathAnchor;
        this.direction = direction;
    }

    // The other anchor (thus, not the given path anchor), if existing
    get nodeAnchor(): Anchor | undefined {
        if (this.direction == "pathToNode") {

            if (this.nodePath.length > 0) {
                const lastSegment = this.segments[this.segments.length - 1];
                return lastSegment.endAnchor;
            }
            return undefined;
        } else {

            if (this.nodePath.length > 0) {
                const firstSegment = this.segments[0];
                return firstSegment.startAnchor;
            }
            return undefined;
        }
    }

    layoutFlexConnection() {


        // Order to try connection segments:
        // - Direct circle arc
        // - Smooth spline
        // - Circle segment

        // Connection order (from path to target node):
        // - path -> node --> check if from node to path every subnode allows the connection
        // If not valid, take the highest node that allows the connection. Connect the rest with connection candidates recursively
        // If no connection is possible, take the next candidate


        /**
        Connect process:

        Path (from node n to path segment p):
            Note: p is the anchor, so from p we shorten the path in the next steps
        [n] -> [] -> [] -> [] -> [p]

        First, check for all possible connection candidates
        [n] -> [] -> [] -> [] -> [p] with DirectCircularArc
        [n] -> [] -> [] -> [] -> [p] with SmoothSpline
        [n] -> [] -> [] -> [] -> [p] with CircleSegment

        If there is a valid path, store it and finish

        If not:
        1. Shorten)
        [n] -> p_from_other_part || [] -> [] -> [] -> [p] --> recursively apply connect process to both parts
            First the part containing p is checked, if valid the resulting anchor is passed to the part containing n
            If valid, store it and finish both flex paths as parts and finish

        2. Shorten)
        [n] -> [] -> p_from_other_part || [] -> [] -> [p] --> recursively apply connect process to both parts, like above
            If valid, store it and finish both flex paths as parts and finish

        3. Shorten)
        [n] -> [] -> [] -> p_from_other_part || [] -> [p] --> recursively apply connect process to both parts, like above
            If valid, store it and finish both flex paths as parts and finish

        4. Shorten)
        [n] -> [] -> [] -> [] -> p_from_other_part || [p] --> recursively apply connect process to both parts, like above
            If valid, store it and finish both flex paths as parts and finish

        If this is not possible, there is an error. The last candidate should always be a valid path

         */


        let debug = false;
        if (this.connection.source.id == "equalizer" && this.connection.target.id == "facialexpressionmanager_node") {
            debug = true;
            // console.log("[INVALID]", this);

            // const c1 = this.arcCircle!.clone();
            // const c2 = node.layoutNode.innerCircle.clone();

            // c1._data = { stroke: "blue" };
            // c2._data = { stroke: "green" };

            // this.connection.debugShapes.push(c1);
            // this.connection.debugShapes.push(c2);
        }


        // Check for each candidate, if it is a valid path
        for (let ci = 0; ci < FlexPath1.candidates.length; ci++) {
            const candidateCls = FlexPath1.candidates[ci];

            if (debug) console.log("Try candidate", candidateCls.name, this.nodePath.map(n => n.id).join(" -> "), this);

            const node = this.direction === "nodeToPath" ? this.nodePath[0] : this.nodePath[this.nodePath.length - 1];

            const candidate = new candidateCls(this.connection, node, this.pathAnchor, this.nodePath, this.direction);
            if (candidate.isValidPath()) {
                // Save the found path
                this.segments = [candidate.getPath()!];


                // Finish
                if (debug) console.log("Valid path found with candidate", candidateCls.name);
                return true;
            }
        }

        // if !foundYet, shorten the path and try again recursively
        const totalPathLength = this.nodePath.length;
        for (let i = 1; i < totalPathLength; i++) {
            const currentPathLength = this.nodePath.length - i;
            const restPathLength = i;

            const { shortenedPath, shortenedRestPath } = this.getShortenedPath(i);

            const shortenedFlexPath = this.createFlexPath(shortenedPath);
            const success = shortenedFlexPath.layoutFlexConnection();

            if (success) {

                const shortenedRestFlexPath = this.createFlexPath(shortenedRestPath, shortenedFlexPath.nodeAnchor);
                const success = shortenedRestFlexPath.layoutFlexConnection();

                if (success) {
                    // Save the found path
                    this.segments = [shortenedFlexPath, shortenedRestFlexPath];
                    return true;
                }

            }
        }
        if (debug) console.log("No valid path found");
        return false;
    }

    createFlexPath(nodePath: FlexNode[], pathAnchor: Anchor = this.pathAnchor) {
        const path = new FlexPath1(this.connection, nodePath, pathAnchor, this.direction);
        return path;
    }


    getShortenedPath(shortenCount: number) {

        // [p] -> [] -> [] shortened by 1 ==>
        // [p] -> [] || []
        if (this.direction === "pathToNode") {
            const shortenedPath = this.nodePath.slice(0, this.nodePath.length - shortenCount);
            const shortenedRestPath = this.nodePath.slice(this.nodePath.length - shortenCount);
            return { shortenedPath, shortenedRestPath };
        }
        // [] -> [] -> [p] shortened by 1 ==>
        // [] || [] -> [p]
        else {

            const index = shortenCount;
            const shortenedPath = this.nodePath.slice(-index);
            const shortenedRestPath = this.nodePath.slice(0, this.nodePath.length - index);
            return { shortenedPath, shortenedRestPath };
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


