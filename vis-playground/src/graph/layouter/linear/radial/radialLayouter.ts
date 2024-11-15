import { CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { GraphLayouter } from "../../layouter";
import { Graph2d } from "src/graph/graphical/Graph2d";

import * as d3 from "d3";
import { Connection2d, EllipticArc, Node2d } from "src/graph/graphical";
import { RadialLayouterSettings } from "./radialSettings";
import { CommonSettings } from "../../settings/commonSettings";
import { Circle, Line, Point, PointLike, Segment, Vector } from "2d-geometry";
import { Anchor } from "src/graph/graphical/primitives/Anchor";
import { VisGraph } from "src/graph/visGraph/visGraph";
import { BasePositioner } from "src/graph/visGraph/layouterComponents/positioner";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { BasicPrecalculator } from "src/graph/visGraph/layouterComponents/precalculator";
import { LayoutConnection, LayoutConnectionPoint } from "src/graph/visGraph/layoutConnection";

export function radToDeg(rad: number) {
    return rad * 180 / Math.PI;
}

export function degToRad(deg: number) {
    return deg * Math.PI / 180;
}

export class RadialPositioner extends BasePositioner {

    radius: number;
    center: Point;

    constructor(radius = 100) {
        super();
        this.radius = radius;
        this.center = new Point(0, 0);
    }

    static getPositionForRad(rad: number, radius: number, centerTranslation: PointLike): Point {
        const x = centerTranslation.x + radius * Math.cos(rad);
        const y = centerTranslation.y + radius * Math.sin(rad);

        return new Point(x, y);
    }

    getPositionForRad(rad: number, radius?: number, centerTranslation?: PointLike): Point {
        return RadialPositioner.getPositionForRad(rad, radius ?? this.radius, centerTranslation ?? this.center);
    }

    override positionChildren(parentNode: LayoutNode): void {
        const nodes = parentNode.children;
        const continuumMap = new Map<LayoutNode, number>();
        nodes.forEach((node, i) => {
            continuumMap.set(node, i / nodes.length);
        });


        // Place nodes on a circle with radius
        const angleRadMap = new Map<LayoutNode, number>();
        // const angleRadStep = 2 * Math.PI / nodes.length;
        nodes.forEach((node, i) => {
            const placement = continuumMap.get(node)!;
            const angle = placement * 2 * Math.PI;
            angleRadMap.set(node, angle);
            const pos = this.getPositionForRad(angle);
            node.x = pos.x;
            node.y = pos.y;
            // console.log("Set node position", node.id, pos, node.circle);
        });

        parentNode.radius = this.radius;
    }
}


export class RadialCurvedConnector {

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
        this.forwardBackwardThreshold = forwardBackwardThreshold;
        this.straightForwardLineAtDegreeDelta = straightForwardLineAtDegreeDelta;
        this.backwardLineCurvature = backwardLineCurvature;
    }

    /**
     * Get the radial angle of a node relative a center 
     */
    static radOfNode(node: LayoutNode | Point, center?: LayoutNode | Point): number {
        const centerPoint = center === undefined ? new Point() : (center instanceof LayoutNode ? center.center : center);
        const nodePoint = node instanceof LayoutNode ? node.center : node;
        return Math.atan2(nodePoint.y - centerPoint.y, nodePoint.x - centerPoint.x);
    }

    layoutConnection(connection: LayoutConnection) {

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

        const startAngleRad = RadialCurvedConnector.radOfNode(startNode, parent);
        const endAngleRad = RadialCurvedConnector.radOfNode(endNode, parent);
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

        if (isForwardLink) {
            connection.points = this.getForwardLink(startNode, endNode, parent);
        } else {
            connection.points = this.getBackwardLink(startNode, endNode, parent);
        }
    }

    protected getForwardLink(
        startNode: LayoutNode,
        endNode: LayoutNode,
        parent: LayoutNode,
    ): LayoutConnectionPoint[] {
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
        const startIndex = startNode.index;
        const endIndex = endNode.index;

        const startAngleRad = RadialCurvedConnector.radOfNode(startNode, parent);
        const endAngleRad = RadialCurvedConnector.radOfNode(endNode, parent);
        const startAngleDeg = radToDeg(startAngleRad);
        const endAngleDeg = radToDeg(endAngleRad);

        const angleDiffDeg = endAngleDeg - startAngleDeg;

        // Forward diff = if b < a, then diff is angleDiff + 360 (since we cross the circle's 0° point)
        const angleDiffForwardDeg = angleDiffDeg < 0 ? angleDiffDeg + 360 : angleDiffDeg;
        const angleDiffForwardRad = degToRad(angleDiffForwardDeg);
        const angleDiffBackwardDeg = 360 - angleDiffForwardDeg;
        const angleDiffBackwardRad = degToRad(angleDiffBackwardDeg);

        const radius = parent.radius;
        const center = parent.center;
        const radialLayoutCircle = parent.circle;
        const startPoint = startNode.center;
        const endPoint = endNode.center;
        const midPoint = new Segment(startPoint, endPoint).middle();
        const radialMidPoint = RadialPositioner.getPositionForRad(startAngleRad + angleDiffForwardRad / 2, radius, center);

        // If the end node is directly after or before the start node, we can draw a more direct link
        const isDirectLink = (endIndex - startIndex) == 1 || (startIndex - endIndex) == ((parent?.children.length ?? 0) - 1);

        // If we have a direct link, we instead draw a circular arc with the same radius as the radial layout circle
        if (isDirectLink) {

            const intersectionsStart = radialLayoutCircle.intersect(startNode.circle);
            const intersectionsEnd = radialLayoutCircle.intersect(endNode.circle);

            // Get the intersections, that are closer to the mid point between the two nodes
            const sDist0 = intersectionsStart[0].distanceTo(radialMidPoint);
            const sDist1 = intersectionsStart[1].distanceTo(radialMidPoint);
            const eDist0 = intersectionsEnd[0].distanceTo(radialMidPoint);
            const eDist1 = intersectionsEnd[1].distanceTo(radialMidPoint);

            const intersectionStart = sDist0 < sDist1 ? intersectionsStart[0] : intersectionsStart[1];
            const intersectionEnd = eDist0 < eDist1 ? intersectionsEnd[0] : intersectionsEnd[1];

            // Get the anchors
            const tangentInStartIntersection = new Vector(center, intersectionStart).normalize().rotate90CW();
            const tangentInEndIntersection = new Vector(center, intersectionEnd).normalize().rotate90CCW();

            const startAnchor = new Anchor(intersectionStart, tangentInStartIntersection)
            const endAnchor = new Anchor(intersectionEnd, tangentInEndIntersection);

            // const straightEndPartForArrow = endAnchor.getPointInDirection(link.maxWidth);

            const arc = new EllipticArc()
                .radius(radius)
                .startPoint(startAnchor.anchorPoint)
                .endPoint(endAnchor.anchorPoint)
                // .endPoint(straightEndPartForArrow)
                .largeArc(0)
                .direction("clockwise");

            return [
                startAnchor,
                arc,
                // straightEndPartForArrow,
                endAnchor
            ];
        }


        // Calculate the straight line information
        const straightLineAtRadDelta = degToRad(this.straightForwardLineAtDegreeDelta);


        // If our endNode is exactly this straight line threshold away from the start node, we can draw a straight line
        if (Math.abs(angleDiffForwardDeg - this.straightForwardLineAtDegreeDelta) < 1) {
            const startAnchor = startNode.getAnchor(endNode.center);
            const endAnchor = endNode.getAnchor(startNode.center);

            return [
                startAnchor,
                endAnchor
            ];
        }


        const straightLinePoint = RadialPositioner.getPositionForRad(startAngleRad + straightLineAtRadDelta, radius, center);

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
        const intersectionsStart = arcCircle.intersect(startNode.circle);
        const intersectionsEnd = arcCircle.intersect(endNode.circle);
        const intersectionStart = radialLayoutCircle.contains(intersectionsStart[0]) ? intersectionsStart[0] : intersectionsStart[1];
        const intersectionEnd = radialLayoutCircle.contains(intersectionsEnd[0]) ? intersectionsEnd[0] : intersectionsEnd[1];

        // console.log({
        //     arcCircle,
        //     startNodeCircle: startNode.circle,
        //     endNodeCircle: endNode.circle,
        //     intersectionsStart,
        //     intersectionsEnd
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

        const arc = new EllipticArc()
            .radius(arcRadius)
            .startPoint(startAnchor.anchorPoint)
            .endPoint(endAnchor.anchorPoint)
            // .endPoint(straightEndPartForArrow)
            .largeArc(0)
            .direction(direction);

        return [
            startAnchor,
            arc,
            // straightEndPartForArrow,
            endAnchor
        ];

    }

    protected getBackwardLink(
        startNode: LayoutNode,
        endNode: LayoutNode,
        parent: LayoutNode,
    ): LayoutConnectionPoint[] {

        // Given Constants
        const startAngleRad = RadialCurvedConnector.radOfNode(startNode, parent);
        const endAngleRad = RadialCurvedConnector.radOfNode(endNode, parent);
        const startAngleDeg = radToDeg(startAngleRad);
        const endAngleDeg = radToDeg(endAngleRad);

        const angleDiffDeg = endAngleDeg - startAngleDeg;

        // Forward diff = if b < a, then diff is angleDiff + 360 (since we cross the circle's 0° point)
        const angleDiffForwardDeg = angleDiffDeg < 0 ? angleDiffDeg + 360 : angleDiffDeg;
        const angleDiffBackwardDeg = 360 - angleDiffForwardDeg;

        const radius = parent.radius;
        const center = parent.center;
        const radialLayoutCircle = parent.circle;
        const startPoint = startNode.center;
        const endPoint = endNode.center;
        const midPoint = new Segment(startPoint, endPoint).middle();

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
        const referenceLinePoint = RadialPositioner.getPositionForRad(endAngleRad + backwardLineAtRadDelta, radius, center);

        // If backwardLineAtRadDelta == 0  we have to get the tangent to the circle at the end point
        const referenceLine = backwardLineAtRadDelta == 0 ?
            new Line(endPoint, new Vector(endPoint, center).rotate90CW()) :
            new Line(endPoint, referenceLinePoint);

        /** 
        * We can now calculate the center point of the circular arc. 
        * They are the intersection of the reference line with the line from the radialMidPoint to the center of the radial layout circle.
        * The same intersection point is created, if we intersect the reference line with the targetBackReferenceLine.
        */
        const targetBackReferenceLinePoint = RadialPositioner.getPositionForRad(startAngleRad - backwardLineAtRadDelta, radius, center);
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

        const intersectionsStart = arcCircle.intersect(startNode.circle);
        const intersectionsEnd = arcCircle.intersect(endNode.circle);

        const intersectionStart = radialLayoutCircle.contains(intersectionsStart[0]) ? intersectionsStart[1] : intersectionsStart[0];
        const intersectionEnd = radialLayoutCircle.contains(intersectionsEnd[0]) ? intersectionsEnd[1] : intersectionsEnd[0];

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

        const arc = new EllipticArc()
            .radius(arcRadius)
            .startPoint(startAnchor.anchorPoint)
            .endPoint(endAnchor.anchorPoint)
            // .endPoint(straightEndPartForArrow)
            .largeArc(largeArc)
            .direction(direction);

        return [
            startAnchor,
            arc,
            // straightEndPartForArrow,
            endAnchor
        ];

    }

}

