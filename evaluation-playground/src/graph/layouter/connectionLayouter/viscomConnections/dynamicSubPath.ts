import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { VisNode } from "./visNode";
import { SubPath, SubPathConnectionType } from "./subPath";
import { Anchor, EllipticArc } from "src/graph/graphical";
import { CombinedPathSegment, PathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { Circle, Point, Segment, Vector } from "2d-geometry";
import { SmoothCircleSegment } from "src/graph/graphical/primitives/pathSegments/SmoothCircleSegment";
import { RadialUtils } from "../../utils/radialUtils";
import { SmoothSplineSegment } from "src/graph/graphical/primitives/pathSegments/SmoothSpline";
import { SmoothPathNodeSplineSegment } from "src/graph/graphical/primitives/pathSegments/SmoothPathNodeSpline";


////////////////////////////////////////////////////////////////////////////
// #region Abstract Dynamic Connection Method
////////////////////////////////////////////////////////////////////////////

export abstract class DynamicConnectionMethod {
    get nodePath(): VisNode[] {
        return this.dynamicSubPath.nodePath;
    }

    dynamicSubPath: DynamicSubPath;

    get connection(): LayoutConnection {
        return this.dynamicSubPath.connection;
    }

    get nodeToConnect(): VisNode | undefined {
        return this.dynamicSubPath.nodeToConnect;
    }

    get nodeAtPathAnchor(): VisNode | undefined {
        return this.dynamicSubPath.nodeAtPathAnchor;
    }

    get pathAnchor(): Anchor {
        return this.dynamicSubPath.pathAnchor;
    }

    // constrainingNodes: VisNode[] = [];
    get constrainingNodes(): VisNode[] {
        return this.dynamicSubPath.nodePath;
    }

    get connectionType(): SubPathConnectionType {
        return this.dynamicSubPath.connectionType;
    }

    get isPathToNode() {
        return this.connectionType === "pathToNode";
    }

    get isNodeToPath() {
        return this.connectionType === "nodeToPath";
    }

    constructor(subPath: DynamicSubPath) {
        this.dynamicSubPath = subPath;
        // this.connection = connection;
        // this.node = node;
        // this.pathAnchor = pathAnchor;
        // this.nodeAtPathAnchor = nodeAtPathAnchor;
        // this.constrainingNodes = constrainingNodes;
        // this.connectionType = direction;
    }


    isValidPath(): boolean {
        return this.constrainingNodes.every(node => this.isValidForNode(node));
    }

    abstract isValidForNode(node: VisNode): boolean;

    abstract getPath(): PathSegment | undefined;
}

////////////////////////////////////////////////////////////////////////////
// #region Circle Arc
////////////////////////////////////////////////////////////////////////////

export class DirectCircularArcConnectionMethod extends DynamicConnectionMethod {

    arcCircle: Circle | undefined;
    nodeIntersection: Point | undefined;

    constructor(subPath: DynamicSubPath) {
        super(subPath);

        if (isNaN(this.pathAnchor.direction.x) || isNaN(this.pathAnchor.direction.y)) {
            console.error("Invalid path anchor", this.pathAnchor);
        }

        if (!this.nodeToConnect) throw new Error("Node to connect is not defined");

        this.arcCircle = RadialUtils.getCircleFromCoincidentPointAndTangentAnchor(this.nodeToConnect.layoutNode.center, this.pathAnchor);
        try {
            const intersections = this.arcCircle ? this.nodeToConnect.outerCircle.intersect(this.arcCircle) : [];
            this.nodeIntersection = RadialUtils.getClosestShapeToPoint(intersections, this.pathAnchor.anchorPoint);
        } catch (e) {
            console.error("Error in direct circular arc connection layouting", {
                connection: this.connection,
                arcCircle: this.arcCircle,
                node: this.nodeToConnect,
                pathAnchor: this.pathAnchor
            })
            throw e;
        }
    }

    override isValidForNode(node: VisNode): boolean {

        if (!this.arcCircle || !this.nodeIntersection) return false;

        if (this.nodeToConnect?.outerRange.hasPath(this.dynamicSubPath.subPath)) {
            const validRange = this.nodeToConnect?.outerRange.getRangeForPath(this.dynamicSubPath.subPath);
            const radOfPoint = this.nodeToConnect?.outerRange.getRadOfPoint(this.nodeIntersection);

            if (validRange && radOfPoint && !this.nodeToConnect?.outerRange.radIsInside(radOfPoint, validRange)) {
                return false;
            }
        }

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

            if (this.connectionType == "nodeToPath") {
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

        const isPathToNode = this.connectionType === "pathToNode";

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

////////////////////////////////////////////////////////////////////////////
// #region Smooth Spline
////////////////////////////////////////////////////////////////////////////

export class SmoothSplineConnectionMethod extends DynamicConnectionMethod {

    vectorForNode: Vector;
    anchorForNode: Anchor;

    constructor(subPath: DynamicSubPath) {
        super(subPath);


        // const vectorForNode = new Vector(node.center, pathAnchor.anchorPoint);

        if (!this.nodeToConnect) throw new Error("Node to connect is not defined");

        // this.vectorForNode = this.nodeToConnect.outerRange.getValidVectorTowardsDirection(this.pathAnchor.anchorPoint);
        // this.anchorForNode = this.nodeToConnect.outerRange.getValidAnchorTowardsDirection(this.pathAnchor.anchorPoint);

        const desiredAnchor = this.dynamicSubPath.subPath.getDesiredNodeAnchor(this.nodeToConnect);
        this.anchorForNode = this.nodeToConnect.outerRange.getValidAnchorTowardsDirectionForPath(this.dynamicSubPath.subPath, desiredAnchor?.anchorPoint ?? this.pathAnchor.anchorPoint);
        this.vectorForNode = this.anchorForNode.direction;

        // const anchorDirection = direction == "nodeToPath" ? "out" : "in";
        // const contAnchorForNode = this.node.outerContinuum.getAnchorForPath(this.flexPath, "out");

        // console.warn(this.node.outerContinuum)

        // this.connection.debugShapes.push(this.anchorForNode);
        // this.connection.debugShapes.push(contAnchorForNode);
        // this.connection.debugShapes.push(...(this.node.outerContinuum.getValidRangeAnchors()));


        // this.vectorForNode = new Vector(this.node.center, this.anchorForNode.anchorPoint);
    }

    override isValidForNode(node: VisNode): boolean {
        // return false;
        return true;
        // TODO: this can still be improved
        // Maybe by line sampling or something like that

        // If the node is not the node related to the path anchor,
        // we check, whether the vector from the node to the path anchor is inside the valid outer range of the node
        // --> for every other node this should be the case
        // if (node != this.nodeAtPathAnchor) {

        //     const isValid = node.outerRange.radIsInside(this.vectorForNode.slope);
        //     if (!isValid) {
        //         return false;
        //     }
        // }

        // We also check, whether the connection line between start and end point of the path crosses the inner circle of the node
        // If it does, the connection is not valid
        const segment = new Segment(this.pathAnchor.anchorPoint, this.anchorForNode.anchorPoint);

        // const intersections = node.layoutNode.innerCircle.intersect(segment);
        const circle = node.layoutNode.innerCircle.clone();
        // const circle = node.layoutNode.innerEnclosingCircle.clone();
        const intersections = circle.intersect(segment);
        if (intersections.length > 0) {

            // this.connection.debugShapes.push(segment);
            // this.connection.debugShapes.push(...intersections);
            // this.connection.debugShapes.push(circle);

            // If these intersections are inside the valid range of the node to connect, the connection is still valid
            const validRange = this.nodeToConnect?.outerRange;
            if (validRange && intersections.every(p => validRange!.pointIsInside(p))) {
                return true;
            }



            return false;
        }

        return true;
    }

    override getPath(): PathSegment | undefined {
        const isPathToNode = this.connectionType === "pathToNode";

        const isFinalPath = this.nodeToConnect == this.dynamicSubPath.subPath.targetVisNode;
        const isStartPath = this.nodeToConnect == this.dynamicSubPath.subPath.sourceVisNode;

        const anchor = this.anchorForNode;
        const segment = isPathToNode ?
            // new SmoothSplineSegment(this.connection, this.pathAnchor, anchor.cloneReversed(), undefined, isFinalPath) :
        // new SmoothSplineSegment(this.connection, anchor, this.pathAnchor, undefined, false);

            new SmoothPathNodeSplineSegment(this.connection, this.pathAnchor, anchor.cloneReversed(), this.nodeToConnect!.circle, 0.4, isFinalPath) :
            new SmoothPathNodeSplineSegment(this.connection, anchor, this.pathAnchor, this.nodeToConnect!.circle, 0.4, false, isStartPath);
        return segment;
    }
}


////////////////////////////////////////////////////////////////////////////
// #region Circle Segment
////////////////////////////////////////////////////////////////////////////

export class CircleSegmentConnectionMethod extends DynamicConnectionMethod {

    anchorForNode: Anchor;

    constructor(subPath: DynamicSubPath) {
        super(subPath);

        // this.closerAnchor = this.node.outerContinuum.getValidAnchorTowardsDirection(this.pathAnchor.anchorPoint);

        if (!this.nodeToConnect || !this.nodeAtPathAnchor) throw new Error("Node to connect is not defined");

        // const anchor1 = new Anchor(this.nodeToConnect.center, new Vector(this.nodeToConnect.outerRange.range[0])).move(this.nodeToConnect.outerCircle.r);
        // const anchor2 = new Anchor(this.nodeToConnect.center, new Vector(this.nodeToConnect.outerRange.range[1])).move(this.nodeToConnect.outerCircle.r);
        // const closerAnchor = RadialUtils.getClosestShapeToPoint([anchor1, anchor2], this.pathAnchor.anchorPoint, a => a.anchorPoint)!;

        // this.closerAnchor = closerAnchor;

        this.anchorForNode = this.nodeToConnect.outerRange.getValidAnchorTowardsDirectionForPath(this.dynamicSubPath.subPath, this.pathAnchor.anchorPoint);
        const desiredAnchor = this.dynamicSubPath.subPath.getDesiredNodeAnchor(this.nodeToConnect!);

        // if (desiredAnchor) this.anchorForNode = desiredAnchor;
        // else {
        //     console.error("No desired anchor found", this.nodeToConnect, this.dynamicSubPath.subPath);
        // }

        this.connection.debugShapes.push(this.anchorForNode);

    }

    override isValidForNode(node: VisNode): boolean {
        return true;
    }

    override getPath(): PathSegment | undefined {

        // TODO: Distribute this over a node continuum
        const circle = this.nodeAtPathAnchor!.circle.clone();

        // const range = [0.9, 0.8];
        const range = [0.9, 0.9];
        // const range = [0.95, 0.75];
        const randomR = Math.random() * (range[1] - range[0]) + range[0];

        // circle.r *= 0.9;
        circle.r *= randomR;
        // const circleSegment = new SmoothCircleSegment(this.connection, pathAnchor, correctlyOrientedAnchor, circle);


        const circleSegment = this.isPathToNode ?
            new SmoothCircleSegment(this.connection, this.pathAnchor, this.anchorForNode.cloneReversed(), circle) :
            new SmoothCircleSegment(this.connection, this.anchorForNode, this.pathAnchor, circle);

        return circleSegment;
    }
}



////////////////////////////////////////////////////////////////////////////
// #region Class Dynamic Sub Path
////////////////////////////////////////////////////////////////////////////

export class DynamicSubPath extends CombinedPathSegment {

    /**
     * These are the candidates for connection methods.
     * The order represents the order in which the connection methods are tried.
     */
    static candidates = [
        DirectCircularArcConnectionMethod,
        SmoothSplineConnectionMethod,
        CircleSegmentConnectionMethod
    ]

    /**
     * The node path for this dynamic sub path.
     * In the default case, this contains for nodeToPath type the source node (as real node) up to to hyper node having the path anchor, with potential hypernodes in between.
     * Vice versa for pathToNode type.
     */
    nodePath: VisNode[] = [];

    /**
     * The fixed path anchor for this dynamic sub path.
     * This is one fixed end for the path.
     * The other end is dynamic at the nodeToConnect
     */
    pathAnchor: Anchor;

    // Parent sub path
    subPath: SubPath;

    /**
     * Determines the type and thus the direction of the connection.
     */
    get connectionType(): SubPathConnectionType {
        return this.subPath.connectionType;
    }

    /**
     * The node to connect to.
     * This is the node that the path anchor is NOT attached to.
     * At this node, the path is not fixed yet but determined by ranges.
     */
    get nodeToConnect() {
        if (this.nodePath.length === 0) return undefined;

        if (this.connectionType === "nodeToPath") return this.nodePath[0];
        if (this.connectionType === "pathToNode") return this.nodePath[this.nodePath.length - 1];

        return undefined;
    }

    // The other anchor (thus, not the given path anchor), if existing
    get nodeAnchor(): Anchor | undefined {
        if (this.connectionType == "pathToNode") {

            if (this.nodePath.length > 0) {
                const lastSegment = this.segments[this.segments.length - 1];
                return lastSegment.endAnchor;
            }
            return undefined;
        } else if (this.connectionType == "nodeToPath") {

            if (this.nodePath.length > 0) {
                const firstSegment = this.segments[0];
                return firstSegment.startAnchor;
            }
            return undefined;
        }
    }

    /**
     * The node at the path anchor.
     * This is the node that the path anchor is attached to.
     * At this node, the path is fixed.
     */
    get nodeAtPathAnchor() {
        if (this.nodePath.length === 0) return undefined;

        if (this.connectionType === "nodeToPath") return this.nodePath[this.nodePath.length - 1];
        if (this.connectionType === "pathToNode") return this.nodePath[0];

        return undefined;
    }


    constructor(subPath: SubPath, nodePath?: VisNode[], pathAnchor?: Anchor) {
        super(subPath.connection);
        this.subPath = subPath;

        nodePath = nodePath ?? subPath.nodePath;
        this.nodePath = Array.from(nodePath);

        pathAnchor = pathAnchor ?? subPath.fixedPathAnchor;

        if (!pathAnchor) throw new Error("Path anchor is not defined");
        this.pathAnchor = pathAnchor;

        if (isNaN(this.pathAnchor.direction.x) || isNaN(this.pathAnchor.direction.y)) {
            console.error("Invalid FLEX NODE PATH", this.pathAnchor);
        }
    }



    layout() {


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
        // if (this.connection.source.id == "tts_pico" && this.connection.target.id == "equalizer") {
        if (this.connection.source.id == "drive_manager" && this.connection.target.id == "camera") {
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
        for (let ci = 0; ci < DynamicSubPath.candidates.length; ci++) {
            const candidateCls = DynamicSubPath.candidates[ci];

            if (debug) console.log("Try candidate", candidateCls.name, this.nodePath.map(n => n.id).join(" -> "), this);

            // const node = this.connectionType === "nodeToPath" ? this.nodePath[0] : this.nodePath[this.nodePath.length - 1];
            // const nodeAtPathAnchor = this.connectionType === "nodeToPath" ? this.nodePath[this.nodePath.length - 1] : this.nodePath[0];

            const candidate = new candidateCls(this);
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


                const shortenedFlexPath = this.createDynamicSubPath(shortenedPath);
                const success = shortenedFlexPath.layout();

                if (success) {

                    const nodeAnchor = shortenedFlexPath.nodeAnchor;
                    if (!nodeAnchor || isNaN(nodeAnchor.direction.x) || isNaN(nodeAnchor.direction.y)) {
                        console.error("Invalid node anchor", nodeAnchor, shortenedFlexPath);
                    }

                    const shortenedRestFlexPath = this.createDynamicSubPath(shortenedRestPath, shortenedFlexPath.nodeAnchor);
                    const success = shortenedRestFlexPath.layout();

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

    createDynamicSubPath(nodePath: VisNode[], pathAnchor: Anchor = this.pathAnchor) {
        const path = new DynamicSubPath(this.subPath, nodePath, pathAnchor);
        return path;
    }


    getShortenedPath(shortenCount: number) {

        // [p] -> [] -> [] shortened by 1 ==>
        // [p] -> [] || [] with left == path and right == rest
        if (this.connectionType === "pathToNode") {
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
