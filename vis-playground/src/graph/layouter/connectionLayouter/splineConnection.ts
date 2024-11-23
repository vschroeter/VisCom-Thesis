import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialCircularArcConnectionLayouter, RadialPositioner, RadialPositionerDynamicDistribution } from "../linear/radial/radialLayouter";
import { RadialUtils } from "../utils/radialUtils";
import { LayoutConnection, LayoutConnectionPoint } from "src/graph/visGraph/layoutConnection";
import { Circle, Ray, Segment } from "2d-geometry";
import { Anchor } from "src/graph/graphical";
import { RadialConnectionsHelper } from "./radialConnections";
import { CubicBezierCurve } from "src/graph/graphical/primitives/pathSegments/CubicBezierCurve";


export class RadialSplineConnectionAnchorPointCalculator extends BaseNodeConnectionLayouter {

    radialConnectionsHelper: RadialConnectionsHelper;

    constructor() {
        super();

        this.radialConnectionsHelper = new RadialConnectionsHelper({
            forwardBackwardThresholdDeg: 270
        });
    }

    override layoutConnectionsOfNode(node: LayoutNode): void {
        const connections = this.radialConnectionsHelper.getConnectionTypesFromNode(node);
        // console.log(node.id, connections);

        const outgoingConnectionsInside: LayoutConnection[] = connections.outgoingConnectionsInside;
        const incomingConnectionsInside: LayoutConnection[] = connections.incomingConnectionsInside;

        const outgoingConnectionsOutside: LayoutConnection[] = connections.outgoingConnectionsOutside;
        const incomingConnectionsOutside: LayoutConnection[] = connections.incomingConnectionsOutside;

        const connectionsWithDifferentParents: LayoutConnection[] = connections.connectionsWithDifferentParents;

        const selfConnections: LayoutConnection[] = connections.selfConnections;

        // Here we just calculate the anchor points for the splines
        // In the next step, additional control points will be added by other layouters

        if (outgoingConnectionsInside.length > 0 || incomingConnectionsInside.length > 0) {



            // console.log({
            //     id: node.id,
            //     startSlope: RadialUtils.radToDeg(startSlope),
            //     endSlope: RadialUtils.radToDeg(endSlope),
            //     slopeDiff: RadialUtils.radToDeg(slopeDiff),
            //     midSlope: RadialUtils.radToDeg(midSlope)
            // });
            // Sort the inside connections:
            // - A) first the outgoing connections, then the incoming connections
            // - B) sort the connections by the index of the target node in the sorting
            const insideConnections = [...outgoingConnectionsInside, ...incomingConnectionsInside];

            insideConnections.sort((a, b) => {
                const isOutgoingA = a.source == node;
                const isOutgoingB = b.source == node;

                if (isOutgoingA && !isOutgoingB) {
                    return -1;
                } else if (!isOutgoingA && isOutgoingB) {
                    return 1;
                } else {
                    const areOutgoing = isOutgoingA && isOutgoingB;
                    const nodeA = areOutgoing ? a.target : a.source;
                    const nodeB = areOutgoing ? b.target : b.source;

                    const commonParent = LayoutNode.firstCommonParent(nodeA, nodeB)!;

                    const nodeIndex = commonParent.getIndexOfNodeContainingDescendant(node);
                    let indexA = commonParent.getIndexOfNodeContainingDescendant(nodeA);
                    let indexB = commonParent.getIndexOfNodeContainingDescendant(nodeB);

                    indexA = (indexA - nodeIndex + commonParent.children.length) % commonParent.children.length;
                    indexB = (indexB - nodeIndex + commonParent.children.length) % commonParent.children.length;

                    return indexA - indexB;
                }
            })

            // Now we distribute the connections inside the parent circle
            insideConnections.forEach((connection, index) => {

                // For the inside connections, we first determine the available range to positions connections 
                // without overlapping with the adjacent nodes
                const sourceNode = connection.source;
                const targetNode = connection.target;
                const commonParent = LayoutNode.firstCommonParent(sourceNode, targetNode)!;
                const nodeIndexInCommonParent = commonParent.getIndexOfNodeContainingDescendant(node);
                const nextNode = commonParent.getNodeAtIndex(nodeIndexInCommonParent + 1);
                const prevNode = commonParent.getNodeAtIndex(nodeIndexInCommonParent - 1);

                const nextTangents = RadialUtils.getTangentsToCircle(node.center, nextNode.outerCircle);
                const prevTangents = RadialUtils.getTangentsToCircle(node.center, prevNode.outerCircle);

                const nextTangent = RadialUtils.getClosestShapeToPoint(nextTangents, node.parent!.center, (tangent) => tangent.end);
                const prevTangent = RadialUtils.getClosestShapeToPoint(prevTangents, node.parent!.center, (tangent) => tangent.end);

                if (!nextTangent || !prevTangent) {
                    console.log(node.id);
                    throw new Error("No tangents found.");
                }

                // Now with the tangents, we can define the angular range for the connections inside the parent circle

                const startSlope = nextTangent.slope;
                const endSlope = prevTangent.slope;
                const slopeDiff = (endSlope - startSlope + 2 * Math.PI) % (2 * Math.PI);
                const midSlope = (startSlope + slopeDiff / 2) % (2 * Math.PI);

                const isOutgoing = connection.source == node;

                const slopeRad = startSlope + (index + 1) * slopeDiff / (insideConnections.length + 1);
                const slopeVector = RadialUtils.radToVector(slopeRad);
                const slopeSegmentForIntersection = new Segment(node.center, node.center.translate(slopeVector.multiply(2 * node.outerCircle.r)));

                // There should be exactly one intersection point, that will be the anchor point
                const intersectionPoints = node.outerCircle.intersect(slopeSegmentForIntersection);
                if (intersectionPoints.length !== 1) {
                    throw new Error("No intersection point found.");
                }

                const anchor = new Anchor(intersectionPoints[0], slopeVector);

                if (isOutgoing) {
                    connection.startPoints = [anchor];
                } else {
                    connection.endPoints = [anchor];
                }
            })
        }

        if (outgoingConnectionsOutside.length > 0 || incomingConnectionsOutside.length > 0) {

            // Sort the outside connections:
            // - A) first the outgoing connections, then the incoming connections
            // - B) sort the connections by the index of the target node in the sorting
            const outsideConnections = [...outgoingConnectionsOutside, ...incomingConnectionsOutside];

            outsideConnections.sort((a, b) => {
                const isOutgoingA = a.source == node;
                const isOutgoingB = b.source == node;

                if (isOutgoingA && !isOutgoingB) {
                    return -1;
                } else if (!isOutgoingA && isOutgoingB) {
                    return 1;
                } else {
                    const areOutgoing = isOutgoingA && isOutgoingB;
                    const nodeA = areOutgoing ? a.target : a.source;
                    const nodeB = areOutgoing ? b.target : b.source;
                    const commonParent = LayoutNode.firstCommonParent(nodeA, nodeB)!;

                    const nodeIndex = commonParent.getIndexOfNodeContainingDescendant(node);
                    let indexA = commonParent.getIndexOfNodeContainingDescendant(nodeA);
                    let indexB = commonParent.getIndexOfNodeContainingDescendant(nodeB);

                    indexA = (indexA - nodeIndex + commonParent.children.length) % commonParent.children.length;
                    indexB = (indexB - nodeIndex + commonParent.children.length) % commonParent.children.length;

                    return indexB - indexA;
                }
            })

            // Now we distribute the connections inside the parent circle
            outsideConnections.forEach((connection, index) => {

                // For the inside connections, we first determine the available range to positions connections 
                // without overlapping with the adjacent nodes
                const sourceNode = connection.source;
                const targetNode = connection.target;
                const commonParent = LayoutNode.firstCommonParent(sourceNode, targetNode)!;
                const nodeIndexInCommonParent = commonParent.getIndexOfNodeContainingDescendant(node);
                const nextNode = commonParent.getNodeAtIndex(nodeIndexInCommonParent + 1);
                const prevNode = commonParent.getNodeAtIndex(nodeIndexInCommonParent - 1);

                const nextTangents = RadialUtils.getTangentsToCircle(node.center, nextNode.outerCircle);
                const prevTangents = RadialUtils.getTangentsToCircle(node.center, prevNode.outerCircle);

                const nextTangent = RadialUtils.getFurthestShapeToPoint(nextTangents, node.parent!.center, (tangent) => tangent.end);
                const prevTangent = RadialUtils.getFurthestShapeToPoint(prevTangents, node.parent!.center, (tangent) => tangent.end);

                if (!nextTangent || !prevTangent) {
                    console.log(node.id);
                    throw new Error("No tangents found.");
                }
                // Now with the tangents, we can define the angular range for the connections outside the parent circle

                const startSlope = prevTangent.slope;
                const endSlope = nextTangent.slope;
                const slopeDiff = (endSlope - startSlope + 2 * Math.PI) % (2 * Math.PI);
                const midSlope = (startSlope + slopeDiff / 2) % (2 * Math.PI);


                const isOutgoing = connection.source == node;

                const slopeRad = startSlope + (index + 1) * slopeDiff / (outsideConnections.length + 1);
                const slopeVector = RadialUtils.radToVector(slopeRad);
                const slopeSegmentForIntersection = new Segment(node.center, node.center.translate(slopeVector.multiply(2 * node.outerCircle.r)));

                // There should be exactly one intersection point, that will be the anchor point
                const intersectionPoints = node.outerCircle.intersect(slopeSegmentForIntersection);
                if (intersectionPoints.length !== 1) {
                    throw new Error("No intersection point found.");
                }

                const anchor = new Anchor(intersectionPoints[0], slopeVector);

                if (isOutgoing) {
                    connection.startPoints = [anchor];
                } else {
                    connection.endPoints = [anchor];
                }
            })
        }
    }

}

