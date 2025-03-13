import { LayoutConnection, LayoutConnectionPoint, LayoutConnectionPoints } from "src/graph/visGraph/layoutConnection";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { degToRad, RadialUtils, radToDeg } from "../utils/radialUtils";
import { Circle, Line, Point, Segment, Vector } from "2d-geometry";
import { Anchor, EllipticArc } from "src/graph/graphical";
import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { PathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { StraightLineSegment } from "src/graph/graphical/primitives/pathSegments/LineSegment";


export class RadialConnectionsHelper {

    forwardBackwardThresholdDeg: number;
    forwardBackwardThresholdRad: number;

    constructor({
        forwardBackwardThresholdDeg = 270,
    }: {
        forwardBackwardThresholdDeg?: number,
    }) {
        this.forwardBackwardThresholdDeg = forwardBackwardThresholdDeg;
        this.forwardBackwardThresholdRad = degToRad(forwardBackwardThresholdDeg);
    }

    getConnectionTypesFromNode(node: LayoutNode, settings = {
        // groupConnections: true,
        ignoreNonRendered: true,
        ignoreFinished: true
    }) {

        const outgoingConnections = node.outConnections;
        const incomingConnections = node.inConnections;
        const allConnections = [...outgoingConnections, ...incomingConnections];

        // Different types of rendered connections:
        // Direct connections:
        // - Direct forward connections-- > rendered as circular arcs
        // - Direct backward connections --> rendered as circular arcs, but with a larger radius
        // Connections inside the circle of the parent node:
        // - are rendered as splines
        // - Outgoing connections, if the forward angular difference from node to target is below the threshold
        // - Incoming connections, if the backward angular difference from start to node is below the threshold
        // - Bidirectional connections always
        // Connections outside the circle of the parent node:
        // - are rendered as splines
        // - Outgoing connections, if the forward angular difference from node to target is above the threshold
        // - Incoming connections, if the backward angular difference from start to node is above the threshold

        const directOutForwardConnections: LayoutConnection[] = [];
        const directOutBackwardConnections: LayoutConnection[] = [];

        const directInForwardConnections: LayoutConnection[] = [];
        const directInBackwardConnections: LayoutConnection[] = [];

        const outgoingConnectionsInside: LayoutConnection[] = [];
        const incomingConnectionsInside: LayoutConnection[] = [];

        const outgoingConnectionsOutside: LayoutConnection[] = [];
        const incomingConnectionsOutside: LayoutConnection[] = [];

        const connectionsWithDifferentParents: LayoutConnection[] = [];

        const selfConnections: LayoutConnection[] = [];

        allConnections.forEach((connection) => {
            if (settings.ignoreFinished && connection.finishedLayouting) return;
            if (settings.ignoreNonRendered && !connection.isRendered) return;

            const start = connection.source;
            const end = connection.target;
            const isOutgoing = start == node;

            if (start == end) {
                selfConnections.push(connection);
                return;
            }

            // Out the connections into the different categories
            if (end.isDirectSuccessorInSortingTo(start)) {
                if (isOutgoing) {
                    directOutForwardConnections.push(connection);
                } else {
                    directInForwardConnections.push(connection);
                }
            } else if (start.isDirectSuccessorInSortingTo(end)) {
                if (isOutgoing) {
                    directOutBackwardConnections.push(connection);
                } else {
                    directInBackwardConnections.push(connection);
                }
            }
            else {
                const commonParent = LayoutNode.firstCommonParent(start, end);

                if (start.parent == end.parent) {
                    const forwardRadBetweenPoints = RadialUtils.forwardRadBetweenPoints(start.center, end.center, start.center);
                    const isAboveThreshold = forwardRadBetweenPoints > this.forwardBackwardThresholdRad;

                    if (isAboveThreshold && isOutgoing) {
                        outgoingConnectionsOutside.push(connection);
                    } else if (isAboveThreshold && !isOutgoing) {
                        incomingConnectionsOutside.push(connection);
                    } else if (!isAboveThreshold && isOutgoing) {
                        outgoingConnectionsInside.push(connection);
                    } else if (!isAboveThreshold && !isOutgoing) {
                        incomingConnectionsInside.push(connection);
                    }
                }
                else {
                    connectionsWithDifferentParents.push(connection);
                }
            }
        });

        return {
            directOutForwardConnections,
            directOutBackwardConnections,
            directInForwardConnections,
            directInBackwardConnections,
            outgoingConnectionsInside,
            incomingConnectionsInside,
            outgoingConnectionsOutside,
            incomingConnectionsOutside,
            connectionsWithDifferentParents,
            selfConnections
        }
    }

}



export class RadialCircularArcConnectionLayouter extends BaseNodeConnectionLayouter {

    // TODO
    layoutSelfLinks: boolean = false;

    // TODO
    combineBidirectionalLinks: boolean = false;

    forwardBackwardThreshold: number = 270;
    straightForwardLineAtDegreeDelta: number = 135;
    backwardLineCurvature: number = 120;

    constructor({
        forwardBackwardThreshold = 270,
        straightForwardLineAtDegreeDelta = 135,
        backwardLineCurvature = 120 }:
        {
            forwardBackwardThreshold?: number;
            straightForwardLineAtDegreeDelta?: number;
            backwardLineCurvature?: number;
        } = {}) {
        super();
        this.forwardBackwardThreshold = forwardBackwardThreshold;
        this.straightForwardLineAtDegreeDelta = straightForwardLineAtDegreeDelta;
        this.backwardLineCurvature = backwardLineCurvature;
    }

    override layoutConnectionsOfNode(node: LayoutNode): void {

        node.outConnections.forEach((connection) => {
            const startNode = connection.source;
            const endNode = connection.target;
            const parent = startNode.parent ?? endNode.parent;

            if (!parent) {
                throw new Error("Parent node of connection is not set");
            }

            if (startNode == endNode) {
                // TODO: Implement self links
                return;
            }

            const startAngleRad = RadialUtils.radOfPoint(startNode, parent);
            const endAngleRad = RadialUtils.radOfPoint(endNode, parent);
            const startAngleDeg = radToDeg(startAngleRad);
            const endAngleDeg = radToDeg(endAngleRad);

            const angleDiffDeg = endAngleDeg - startAngleDeg;

            // Forward diff = if b < a, then diff is angleDiff + 360 (since we cross the circle's 0° point)
            const angleDiffForwardDeg = angleDiffDeg < 0 ? angleDiffDeg + 360 : angleDiffDeg;

            // Forward links should be inside the circle
            // Backward links should be outside the circle

            // We have to make a decision on how we treat forward and backward links:
            // We can either:
            // 1.) Distinguish them clearly by the sorting result. This way, backward links based on the sorting are always outside the circle
            //     This could however lead to the case, that a link between nodes that are close on the circle is drawn a much longer way outside the circle
            // 2.) Distinguish them by the angle difference. This way, links are drawn in a way that makes the most sense based on the circular layout
            // Cases for angle a and b:
            // - a < b:
            //     - 1.) Either always a forward link
            //     - 2.) Or a forward link if the angle difference is less than 180 (or another threshold) degrees
            // - a > b:
            //     - 1.) Either we have a backward link
            //     - 2.) Or a link between nodes via the 0 degree point (e.g. from 270° to 0° --> Diff is -270°, but actually it is a 90° forward link)
            //    --> again, we could use a threshold to decide if we treat it as a forward or backward link

            // Links below the threshold are forward links
            const isForwardLink = angleDiffForwardDeg <= this.forwardBackwardThreshold;

            try {
                if (isForwardLink) {
                    connection.pathSegment = this.getForwardLink(startNode, endNode, parent);
                } else {
                    connection.pathSegment = this.getBackwardLink(startNode, endNode, parent);
                }
            } catch (e) {
                console.error("Error in layouting connection", e);
            }
        });
    }

    static getCircularArcBetweenCircles(
        connection: LayoutConnection,
        startCircle: Circle,
        endCircle: Circle,
        parentCircle: Circle,
        direction: "clockwise" | "counter-clockwise" = "clockwise"
    ): EllipticArc {

        // Given Constants
        const startAngleRad = RadialUtils.radOfPoint(startCircle.center, parentCircle.center);
        const endAngleRad = RadialUtils.radOfPoint(endCircle.center, parentCircle.center);
        const startAngleDeg = radToDeg(startAngleRad);
        const endAngleDeg = radToDeg(endAngleRad);

        const angleDiffDeg = endAngleDeg - startAngleDeg;

        // Forward diff = if b < a, then diff is angleDiff + 360 (since we cross the circle's 0° point)
        const angleDiffForwardDeg = angleDiffDeg < 0 ? angleDiffDeg + 360 : angleDiffDeg;
        const angleDiffForwardRad = degToRad(angleDiffForwardDeg);

        const angleDiffBackwardDeg = 360 - angleDiffForwardDeg;
        const angleDiffBackwardRad = degToRad(angleDiffBackwardDeg);

        const radialLayoutCircle = parentCircle;
        const radius = parentCircle.r;
        const center = parentCircle.center;
        const radialMidPoint = direction == "clockwise" ?
            RadialUtils.positionOnCircleAtRad(startAngleRad + angleDiffForwardRad / 2, radius, center) :
            RadialUtils.positionOnCircleAtRad(startAngleRad - angleDiffBackwardRad / 2, radius, center);

        const intersectionsStart = radialLayoutCircle.intersect(startCircle);
        const intersectionsEnd = radialLayoutCircle.intersect(endCircle);

        if (intersectionsStart.length == 0 || intersectionsEnd.length == 0) {
            console.error("No intersections found between circles", startCircle, endCircle, parentCircle);
            throw new Error("No intersections found between circles");
            // return new EllipticArc(connection);
        }

        // Get the intersections, that are closer to the mid point between the two nodes
        const sDist0 = intersectionsStart[0].distanceTo(radialMidPoint)[0];
        const sDist1 = intersectionsStart[1].distanceTo(radialMidPoint)[0];
        const eDist0 = intersectionsEnd[0].distanceTo(radialMidPoint)[0];
        const eDist1 = intersectionsEnd[1].distanceTo(radialMidPoint)[0];

        const intersectionStart = sDist0 < sDist1 ? intersectionsStart[0] : intersectionsStart[1];
        const intersectionEnd = eDist0 < eDist1 ? intersectionsEnd[0] : intersectionsEnd[1];

        // Get the anchors
        const tangentInStartIntersection = direction == "clockwise" ?
            new Vector(center, intersectionStart).normalize().rotate90CW() :
            new Vector(center, intersectionStart).normalize().rotate90CCW();
        const tangentInEndIntersection = direction == "clockwise" ?
            new Vector(center, intersectionEnd).normalize().rotate90CW() :
            new Vector(center, intersectionEnd).normalize().rotate90CCW();

        const startAnchor = new Anchor(intersectionStart, tangentInStartIntersection);
        const endAnchor = new Anchor(intersectionEnd, tangentInEndIntersection);

        // const straightEndPartForArrow = endAnchor.getPointInDirection(link.maxWidth);

        const arc = new EllipticArc(connection)
            .radius(radius)
            .startPoint(startAnchor.anchorPoint)
            .endPoint(endAnchor.anchorPoint)
            // .endPoint(straightEndPartForArrow)
            .largeArc(0)
            .direction(direction);

        return arc;

    }

    protected getDirectCircularLink(
        startNode: LayoutNode,
        endNode: LayoutNode,
        parent: LayoutNode,
    ): PathSegment {
        const connection = startNode.getConnectionTo(endNode)!;
        return RadialCircularArcConnectionLayouter.getCircularArcBetweenCircles(
            connection,
            startNode.outerCircle,
            endNode.outerCircle,
            parent.innerCircle
        );
    }

    protected getForwardLink(
        startNode: LayoutNode,
        endNode: LayoutNode,
        parent: LayoutNode,
    ): PathSegment {
        /**
        For a forward link, we want a circular arc that is inside the circle.
        This circle arc is defined by the following:
        - arcStartAnchor: The point on the circle where the link starts
        - arcEndAnchor: The point on the circle where the link ends
        - arcRadius: The radius of the circle

        We want outgoing and incoming arcs to be different, so we have to distinguish between the two cases.
        To do so, we define an asymmetric angle delta (so != 180°) for which the connection line should be (nearly) straight.
        For connection lines below this angle delta, the circular arc will be curved concave (so contrary to the circle).
        For connection lines above this angle delta, the circular arc will be curved convex (so in the direction of the circle).

        E.g.:
        - straightLineAtAngleDelta = 70°
        With this, we can get the point and the vector to this delta point on the circle
        - straightLinePoint = getPositionOnCircle(startAngle + straightLineAtAngleDelta)
        - vectorToStraightLinePoint = new Vector(startPoint, straightLinePoint)
        - lineToStraightLinePoint = new Line(startPoint, vectorToStraightLinePoint)

        We also need the orthogonal line to the lineToStraightLinePoint. On this line will be all center points of the circular arcs.
        - orthogonalVector = vectorToStraightLinePoint.rotate90CW()
        - lineToStraightLinePointOrthogonal = new Line(startPoint, orthogonalVector)

        The center point of the circular arc is the intersection of this orthogonal line and the line from the midPoint to the radialMidPoint (which is the orthogonal line of the connection line between both nodes).
        - radialMidPointLine = new Line(midPoint, new Vector(midPoint, radialMidPoint))
        - arcCenter = lineToStraightLinePointOrthogonal.intersection(radialMidPointLine)

        With that, we can calculate the radius of the circular arc:
        - arcRadius = new Vector(arcCenter, startPoint).length()
        - arcCircle = new Circle(arcCenter, arcRadius)

        Now we want to get the anchor points
        - startCircle = startNode.circle
        - endCircle = endNode.circle
        - intersectionsStart = arcCircle.intersection(startCircle)
        - intersectionsEnd = arcCircle.intersection(endCircle)

        Because there are two intersections, we have to decide which one to take.
        - intersectionStart = intersectionsStart[0] if radialLayoutCircle.contains(intersectionsStart[0]) else intersectionsStart[1]
        - intersectionEnd = intersectionsEnd[0] if radialLayoutCircle.contains(intersectionsEnd[0]) else intersectionsEnd[1]

        We get the anchors:
        - startAnchor = startNode.getAnchor(intersectionStart)
        - endAnchor = endNode.getAnchor(intersectionEnd)

        Then we can construct the arc
        - arc = new EllipticArc()
            .radius(arcRadius)
            .startPoint(startAnchor.anchorPoint)
            .endPoint(endAnchor.anchorPoint)
            .direction("clockwise")
        */

        // Given Constants
        const radius = parent.innerCircle.r;
        const center = parent.innerCircle.center;

        const startIndex = startNode.index;
        const endIndex = endNode.index;

        const connection = startNode.getConnectionTo(endNode)!;

        const startAngleRad = RadialUtils.radOfPoint(startNode.center, center);
        const endAngleRad = RadialUtils.radOfPoint(endNode.center, center);
        const startAngleDeg = radToDeg(startAngleRad);
        const endAngleDeg = radToDeg(endAngleRad);

        const angleDiffDeg = endAngleDeg - startAngleDeg;

        // Forward diff = if b < a, then diff is angleDiff + 360 (since we cross the circle's 0° point)
        const angleDiffForwardDeg = angleDiffDeg < 0 ? angleDiffDeg + 360 : angleDiffDeg;
        const angleDiffForwardRad = degToRad(angleDiffForwardDeg);
        const angleDiffBackwardDeg = 360 - angleDiffForwardDeg;
        const angleDiffBackwardRad = degToRad(angleDiffBackwardDeg);


        const radialLayoutCircle = parent.innerCircle;
        const startPoint = startNode.center;
        const endPoint = endNode.center;
        const midPoint = new Segment(startPoint, endPoint).middle();
        const radialMidPoint = RadialUtils.positionOnCircleAtRad(startAngleRad + angleDiffForwardRad / 2, radius, center);

        // If the end node is directly after or before the start node, we can draw a more direct link
        const isDirectLink = (endIndex - startIndex) == 1 || (startIndex - endIndex) == ((parent?.children.length ?? 0) - 1);

        // If we have a direct link, we instead draw a circular arc with the same radius as the radial layout circle
        if (isDirectLink) {
            return this.getDirectCircularLink(startNode, endNode, parent);
        }


        // Calculate the straight line information
        const straightLineAtRadDelta = degToRad(this.straightForwardLineAtDegreeDelta);


        // If our endNode is exactly this straight line threshold away from the start node, we can draw a straight line
        if (Math.abs(angleDiffForwardDeg - this.straightForwardLineAtDegreeDelta) < 1) {
            const startAnchor = startNode.getAnchor(endNode.center);
            const endAnchor = endNode.getAnchor(startNode.center);

            startAnchor.anchorPoint = startAnchor.getPointInDirection((startNode.outerRadius - startNode.radius));
            endAnchor.anchorPoint = endAnchor.getPointInDirection((endNode.outerRadius - endNode.radius));

            return new StraightLineSegment(connection, startAnchor.anchorPoint, endAnchor.anchorPoint);
        }


        const straightLinePoint = RadialUtils.positionOnCircleAtRad(startAngleRad + straightLineAtRadDelta, radius, center);

        const vectorToStraightLinePoint = new Vector(startPoint, straightLinePoint);
        const orthogonalVector = vectorToStraightLinePoint.rotate90CW();

        // We have to rotate the vectors by 90° to get the normal vectors for the lines --> we can just take the inverted results of before
        const lineToStraightLinePoint = new Line(startPoint, orthogonalVector);
        const lineToStraightLinePointOrthogonal = new Line(startPoint, vectorToStraightLinePoint);

        // Calculate the center of the arc
        const radialMidPointLine = new Line(midPoint, radialMidPoint);
        const arcCenter = lineToStraightLinePointOrthogonal.intersect(radialMidPointLine)[0];

        // console.log({
        //     arcCenter,
        //     startPoint,
        //     angleDiffForwardDeg,
        // });
        // Calculate the radius of the arc
        const arcRadius = new Vector(arcCenter, startPoint).length;

        // Calculate the arc points
        const arcCircle = new Circle(arcCenter, arcRadius);
        const intersectionsStart = arcCircle.intersect(startNode.outerCircle);
        const intersectionsEnd = arcCircle.intersect(endNode.outerCircle);

        if (false && connection.source.id == "drive_manager") {
            connection.debugShapes.push(arcCircle);
            connection.debugShapes.push(parent.center);
            connection.debugShapes.push(center);
            connection.debugShapes.push(parent.innerCircle);
            connection.debugShapes.push(new Segment(startPoint, straightLinePoint));

            const ep = endNode.center.clone();
            ep._data = {r: 2, fill: "red"};
            connection.debugShapes.push(ep);

            const sP = startNode.center.clone();
            sP._data = { r: 2, fill: "green" };
            connection.debugShapes.push(sP);

            connection.debugShapes.push(straightLinePoint);
            console.error(straightLinePoint.distanceTo(center)[0], radius);
            console.error(startNode.center.distanceTo(center)[0], radius);
            console.error(parent.innerCenterTranslation);
            // connection.debugShapes.push(new Segment(startPoint, straightLinePoint));
        }

        // Get the intersections, that are closer to the mid point between the two nodes
        // const sDist0 = intersectionsStart[0].distanceTo(midPoint)[0];
        // const sDist1 = intersectionsStart[1].distanceTo(midPoint)[0];
        // const eDist0 = intersectionsEnd[0].distanceTo(midPoint)[0];
        // const eDist1 = intersectionsEnd[1].distanceTo(midPoint)[0];

        const sDist0 = intersectionsStart[0].distanceTo(radialMidPoint)[0];
        const sDist1 = intersectionsStart[1].distanceTo(radialMidPoint)[0];
        const eDist0 = intersectionsEnd[0].distanceTo(radialMidPoint)[0];
        const eDist1 = intersectionsEnd[1].distanceTo(radialMidPoint)[0];

        const intersectionStart = sDist0 < sDist1 ? intersectionsStart[0] : intersectionsStart[1];
        const intersectionEnd = eDist0 < eDist1 ? intersectionsEnd[0] : intersectionsEnd[1];

        // console.log(startNode.id, endNode.id);
        // console.log({
        //     intersectionsStart,
        //     intersectionsEnd,
        //     radialLayoutCircle,
        //     radialMidPoint,
        //     startNode,
        //     endNode,
        //     intersectionStart,
        //     intersectionEnd,
        //     sDist0,
        //     sDist1,
        //     eDist0,
        //     eDist1
        // });


        // Get the anchors
        // The vectore are a 90° rotation of the vector from the arc center to the intersection point.
        let tangentInStartIntersection; Vector;
        let tangentInEndIntersection; Vector;

        // The rotation depends on the curvature of the link, so we have to distinguish between the two cases
        if (angleDiffForwardDeg > this.straightForwardLineAtDegreeDelta) {
            tangentInStartIntersection = new Vector(arcCenter, intersectionStart).normalize().rotate90CW();
            tangentInEndIntersection = new Vector(arcCenter, intersectionEnd).normalize().rotate90CCW();
        } else {
            tangentInStartIntersection = new Vector(arcCenter, intersectionStart).normalize().rotate90CCW();
            tangentInEndIntersection = new Vector(arcCenter, intersectionEnd).normalize().rotate90CW();
        }

        const startAnchor = new Anchor(intersectionStart, tangentInStartIntersection)
        const endAnchor = new Anchor(intersectionEnd, tangentInEndIntersection);

        // const endNodeWithArrowCircle = new Circle(endNode.center, endNode.radius + link.maxWidth * 10);
        // const intersectionsEndWithArrowOffset = arcCircle.intersect(endNodeWithArrowCircle);
        // const intersectionsEndWithArrow = intersectionsEndWithArrowOffset.filter(intersection => endNode.circle.contains(intersection));

        // The end anchor itself is not sufficient, because the arrow drawn in the orthogonal direction of the arc will be off at its end.
        // So we do not want to draw our arc up to the end anchor, but a bit shorter, and connect the rest by a straight line.
        // For that we take the max width of the link as max width of the arrow and calculate the intersection of the circle with the end node circle.
        // const straightEndPartForArrow = endAnchor.getPointInDirection(link.maxWidth);

        // Construct the arc
        const direction = angleDiffForwardDeg > this.straightForwardLineAtDegreeDelta ? "clockwise" : "counter-clockwise";

        const arc = new EllipticArc(connection)
            .radius(arcRadius)
            .startPoint(startAnchor.anchorPoint)
            .endPoint(endAnchor.anchorPoint)
            // .endPoint(straightEndPartForArrow)
            .largeArc(0)
            .direction(direction);

        return arc;
    }

    protected getBackwardLink(
        startNode: LayoutNode,
        endNode: LayoutNode,
        parent: LayoutNode,
    ): PathSegment {
        const connection = startNode.getConnectionTo(endNode)!;

        const radius = parent.innerRadius;
        const center = parent.innerCircle.center;

        // Given Constants
        const startAngleRad = RadialUtils.radOfPoint(startNode, center);
        const endAngleRad = RadialUtils.radOfPoint(endNode, center);
        const startAngleDeg = radToDeg(startAngleRad);
        const endAngleDeg = radToDeg(endAngleRad);

        const angleDiffDeg = endAngleDeg - startAngleDeg;

        // Forward diff = if b < a, then diff is angleDiff + 360 (since we cross the circle's 0° point)
        const angleDiffForwardDeg = angleDiffDeg < 0 ? angleDiffDeg + 360 : angleDiffDeg;
        const angleDiffBackwardDeg = 360 - angleDiffForwardDeg;
        const angleDiffForwardRad = degToRad(angleDiffForwardDeg);
        const angleDiffBackwardRad = degToRad(angleDiffBackwardDeg);

        // const radius = parent.radius;

        const startPoint = startNode.center;
        const endPoint = endNode.center;
        const midPoint = new Segment(startPoint, endPoint).middle();
        const radialMidPoint = RadialUtils.positionOnCircleAtRad(startAngleRad - angleDiffBackwardRad / 2, radius, center);

        /**
        For a backward link, we want a circular arc that is outside the circle.
        The outside arc is calculated in a similar way as the inside arc.
        The main differences are:
        - There is no breaking point (straight line threshold) where we have a switch in the curvature, outside circular arcs are always convex.
            However, there again is a configurable threshold parameter for the angle delta, where the circular arc should be drawn.
        - The centers of the circular arcs are directly on this threshold line, so there is no orthogonal line.

        A outside circle arc is defined by the following:
        - arcStartAnchor: The point on the circle where the link starts
        - arcEndAnchor: The point on the circle where the link ends
        - arcRadius: The radius of the circle

        We set the backwardLineAngleDelta as parameter.
        This is the angle delta for a reference line from our node to the point on the radial layout circle.
        All center points of the circular arcs are on this line.

        E.g.:
        - backwardLineAngleDelta = 70°
        This backwardLineAngleDelta should be below 180°.

        - referenceLinePoint = getPositionOnCircle(startAngle + backwardLineAngleDelta)
        - referenceLine = new Line(startPoint, referenceLinePoint)

        We can now calculate the center point of the circular arc.
        They are the intersection of the reference line with the line from the radialMidPoint to the center of the radial layout circle.
        The same intersection point is created, if we intersect the reference line with the targetBackReferenceLine.
        - targetBackReferenceLinePoint = getPositionOnCircle(endAngle - backwardLineAngleDelta)
        - targetBackReferenceLine = new Line(endPoint, targetBackReferenceLinePoint)

        - arcCenter = referenceLine.intersection(targetBackReferenceLine)

        With that, we can calculate the radius of the circular arc:
        - arcRadius = new Vector(arcCenter, startPoint).length()
        - arcCircle = new Circle(arcCenter, arcRadius)

        Now we want to get the anchor points.
        Because we want convex circle arcs outside the radial layout circle, the anchor points should be orthogonal to both reference lines.
        For the start node, the anchor is rotated 90° counter-clockwise, for the end node, the anchor is rotated 90° clockwise.
        However, we again can retrieve them by intersecting the node circles with the arc circle and get the intersections points that are outside the radial layout circle.
        - intersectionsStart = arcCircle.intersection(startCircle)
        - intersectionsEnd = arcCircle.intersection(endCircle)

        Because there are two intersections, we have to decide which one to take.
        - intersectionStart = intersectionsStart[0] if !radialLayoutCircle.contains(intersectionsStart[1]) else intersectionsStart[0]
        - intersectionEnd = intersectionsEnd[0] if !radialLayoutCircle.contains(intersectionsEnd[1]) else intersectionsEnd[0]

        We get the anchors:
        - startAnchor = startNode.getAnchor(intersectionStart)
        - endAnchor = endNode.getAnchor(intersectionEnd)

        Then we can construct the arc
        - arc = new EllipticArc()
            .radius(arcRadius)
            .startPoint(startAnchor.anchorPoint)
            .endPoint(endAnchor.anchorPoint)
            .direction("clockwise")
        */

        /**
         * We set the backwardLineAngleDelta as parameter.
         * This is the angle delta for a reference line from our target node to the point on the radial layout circle.
         * All center points of the circular arcs to this target node will be on this line.
         */
        const backwardLineAtRadDelta = degToRad(this.backwardLineCurvature);
        const referenceLinePoint = RadialUtils.positionOnCircleAtRad(endAngleRad + backwardLineAtRadDelta, radius, center);

        // If backwardLineAtRadDelta == 0  we have to get the tangent to the circle at the end point
        const referenceLine = backwardLineAtRadDelta == 0 ?
            new Line(endPoint, new Vector(endPoint, center).rotate90CW()) :
            new Line(endPoint, referenceLinePoint);

        /**
        * We can now calculate the center point of the circular arc.
        * They are the intersection of the reference line with the line from the radialMidPoint to the center of the radial layout circle.
        * The same intersection point is created, if we intersect the reference line with the targetBackReferenceLine.
        */
        const targetBackReferenceLinePoint = RadialUtils.positionOnCircleAtRad(startAngleRad - backwardLineAtRadDelta, radius, center);
        const targetBackReferenceLine = backwardLineAtRadDelta == 0 ?
            new Line(startPoint, new Vector(startPoint, center).rotate90CCW()) :
            new Line(startPoint, targetBackReferenceLinePoint);

        /**
         * With the intersection, we can get the arc circle.
         */
        const intersections = referenceLine.intersect(targetBackReferenceLine);
        // If there is no intersection, we have a node that is directly on the reference line
        // In this case take the mid point between the two nodes.
        // Otherwise take the intersection point
        const arcCenter = intersections.length == 0 ? midPoint : referenceLine.intersect(targetBackReferenceLine)[0];
        const arcRadius = new Vector(arcCenter, endPoint).length;
        const arcCircle = new Circle(arcCenter, arcRadius);


        // if (true) {
        //     const referenceSegment = new Segment(endPoint, referenceLinePoint);
        //     referenceSegment._data = { stroke: "green" };
        //     const targetBackReferenceSegment = new Segment(startPoint, targetBackReferenceLinePoint);
        //     targetBackReferenceSegment._data = { stroke: "red" };

        //     this.debugShapes.push(arcCenter);
        //     this.debugShapes.push(arcCircle);
        //     this.debugShapes.push(referenceSegment);
        //     this.debugShapes.push(targetBackReferenceSegment);
        // }

        const intersectionsStart = arcCircle.intersect(startNode.outerCircle);
        const intersectionsEnd = arcCircle.intersect(endNode.outerCircle);

        // console.log({
        //     startNode,
        //     endNode,
        //     parent,
        //     arcCircle,
        //     intersectionsStart,
        //     intersectionsEnd
        // });

        // if (intersectionsStart.length == 0 || intersectionsEnd.length == 0) {
        //     connection.debugShapes.push(arcCircle);
        //     connection.debugShapes.push(startNode.outerCircle);
        //     connection.debugShapes.push(endNode.outerCircle);
        //     connection.debugShapes.push(startNode.center);
        //     connection.debugShapes.push(endNode.center);

        //     connection.debugShapes.push(midPoint);
        //     connection.debugShapes.push(radialMidPoint);
        //     connection.debugShapes.push(radialMidPoint);
        // }

        // Get the intersections, that are closer to the mid point between the two nodes
        const sDist0 = intersectionsStart[0].distanceTo(radialMidPoint)[0];
        const sDist1 = intersectionsStart[1].distanceTo(radialMidPoint)[0];
        const eDist0 = intersectionsEnd[0].distanceTo(radialMidPoint)[0];
        const eDist1 = intersectionsEnd[1].distanceTo(radialMidPoint)[0];

        const intersectionStart = sDist0 < sDist1 ? intersectionsStart[0] : intersectionsStart[1];
        const intersectionEnd = eDist0 < eDist1 ? intersectionsEnd[0] : intersectionsEnd[1];

        // Get the anchors
        const tangentInStartIntersection = new Vector(arcCenter, intersectionStart).normalize().rotate90CCW();
        const tangentInEndIntersection = new Vector(arcCenter, intersectionEnd).normalize().rotate90CW();

        const startAnchor = new Anchor(intersectionStart, tangentInStartIntersection)
        const endAnchor = new Anchor(intersectionEnd, tangentInEndIntersection);

        // const straightEndPartForArrow = endAnchor.getPointInDirection(link.maxWidth);

        // Construct the arc

        // Always counter-clockwise since it is outside the circle
        const direction = "counter-clockwise";

        // We have to distinguish between the two cases:
        // 1.) The angle difference is below the threshold --> take the short arc
        // 2.) The angle difference is above the threshold --> take the long arc
        const largeArc = angleDiffBackwardDeg > this.backwardLineCurvature ? 1 : 0;

        const arc = new EllipticArc(connection)
            .radius(arcRadius)
            .startPoint(startAnchor.anchorPoint)
            .endPoint(endAnchor.anchorPoint)
            // .endPoint(straightEndPartForArrow)
            .largeArc(largeArc)
            .direction(direction);

        return arc;
    }

}
