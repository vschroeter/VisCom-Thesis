import { CombinedPathSegment, PathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { FlexNode } from "./flexNode";
import { FlexConnectionLayouter, FlexOrLayoutNode } from "./flexLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { Vector, Circle, Point, Segment } from "2d-geometry";
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

        for (let i = 0; i < connPath.length - 1; i++) {
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
                const path = new FlexPath({
                    flexConnection: this,
                    startNode: sNode,
                    endNode: tNode,
                    nodePath: flexNodePath.slice(i, j + 1)
                });  // Create new FlexConnectionPath instance
                this.paths.push(path); // Add to paths

                // console.log("ADDED FLEX PATH", {
                //     path,
                //     p: path.nodePath.map(n => n.id).join(" -> "),
                //     flexNodePath,
                //     nodePath: path.nodePath,
                //     i,
                //     j,
                //     id: this.connection.id,
                // })

            } else {

                const path = new FlexPath({
                    flexConnection: this,
                    startNode: sNode,
                    endNode: tNode,
                    nodePath: flexNodePath.slice(i, j + 1),
                    // constraints: flexNodePath.slice(i, j + 1)
                });

                // console.log("ADDED LONG FLEX PATH", {
                //     path,
                //     flexNodePath,
                //     p: path.nodePath.map(n => n.id).join(" -> "),
                //     nodePath: path.nodePath,
                //     i,
                //     j,
                //     id: this.connection.id,
                // })


                // let debug = false;
                // if (this.connection.source.id == "equalizer" && this.connection.target.id == "facialexpressionmanager_node") {
                //     debug = true;

                //     console.log("ADDED FLEX PATH", {
                //         path,
                //         flexNodePath,
                //         nodePath: path.nodePath,
                //         i,
                //         j,
                //         id: this.connection.id,
                //     })
                // }

                this.paths.push(path);
            }



            i = j - 1;
            // i = j;
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

        // For hyper connections, there can be multiple connections (so hyper connection + its child connections)
        // that share the same path.
        // In this case, the path is saved to be reused here
        this.linkedPath = this.sourceFlexNode.getPathTo(this.targetFlexNode);
        if (this.linkedPath) {
            // If there was a linked path, the segments are just the linked path
            this.segments = [this.linkedPath]
        }
        // If there was no linked path, we add this path to be layouted
        else {
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
        if (this.target.id == "flint_node") {
            // if (this.source.id == "drive_manager" && this.target.id == "left_motor_controller") {
            debug = false;
            console.warn({
                s: this.sourceFlexNode,
                t: this.targetFlexNode,
            })

        }

        if (debug) {
            this.source.debugShapes.push(...this.targetFlexNode.outerContinuum.getValidRangeAnchors());
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


        if (!pathAnchor || isNaN(pathAnchor.direction.x) || isNaN(pathAnchor.direction.y)) {
            console.error("No path anchor or direction for connection", this);
        }
        // console.log("NEW FLEX NODE PATH", {
        //     connection: this.connection.id,
        //     pathAnchor: pathAnchor,
        //     pathAnchorDir: pathAnchor.direction.x + " " + pathAnchor.direction.y,
        //     nodePath: this.nodePath.map(n => n.id).join(" -> "),
        // });

        const flexPath = new FlexNodePath(this.connection, this.nodePath, pathAnchor, direction);
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
    nodeAtPathAnchor: FlexNode;

    constrainingNodes: FlexNode[] = [];

    direction: FlexConnectionDirection;

    get isPathToNode() {
        return this.direction === "pathToNode";
    }

    constructor(connection: LayoutConnection, node: FlexNode, pathAnchor: Anchor, nodeAtPathAnchor: FlexNode, constrainingNodes: FlexNode[], direction: FlexConnectionDirection) {
        this.connection = connection;
        this.node = node;
        this.pathAnchor = pathAnchor;
        this.nodeAtPathAnchor = nodeAtPathAnchor;
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

    constructor(connection: LayoutConnection, node: FlexNode, pathAnchor: Anchor, nodeAtPathAnchor: FlexNode, constrainingNodes: FlexNode[], direction: FlexConnectionDirection) {
        super(connection, node, pathAnchor, nodeAtPathAnchor, constrainingNodes, direction);

        if (isNaN(pathAnchor.direction.x) || isNaN(pathAnchor.direction.y)) {
            console.error("Invalid path anchor", pathAnchor);
        }

        this.arcCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(this.node.layoutNode.center, this.pathAnchor);
        try {
            const intersections = this.arcCircle ? node.outerCircle.intersect(this.arcCircle) : [];
            this.nodeIntersection = RadialUtils.getClosestShapeToPoint(intersections, this.pathAnchor.anchorPoint);
        } catch (e) {
            console.error("Error in direct circular arc connection layouting", {
                connection: this.connection,
                arcCircle: this.arcCircle,
                node: this.node,
                pathAnchor: this.pathAnchor
            })
            throw e;
        }
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


            // if (this.connection.source.id == "tts_pico" && this.connection.target.id == "equalizer") {

            //     this.connection.debugShapes.push(this.arcCircle.clone());
            //     this.connection.debugShapes.push(innerCircleIntersection);
            //     this.connection.debugShapes.push(node.layoutNode.innerCircle);

            // }


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
    anchorForNode: Anchor;

    constructor(connection: LayoutConnection, node: FlexNode, pathAnchor: Anchor, nodeAtPathAnchor: FlexNode, constrainingNodes: FlexNode[], direction: FlexConnectionDirection) {
        super(connection, node, pathAnchor, nodeAtPathAnchor, constrainingNodes, direction);

        // const vectorForNode = new Vector(node.center, pathAnchor.anchorPoint);

        this.vectorForNode = this.node.outerContinuum.getValidVectorTowardsDirection(pathAnchor.anchorPoint);
        this.anchorForNode = this.node.outerContinuum.getValidAnchorTowardsDirection(this.pathAnchor.anchorPoint);

        // const anchorDirection = direction == "nodeToPath" ? "out" : "in";
        // const contAnchorForNode = this.node.outerContinuum.getAnchorForPath(this.flexPath, "out");

        // console.warn(this.node.outerContinuum)

        // this.connection.debugShapes.push(this.anchorForNode);
        // this.connection.debugShapes.push(contAnchorForNode);
        // this.connection.debugShapes.push(...(this.node.outerContinuum.getValidRangeAnchors()));


        // this.vectorForNode = new Vector(this.node.center, this.anchorForNode.anchorPoint);
    }

    override isValidForNode(node: FlexNode): boolean {

        // TODO: this can still be improved
        // Maybe by line sampling or something like that

        // If the node is not the node related to the path anchor,
        // we check, whether the vector from the node to the path anchor is inside the valid outer range of the node
        // --> for every other node this should be the case
        if (node != this.nodeAtPathAnchor) {

            const isValid = node.outerContinuum.radIsInside(this.vectorForNode.slope);
            if (!isValid) {
                return false;
            }
        }

        // We also check, whether the connection line between start and end point of the path crosses the inner circle of the node
        // If it does, the connection is not valid
        const segment = new Segment(this.pathAnchor.anchorPoint, this.anchorForNode.anchorPoint);
        const intersections = node.layoutNode.innerCircle.intersect(segment);
        if (intersections.length > 0) {
            return false;
        }

        return true;
    }

    override getPath(): PathSegment | undefined {
        const isPathToNode = this.direction === "pathToNode";
        const anchor = this.anchorForNode;
        const segment = isPathToNode ?
            new SmoothSplineSegment(this.connection, this.pathAnchor, anchor.cloneReversed()) :
            new SmoothSplineSegment(this.connection, anchor, this.pathAnchor);
        return segment;
    }
}


export class CircleSegmentConnectionMethod extends FlexConnectionMethod {

    closerAnchor: Anchor;

    constructor(connection: LayoutConnection, node: FlexNode, pathAnchor: Anchor, nodeAtPathAnchor: FlexNode, constrainingNodes: FlexNode[], direction: FlexConnectionDirection) {
        super(connection, node, pathAnchor, nodeAtPathAnchor, constrainingNodes, direction);

        // this.closerAnchor = this.node.outerContinuum.getValidAnchorTowardsDirection(this.pathAnchor.anchorPoint);

        const anchor1 = new Anchor(node.center, new Vector(this.node.outerContinuum.range[0])).move(node.outerCircle.r);
        const anchor2 = new Anchor(node.center, new Vector(this.node.outerContinuum.range[1])).move(node.outerCircle.r);
        const closerAnchor = RadialUtils.getClosestShapeToPoint([anchor1, anchor2], pathAnchor.anchorPoint, a => a.anchorPoint)!;

        this.closerAnchor = closerAnchor;
    }

    override isValidForNode(node: FlexNode): boolean {
        return true;
    }

    override getPath(): PathSegment | undefined {

        // TODO: Distribute this over a node continuum
        const circle = this.nodeAtPathAnchor.circle.clone();
        circle.r *= 0.9;
        // const circleSegment = new SmoothCircleSegment(this.connection, pathAnchor, correctlyOrientedAnchor, circle);

        const circleSegment = this.isPathToNode ?
            new SmoothCircleSegment(this.connection, this.pathAnchor, this.closerAnchor.cloneReversed(), circle) :
            new SmoothCircleSegment(this.connection, this.closerAnchor, this.pathAnchor, circle);

        return circleSegment;
    }
}


export class FlexNodePath extends CombinedPathSegment {


    static candidates = [
        DirectCircularArcConnectionMethod,
        SmoothSplineConnectionMethod,
        CircleSegmentConnectionMethod
    ]

    nodePath: FlexNode[] = [];

    pathAnchor: Anchor;

    direction: FlexConnectionDirection;

    constructor(connection: LayoutConnection, nodePath: FlexNode[], pathAnchor: Anchor, direction: FlexConnectionDirection) {
        super(connection);
        this.nodePath = nodePath;
        this.pathAnchor = pathAnchor;
        this.direction = direction;

        if (isNaN(pathAnchor.direction.x) || isNaN(pathAnchor.direction.y)) {
            console.error("Invalid FLEX NODE PATH", pathAnchor);
        }


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
        // if (this.connection.source.id == "equalizer" && this.connection.target.id == "facialexpressionmanager_node") {
        // if (this.connection.source.id == "dialog_session_manager" && this.connection.target.id == "facialexpressionmanager_node") {
        if (this.connection.source.id == "tts_pico" && this.connection.target.id == "equalizer") {
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
        for (let ci = 0; ci < FlexNodePath.candidates.length; ci++) {
            const candidateCls = FlexNodePath.candidates[ci];

            if (debug) console.log("Try candidate", candidateCls.name, this.nodePath.map(n => n.id).join(" -> "), this);

            const node = this.direction === "nodeToPath" ? this.nodePath[0] : this.nodePath[this.nodePath.length - 1];
            const nodeAtPathAnchor = this.direction === "nodeToPath" ? this.nodePath[this.nodePath.length - 1] : this.nodePath[0];

            const candidate = new candidateCls(this.connection, node, this.pathAnchor, nodeAtPathAnchor, this.nodePath, this.direction);
            // const candidate = new candidateCls(this.connection, node, this.pathAnchor, this.constrainingNodes, this.direction);
            if (candidate.isValidPath()) {
                // Save the found path
                this.segments = [candidate.getPath()!];


                // Finish
                if (debug) console.log("Valid path found with candidate", candidateCls.name);
                return true;
            }

            // if !foundYet, shorten the path and try again recursively
            // We shorten the path only for totalPathLength - 1, so that the last checked path is still a path between two nodes
            const totalPathLength = this.nodePath.length;
            for (let i = 1; i < totalPathLength - 1; i++) {
                const currentPathLength = this.nodePath.length - i;
                const restPathLength = i;

                const { shortenedPath, shortenedRestPath } = this.getShortenedPath(i);

                if (debug) {
                    console.log("Shortened path", {
                        i,
                        nodePath: this.nodePath.map(n => n.id).join(" -> "),
                        shortenedPath: shortenedPath.map(n => n.id).join(" -> "),
                        shortenedRestPath: shortenedRestPath.map(n => n.id).join(" -> "),
                    });
                }


                const shortenedFlexPath = this.createFlexPath(shortenedPath);
                const success = shortenedFlexPath.layoutFlexConnection();

                if (success) {

                    const nodeAnchor = shortenedFlexPath.nodeAnchor;
                    if (!nodeAnchor || isNaN(nodeAnchor.direction.x) || isNaN(nodeAnchor.direction.y)) {
                        console.error("Invalid node anchor", nodeAnchor, shortenedFlexPath);
                    }

                    const shortenedRestFlexPath = this.createFlexPath(shortenedRestPath, shortenedFlexPath.nodeAnchor);
                    const success = shortenedRestFlexPath.layoutFlexConnection();

                    if (success) {
                        // Save the found path
                        this.segments = [shortenedFlexPath, shortenedRestFlexPath];
                        return true;
                    }

                }
            }
        }

        // if (debug)

        console.warn("No valid path found", this);
        return false;
    }

    createFlexPath(nodePath: FlexNode[], pathAnchor: Anchor = this.pathAnchor) {
        const path = new FlexNodePath(this.connection, nodePath, pathAnchor, this.direction);
        return path;
    }


    getShortenedPath(shortenCount: number) {

        // [p] -> [] -> [] shortened by 1 ==>
        // [p] -> [] || [] with left == path and right == rest
        if (this.direction === "pathToNode") {
            const shortenedPath = this.nodePath.slice(0, this.nodePath.length - shortenCount);
            const shortenedRestPath = this.nodePath.slice(this.nodePath.length - shortenCount);
            return { shortenedPath, shortenedRestPath };
        }
        // [] -> [] -> [p] shortened by 1 ==>
        // [] || [] -> [p] with left == rest and right == path
        else {

            const index = shortenCount;
            const shortenedPath = this.nodePath.slice(index);
            const shortenedRestPath = this.nodePath.slice(0, index);
            return { shortenedPath, shortenedRestPath };
        }

    }


}