export class RadialSplineConnectionLayouter extends BaseNodeConnectionLayouter {


    radialConnectionsHelper: RadialConnectionsHelper;

    constructor() {
        super();

        this.radialConnectionsHelper = new RadialConnectionsHelper({
            forwardBackwardThresholdDeg: 270
        });
    }

    override layoutConnectionsOfNode(node: LayoutNode): void {
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

        const connections = this.radialConnectionsHelper.getConnectionTypesFromNode(node);

        const outgoingConnectionsInside: LayoutConnection[] = connections.outgoingConnectionsInside;
        const incomingConnectionsInside: LayoutConnection[] = connections.incomingConnectionsInside;

        const outgoingConnectionsOutside: LayoutConnection[] = connections.outgoingConnectionsOutside;
        const incomingConnectionsOutside: LayoutConnection[] = connections.incomingConnectionsOutside;

        const connectionsWithDifferentParents: LayoutConnection[] = connections.connectionsWithDifferentParents;

        const selfConnections: LayoutConnection[] = connections.selfConnections;


        // console.log({
        //     id: node.id,
        //     directOutForwardConnections,
        //     directOutBackwardConnections,
        //     directInForwardConnections,
        //     directInBackwardConnections,
        //     outgoingConnectionsInside,
        //     incomingConnectionsInside,
        //     outgoingConnectionsOutside,
        //     incomingConnectionsOutside
        // });

        // Render connections inside the parent circle

        // TODO: Add arrow control points
        if (outgoingConnectionsInside.length > 0) {

            const insideConnections = [...outgoingConnectionsInside];

            // Now we distribute the connections inside the parent circle
            insideConnections.forEach((connection, index) => {
                const sizeArrow = 10;

                const startAnchor = connection.startPoints[0] as Anchor;
                const endAnchor = connection.endPoints[0] as Anchor;

                if (startAnchor && endAnchor) {

                    // When having the anchors, we want to add two further control points for the spline
                    // These control points depend on the distance between the anchor points
                    const distanceBetweenAnchors = startAnchor.anchorPoint.distanceTo(endAnchor.anchorPoint)[0];
                    const anchorDistanceFactor = 0.4
                    const distanceToControlPoint = distanceBetweenAnchors * anchorDistanceFactor;

                    const startControlPoint = startAnchor.getPointInDirection(distanceToControlPoint);
                    const endControlPoint = endAnchor.getPointInDirection(distanceToControlPoint);


                    // connection.startPoints = [startAnchor, startControlPoint];
                    // connection.endPoints = [endControlPoint, endAnchor];

                    const bezierCurve = new CubicBezierCurve(startAnchor.anchorPoint, startControlPoint, endControlPoint, endAnchor.anchorPoint);
                    connection.points = [bezierCurve];

                    // node.debugShapes.push(new Circle(startControlPoint, 2));
                    // node.debugShapes.push(new Circle(endControlPoint, 3));
                }


                connection.curveStyle = "basis";


            })

        }

        if (outgoingConnectionsOutside.length > 0) {

            const outsideConnections = [...outgoingConnectionsOutside];

            // Now we distribute the connections inside the parent circle
            outsideConnections.forEach((connection, index) => {
                const sizeArrow = 10;

                const startAnchor = connection.startPoints[0] as Anchor;
                const endAnchor = connection.endPoints[0] as Anchor;

                if (startAnchor && endAnchor) {

                    // When having the anchors, we want to add two further control points for the spline
                    // These control points depend on the distance between the anchor points
                    const distanceBetweenAnchors = startAnchor.anchorPoint.distanceTo(endAnchor.anchorPoint)[0];
                    const anchorDistanceFactor = 0.4
                    const distanceToControlPoint = distanceBetweenAnchors * anchorDistanceFactor;

                    const startControlPoint = startAnchor.getPointInDirection(distanceToControlPoint);
                    const endControlPoint = endAnchor.getPointInDirection(distanceToControlPoint);


                    // connection.startPoints = [startAnchor, startControlPoint];
                    // connection.endPoints = [endControlPoint, endAnchor];

                    const bezierCurve = new CubicBezierCurve(startAnchor.anchorPoint, startControlPoint, endControlPoint, endAnchor.anchorPoint);
                    connection.points = [bezierCurve];

                    // node.debugShapes.push(new Circle(startControlPoint, 2));
                    // node.debugShapes.push(new Circle(endControlPoint, 3));
                }


                connection.curveStyle = "basis";


            })
        }



    }

}