export class RadialLayouter<T extends RadialLayouterSettings = RadialLayouterSettings> extends GraphLayouter<T> {


    getRadius() {
        return this.settings.size.radius.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 5;
    }

    getPositionForRad(rad: number, radius?: number, centerTranslation?: { x: number, y: number }): Point {

        const radius_ = radius ?? this.getRadius();
        const centerTranslation_ = centerTranslation ?? this.center;

        const x = centerTranslation_.x + radius_ * Math.cos(rad);
        const y = centerTranslation_.y + radius_ * Math.sin(rad);

        return new Point(x, y);
    }

    override layout(isUpdate = false) {


        // const visGraph = VisGraph.fromCommGraph(this.commGraph, this.commonSettings);

        // this.visGraph


        this.visGraph.setPrecalculator(new BasicPrecalculator({ sizeMultiplier: 10 }));
        this.visGraph.setPositioner(new RadialPositioner(this.getRadius()));

        const sorter = this.settings.sorting.getSorter(this.visGraph, this.commonSettings);
        this.visGraph.setSorter(sorter);

        const forwardBackwardThreshold = this.settings.edges.forwardBackwardThreshold.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 270;
        const straightForwardLineAtDegreeDelta = this.settings.edges.straightForwardLineAtDegreeDelta.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 135;
        const backwardLineCurvature = this.settings.edges.backwardLineCurvature.getValue(this.settings.getContext({ visGraph: this.visGraph })) ?? 120;
        
        this.visGraph.setConnector(new RadialCurvedConnector({
            forwardBackwardThreshold,
            straightForwardLineAtDegreeDelta,
            backwardLineCurvature
        }));

        this.visGraph.layout();

        this.markConnectionsAsUpdateRequired();
        // this.emitEvent("update");
        this.emitEvent("end");

        // const radius = this.getRadius();

        // const nodes = sorter.getSorting2dNodes(this.graph2d)
        // const nodes = sorter.getSorting()

        // Get the nodes position on the interval [0, 1]
        // const continuumMap = new Map<Node2d, number>();
        // nodes.forEach((node, i) => {
        //     continuumMap.set(node, i / nodes.length);
        // });


        // // Place nodes on a circle with radius
        // const angleRadMap = new Map<Node2d, number>();
        // // const angleRadStep = 2 * Math.PI / nodes.length;
        // nodes.forEach((node, i) => {
        //     const placement = continuumMap.get(node)!;
        //     const angle = placement * 2 * Math.PI;
        //     angleRadMap.set(node, angle);
        //     const pos = this.getPositionForRad(angle);
        //     node.x = pos.x;
        //     node.y = pos.y;
        //     // console.log("Set node position", node.id, pos, node.circle);
        // });

        // // console.log("Placed nodes on circle", nodes);



        // // Adapt to the center
        // this.adaptNodesByCenterTranslation();

        return;



        // // We distinguish between two types of links:
        // // Forward links from node a to b, where b is a successor of a in the sorted list
        // // Backward links from node a to b, where b is a predecessor of a in the sorted list

        // this.getFilteredLinks().forEach(link => {
        //     try {


        //         // return;
        //         const startNode = link.source;
        //         const endNode = link.target;

        //         if (startNode == endNode) {
        //             return;
        //         }

        //         const startIndex = nodes.indexOf(startNode);
        //         const endIndex = nodes.indexOf(endNode);

        //         // If the end node is directly after or before the start node, we can draw a more direct link
        //         // const isDirectLink = Math.abs(startIndex - endIndex) == 1 || Math.abs(startIndex - endIndex) == nodes.length - 1;
        //         const isDirectLink = (endIndex - startIndex) == 1 || (startIndex - endIndex) == nodes.length - 1;

        //         const startAngleDeg = radToDeg(angleRadMap.get(startNode)!);
        //         const startAngleRad = angleRadMap.get(startNode)!;
        //         const endAngleDeg = radToDeg(angleRadMap.get(endNode)!);
        //         const endAngleRad = angleRadMap.get(endNode)!;

        //         const angleDiffDeg = endAngleDeg - startAngleDeg;
        //         const endIsSortedAfterStart = nodes.indexOf(startNode) < nodes.indexOf(endNode);

        //         // Forward diff = if b < a, then diff is angleDiff + 360 (since we cross the circle's 0° point)
        //         const angleDiffForwardDeg = angleDiffDeg < 0 ? angleDiffDeg + 360 : angleDiffDeg;
        //         const angleDiffForwardRad = degToRad(angleDiffForwardDeg);
        //         const angleDiffBackwardDeg = 360 - angleDiffForwardDeg;
        //         const angleDiffBackwardRad = degToRad(angleDiffBackwardDeg);

        //         // Forward links should be inside the circle
        //         // Backward links should be outside the circle

        //         // We have to make a decision on how we treat forward and backward links:
        //         // We can either:
        //         // 1.) Distinguish them clearly by the sorting result. This way, backward links based on the sorting are always outside the circle
        //         //     This could however lead to the case, that a link between nodes that are close on the circle is drawn a much longer way outside the circle
        //         // 2.) Distinguish them by the angle difference. This way, links are drawn in a way that makes the most sense based on the circular layout
        //         // Cases for angle a and b:
        //         // - a < b:
        //         //     - 1.) Either always a forward link
        //         //     - 2.) Or a forward link if the angle difference is less than 180 (or another threshold) degrees
        //         // - a > b:
        //         //     - 1.) Either we have a backward link
        //         //     - 2.) Or a link between nodes via the 0 degree point (e.g. from 270° to 0° --> Diff is -270°, but actually it is a 90° forward link)
        //         //    --> again, we could use a threshold to decide if we treet it as a forward or backward link

        //         // Links below the threshold are forward links
        //         // const forwardBackwardThreshold = 180;

        //         const isForwardLink = angleDiffForwardDeg <= forwardBackwardThreshold;

        //         // console.log({
        //         //     startNode: startNode.id,
        //         //     endNode: endNode.id,
        //         //     // isForwardLink,
        //         //     // startAngle,
        //         //     // endAngle,
        //         //     angleDiff: angleDiffDeg,
        //         //     angleDiffForward: angleDiffForwardDeg,
        //         // })

        //         /* 
        //         The following constants are given:
        //         - center = center of the radial layout circle
        //         - radialLayoutCircle = new Circle(center, radius)
        //         - startPoint = startNode.center
        //         - endPoint = endNode.center
        //         - midPoint = mid points between start and end point == (startPoint + endPoint) / 2
        //         - radialMidPoint = getPositionOnCircle(startAngle + angleDiffForward / 2)
        //         */

        //         // Given Constants
        //         const center = this.center;
        //         const radialLayoutCircle = new Circle(center, radius);
        //         const startPoint = startNode.center;
        //         const endPoint = endNode.center;
        //         const midPoint = new Segment(startPoint, endPoint).middle();
        //         const radialMidPoint = this.getPositionForRad(startAngleRad + angleDiffForwardRad / 2);


        //         if (isForwardLink) {
        //             /** 
        //             For a forward link, we want a circular arc that is inside the circle.
        //             This circle arc is defined by the following:
        //             - arcStartAnchor: The point on the circle where the link starts
        //             - arcEndAnchor: The point on the circle where the link ends
        //             - arcRadius: The radius of the circle
    
        //             We want outgoing and incoming arcs to be different, so we have to distinguish between the two cases.
        //             To do so, we define an asymmetric angle delta (so != 180°) for which the connection line should be (nearly) straight.
        //             For connection lines below this angle delta, the circular arc will be curved concave (so contrary to the circle).
        //             For connection lines above this angle delta, the circular arc will be curved convex (so in the direction of the circle).
    
        //             E.g.:
        //             - straightLineAtAngleDelta = 70°
        //             With this, we can get the point and the vector to this delta point on the circle
        //             - straightLinePoint = getPositionOnCircle(startAngle + straightLineAtAngleDelta)
        //             - vectorToStraightLinePoint = new Vector(startPoint, straightLinePoint) 
        //             - lineToStraightLinePoint = new Line(startPoint, vectorToStraightLinePoint)
    
        //             We also need the orthogonal line to the lineToStraightLinePoint. On this line will be all center points of the circular arcs.
        //             - orthogonalVector = vectorToStraightLinePoint.rotate90CW()
        //             - lineToStraightLinePointOrthogonal = new Line(startPoint, orthogonalVector)
    
        //             The center point of the circular arc is the intersection of this orthogonal line and the line from the midPoint to the radialMidPoint (which is the orthogonal line of the connection line between both nodes).
        //             - radialMidPointLine = new Line(midPoint, new Vector(midPoint, radialMidPoint))
        //             - arcCenter = lineToStraightLinePointOrthogonal.intersection(radialMidPointLine)
    
        //             With that, we can calculate the radius of the circular arc:
        //             - arcRadius = new Vector(arcCenter, startPoint).length()
        //             - arcCircle = new Circle(arcCenter, arcRadius)
    
        //             Now we want to get the anchor points
        //             - startCircle = startNode.circle
        //             - endCircle = endNode.circle
        //             - intersectionsStart = arcCircle.intersection(startCircle)
        //             - intersectionsEnd = arcCircle.intersection(endCircle)
    
        //             Because there are two intersections, we have to decide which one to take.
        //             - intersectionStart = intersectionsStart[0] if radialLayoutCircle.contains(intersectionsStart[0]) else intersectionsStart[1]
        //             - intersectionEnd = intersectionsEnd[0] if radialLayoutCircle.contains(intersectionsEnd[0]) else intersectionsEnd[1]
    
        //             We get the anchors:
        //             - startAnchor = startNode.getAnchor(intersectionStart)
        //             - endAnchor = endNode.getAnchor(intersectionEnd)
    
        //             Then we can construct the arc
        //             - arc = new EllipticArc()
        //                 .radius(arcRadius)
        //                 .startPoint(startAnchor.anchorPoint)
        //                 .endPoint(endAnchor.anchorPoint)
        //                 .direction("clockwise")
        //             */


        //             // If we have a direct link, we instead draw a circular arc with the same radius as the radial layout circle
        //             if (isDirectLink) {

        //                 const intersectionsStart = radialLayoutCircle.intersect(startNode.circle);
        //                 const intersectionsEnd = radialLayoutCircle.intersect(endNode.circle);

        //                 // Get the intersections, that are closer to the mid point between the two nodes
        //                 const sDist0 = intersectionsStart[0].distanceTo(radialMidPoint);
        //                 const sDist1 = intersectionsStart[1].distanceTo(radialMidPoint);
        //                 const eDist0 = intersectionsEnd[0].distanceTo(radialMidPoint);
        //                 const eDist1 = intersectionsEnd[1].distanceTo(radialMidPoint);

        //                 const intersectionStart = sDist0 < sDist1 ? intersectionsStart[0] : intersectionsStart[1];
        //                 const intersectionEnd = eDist0 < eDist1 ? intersectionsEnd[0] : intersectionsEnd[1];

        //                 // Get the anchors
        //                 const tangentInStartIntersection = new Vector(center, intersectionStart).normalize().rotate90CW();
        //                 const tangentInEndIntersection = new Vector(center, intersectionEnd).normalize().rotate90CCW();

        //                 const startAnchor = new Anchor(intersectionStart, tangentInStartIntersection)
        //                 const endAnchor = new Anchor(intersectionEnd, tangentInEndIntersection);

        //                 const straightEndPartForArrow = endAnchor.getPointInDirection(link.maxWidth);

        //                 const arc = new EllipticArc()
        //                     .radius(radius)
        //                     .startPoint(startAnchor.anchorPoint)
        //                     .endPoint(endAnchor.anchorPoint)
        //                     // .endPoint(straightEndPartForArrow)
        //                     .largeArc(0)
        //                     .direction("clockwise");

        //                 link.points = [
        //                     startAnchor,
        //                     arc,
        //                     // straightEndPartForArrow,
        //                     endAnchor
        //                 ];
        //             } else {


        //                 // Calculate the straight line information
        //                 const straightLineAtRadDelta = degToRad(straightForwardlineAtDegreeDelta);


        //                 // If our endNode is exactly this straight line threshold away from the start node, we can draw a straight line
        //                 if (Math.abs(angleDiffForwardDeg - straightForwardlineAtDegreeDelta) < 1) {
        //                     const startAnchor = startNode.getAnchor(endNode.center);
        //                     const endAnchor = endNode.getAnchor(startNode.center);

        //                     link.points = [
        //                         startAnchor,
        //                         endAnchor
        //                     ];
        //                     return;
        //                 }


        //                 const straightLinePoint = this.getPositionForRad(startAngleRad + straightLineAtRadDelta);

        //                 const vectorToStraightLinePoint = new Vector(startPoint, straightLinePoint);
        //                 const orthogonalVector = vectorToStraightLinePoint.rotate90CW();

        //                 // We have to rotate the vectors by 90° to get the normal vectors for the lines --> we can just take the inverted results of before
        //                 const lineToStraightLinePoint = new Line(startPoint, orthogonalVector);
        //                 const lineToStraightLinePointOrthogonal = new Line(startPoint, vectorToStraightLinePoint);

        //                 // Calculate the center of the arc
        //                 const radialMidPointLine = new Line(midPoint, radialMidPoint);
        //                 const arcCenter = lineToStraightLinePointOrthogonal.intersect(radialMidPointLine)[0];

        //                 // console.log({
        //                 //     arcCenter,
        //                 //     startPoint,
        //                 //     angleDiffForwardDeg,
        //                 // });
        //                 // Calculate the radius of the arc
        //                 const arcRadius = new Vector(arcCenter, startPoint).length;

        //                 // Calculate the arc points
        //                 const arcCircle = new Circle(arcCenter, arcRadius);
        //                 const intersectionsStart = arcCircle.intersect(startNode.circle);
        //                 const intersectionsEnd = arcCircle.intersect(endNode.circle);
        //                 const intersectionStart = radialLayoutCircle.contains(intersectionsStart[0]) ? intersectionsStart[0] : intersectionsStart[1];
        //                 const intersectionEnd = radialLayoutCircle.contains(intersectionsEnd[0]) ? intersectionsEnd[0] : intersectionsEnd[1];

        //                 // console.log({
        //                 //     arcCircle,
        //                 //     startNodeCircle: startNode.circle,
        //                 //     endNodeCircle: endNode.circle,
        //                 //     intersectionsStart,
        //                 //     intersectionsEnd
        //                 // });


        //                 // Get the anchors
        //                 // The vectore are a 90° rotation of the vector from the arc center to the intersection point.
        //                 let tangentInStartIntersection; Vector;
        //                 let tangentInEndIntersection; Vector;

        //                 // The rotation depends on the curvature of the link, so we have to distinguish between the two cases
        //                 if (angleDiffForwardDeg > straightForwardlineAtDegreeDelta) {
        //                     tangentInStartIntersection = new Vector(arcCenter, intersectionStart).normalize().rotate90CW();
        //                     tangentInEndIntersection = new Vector(arcCenter, intersectionEnd).normalize().rotate90CCW();
        //                 } else {
        //                     tangentInStartIntersection = new Vector(arcCenter, intersectionStart).normalize().rotate90CCW();
        //                     tangentInEndIntersection = new Vector(arcCenter, intersectionEnd).normalize().rotate90CW();
        //                 }

        //                 const startAnchor = new Anchor(intersectionStart, tangentInStartIntersection)
        //                 const endAnchor = new Anchor(intersectionEnd, tangentInEndIntersection);

        //                 // const endNodeWithArrowCircle = new Circle(endNode.center, endNode.radius + link.maxWidth * 10);
        //                 // const intersectionsEndWithArrowOffset = arcCircle.intersect(endNodeWithArrowCircle);
        //                 // const intersectionsEndWithArrow = intersectionsEndWithArrowOffset.filter(intersection => endNode.circle.contains(intersection));

        //                 // The end anchor itself is not sufficient, because the arrow drawn in the orthogonal direction of the arc will be off at its end.
        //                 // So we do not want to draw our arc up to the end anchor, but a bit shorter, and connect the rest by a straight line.
        //                 // For that we take the max width of the link as max width of the arrow and calculate the intersection of the circle with the end node circle.
        //                 const straightEndPartForArrow = endAnchor.getPointInDirection(link.maxWidth);

        //                 // Construct the arc
        //                 const direction = angleDiffForwardDeg > straightForwardlineAtDegreeDelta ? "clockwise" : "counter-clockwise";

        //                 const arc = new EllipticArc()
        //                     .radius(arcRadius)
        //                     .startPoint(startAnchor.anchorPoint)
        //                     .endPoint(endAnchor.anchorPoint)
        //                     // .endPoint(straightEndPartForArrow)
        //                     .largeArc(0)
        //                     .direction(direction);

        //                 link.points = [
        //                     startAnchor,
        //                     arc,
        //                     // straightEndPartForArrow,
        //                     endAnchor
        //                 ];
        //             }
        //         }
        //         // If it is a backward link
        //         else {
        //             /** 
        //             For a backward link, we want a circular arc that is outside the circle.
        //             The outside arc is calculated in a similar way as the inside arc.
        //             The main differences are:
        //             - There is no breaking point (straight line threshold) where we have a switch in the curvature, outside circular arcs are always convex. 
        //               However, there again is a configurable threshold parameter for the angle delta, where the circular arc should be drawn. 
        //             - The centers of the circular arcs are directly on this threshold line, so there is no orthogonal line.
    
        //             A outside circle arc is defined by the following:
        //             - arcStartAnchor: The point on the circle where the link starts
        //             - arcEndAnchor: The point on the circle where the link ends
        //             - arcRadius: The radius of the circle
    
        //             We set the backwardLineAngleDelta as parameter. 
        //             This is the angle delta for a reference line from our node to the point on the radial layout circle.
        //             All center points of the circular arcs are on this line.
    
        //             E.g.:
        //             - backwardLineAngleDelta = 70°
        //             This backwardLineAngleDelta should be below 180°.
                    
        //             - referenceLinePoint = getPositionOnCircle(startAngle + backwardLineAngleDelta)
        //             - referenceLine = new Line(startPoint, referenceLinePoint)
    
        //             We can now calculate the center point of the circular arc. 
        //             They are the intersection of the reference line with the line from the radialMidPoint to the center of the radial layout circle.
        //             The same intersection point is created, if we intersect the reference line with the targetBackReferenceLine.
        //             - targetBackReferenceLinePoint = getPositionOnCircle(endAngle - backwardLineAngleDelta)
        //             - targetBackReferenceLine = new Line(endPoint, targetBackReferenceLinePoint)
    
        //             - arcCenter = referenceLine.intersection(targetBackReferenceLine)
    
        //             With that, we can calculate the radius of the circular arc:
        //             - arcRadius = new Vector(arcCenter, startPoint).length()
        //             - arcCircle = new Circle(arcCenter, arcRadius)
    
        //             Now we want to get the anchor points. 
        //             Because we want convex circle arcs outside the radial layout circle, the anchor points should be orthogonal to both reference lines.
        //             For the start node, the anchor is rotated 90° counter-clockwise, for the end node, the anchor is rotated 90° clockwise.
        //             However, we again can retreive them by intersecting the node circles with the arc circle and get the intersections points that are outside the radial layout circle.
        //             - intersectionsStart = arcCircle.intersection(startCircle)
        //             - intersectionsEnd = arcCircle.intersection(endCircle)
    
        //             Because there are two intersections, we have to decide which one to take.
        //             - intersectionStart = intersectionsStart[0] if !radialLayoutCircle.contains(intersectionsStart[1]) else intersectionsStart[0]
        //             - intersectionEnd = intersectionsEnd[0] if !radialLayoutCircle.contains(intersectionsEnd[1]) else intersectionsEnd[0]
    
        //             We get the anchors:
        //             - startAnchor = startNode.getAnchor(intersectionStart)
        //             - endAnchor = endNode.getAnchor(intersectionEnd)
    
        //             Then we can construct the arc
        //             - arc = new EllipticArc()
        //                 .radius(arcRadius)
        //                 .startPoint(startAnchor.anchorPoint)
        //                 .endPoint(endAnchor.anchorPoint)
        //                 .direction("clockwise")
        //             */

        //             /**
        //              * We set the backwardLineAngleDelta as parameter. 
        //              * This is the angle delta for a reference line from our target node to the point on the radial layout circle.
        //              * All center points of the circular arcs to this target node will be on this line.
        //              */
        //             const backwardLineAtRadDelta = degToRad(backwardLineCurvature);
        //             const referenceLinePoint = this.getPositionForRad(endAngleRad + backwardLineAtRadDelta);

        //             // If backwardLineAtRadDelta == 0  we have to get the tangent to the circle at the end point
        //             const referenceLine = backwardLineAtRadDelta == 0 ?
        //                 new Line(endPoint, new Vector(endPoint, center).rotate90CW()) :
        //                 new Line(endPoint, referenceLinePoint);

        //             /** 
        //             * We can now calculate the center point of the circular arc. 
        //             * They are the intersection of the reference line with the line from the radialMidPoint to the center of the radial layout circle.
        //             * The same intersection point is created, if we intersect the reference line with the targetBackReferenceLine.
        //             */
        //             const targetBackReferenceLinePoint = this.getPositionForRad(startAngleRad - backwardLineAtRadDelta);
        //             const targetBackReferenceLine = backwardLineAtRadDelta == 0 ?
        //                 new Line(startPoint, new Vector(startPoint, center).rotate90CCW()) :
        //                 new Line(startPoint, targetBackReferenceLinePoint);

        //             /**
        //              * With the intersection, we can get the arc circle.
        //              */
        //             const intersections = referenceLine.intersect(targetBackReferenceLine);
        //             // If there is no intersection, we have a node that is directly on the reference line
        //             // In this case take the mid point between the two nodes.
        //             // Otherwise take the intersection point
        //             const arcCenter = intersections.length == 0 ? midPoint : referenceLine.intersect(targetBackReferenceLine)[0];
        //             const arcRadius = new Vector(arcCenter, endPoint).length;
        //             const arcCircle = new Circle(arcCenter, arcRadius);


        //             // if (true) {
        //             //     const referenceSegment = new Segment(endPoint, referenceLinePoint);
        //             //     referenceSegment._data = { stroke: "green" };
        //             //     const targetBackReferenceSegment = new Segment(startPoint, targetBackReferenceLinePoint);
        //             //     targetBackReferenceSegment._data = { stroke: "red" };

        //             //     this.debugShapes.push(arcCenter);
        //             //     this.debugShapes.push(arcCircle);
        //             //     this.debugShapes.push(referenceSegment);
        //             //     this.debugShapes.push(targetBackReferenceSegment);
        //             // }

        //             const intersectionsStart = arcCircle.intersect(startNode.circle);
        //             const intersectionsEnd = arcCircle.intersect(endNode.circle);

        //             const intersectionStart = radialLayoutCircle.contains(intersectionsStart[0]) ? intersectionsStart[1] : intersectionsStart[0];
        //             const intersectionEnd = radialLayoutCircle.contains(intersectionsEnd[0]) ? intersectionsEnd[1] : intersectionsEnd[0];

        //             // Get the anchors
        //             const tangentInStartIntersection = new Vector(arcCenter, intersectionStart).normalize().rotate90CCW();
        //             const tangentInEndIntersection = new Vector(arcCenter, intersectionEnd).normalize().rotate90CW();

        //             const startAnchor = new Anchor(intersectionStart, tangentInStartIntersection)
        //             const endAnchor = new Anchor(intersectionEnd, tangentInEndIntersection);

        //             const straightEndPartForArrow = endAnchor.getPointInDirection(link.maxWidth);

        //             // Construct the arc

        //             // Always counter-clockwise since it is outside the circle
        //             const direction = "counter-clockwise";

        //             // We have to distinguish between the two cases:
        //             // 1.) The angle difference is below the threshold --> take the short arc
        //             // 2.) The angle difference is above the threshold --> take the long arc
        //             const largeArc = angleDiffBackwardDeg > backwardLineCurvature ? 1 : 0;

        //             const arc = new EllipticArc()
        //                 .radius(arcRadius)
        //                 .startPoint(startAnchor.anchorPoint)
        //                 .endPoint(endAnchor.anchorPoint)
        //                 // .endPoint(straightEndPartForArrow)
        //                 .largeArc(largeArc)
        //                 .direction(direction);

        //             link.points = [
        //                 startAnchor,
        //                 arc,
        //                 // straightEndPartForArrow,
        //                 endAnchor
        //             ];

        //         }
        //     } catch (e) {
        //         console.error("Error in link", link);
        //         console.error(e);
        //     }
        // })

        // this.markConnectionsAsUpdateRequired();

        // // this.emitEvent("update");
        // this.emitEvent("end");
    }
}
