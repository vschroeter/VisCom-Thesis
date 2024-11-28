import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import {  RadialPositioner, RadialPositionerDynamicDistribution } from "../linear/radial/radialLayouter";
import { RadialUtils } from "../utils/radialUtils";
import { LayoutConnection, LayoutConnectionPoint } from "src/graph/visGraph/layoutConnection";
import { Circle, Line, Point, Ray, Segment, Vector } from "2d-geometry";
import { Anchor } from "src/graph/graphical";
import { RadialConnectionsHelper } from "./radialConnections";
import { CubicBezierCurve } from "src/graph/graphical/primitives/pathSegments/BezierCurve";
import { ShapeUtil } from "../utils/shapeUtil";
import { CircleSegmentConnection } from "src/graph/graphical/primitives/pathSegments/CircleSegment";


class Continuum {

    parent: LayoutNode;
    connectionContinuum: Map<LayoutConnection, number> = new Map();
    currentContinuumPos: number = 0;
    continuumSize: number = 0;

    constructor(parent: LayoutNode, startContinuumPos: number = 0) {
        this.parent = parent;
        this.currentContinuumPos = startContinuumPos;
    }

    addConnection(connection: LayoutConnection, distance: number = 1) {
        this.connectionContinuum.set(connection, this.currentContinuumPos);
        this.currentContinuumPos += distance;
        this.continuumSize = this.currentContinuumPos;
    }

    increaseContinuum(size: number) {
        this.currentContinuumPos += size;
    }

    getContinuumPos(connection: LayoutConnection, normalized = true) {
        if (normalized) {
            return this.connectionContinuum.get(connection)! / this.continuumSize
        }
        return this.connectionContinuum.get(connection)!;
    }
}

export class RadialSplineConnectionAnchorPointCalculator extends BaseNodeConnectionLayouter {

    radialConnectionsHelper: RadialConnectionsHelper;

    constructor() {
        super();

        this.radialConnectionsHelper = new RadialConnectionsHelper({
            forwardBackwardThresholdDeg: 360
        });
    }

    static sortConnectionsByIndexInPlace<T>(connections: T[], node: LayoutNode, reverse = false, getConnection: (c: T) => LayoutConnection = (c: T) => c as LayoutConnection): T[] {
        connections.sort((_a, _b) => {
            const a = getConnection(_a);
            const b = getConnection(_b);
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
        if (reverse) {
            connections.reverse();
        }
        return connections;
    }

    override layoutConnectionsOfNode(node: LayoutNode): void {
        const connections = this.radialConnectionsHelper.getConnectionTypesFromNode(node);
        // console.log(node.id, connections);

        const outgoingConnectionsInside: LayoutConnection[] = connections.outgoingConnectionsInside;
        const incomingConnectionsInside: LayoutConnection[] = connections.incomingConnectionsInside;

        const outgoingConnectionsOutside: LayoutConnection[] = connections.outgoingConnectionsOutside;
        const incomingConnectionsOutside: LayoutConnection[] = connections.incomingConnectionsOutside;

        let filteredIncomingOutsideConnections: LayoutConnection[] = incomingConnectionsOutside;
        let filteredOutgoingOutsideConnections: LayoutConnection[] = outgoingConnectionsOutside;

        const connectionsWithDifferentParents: LayoutConnection[] = connections.connectionsWithDifferentParents;

        const selfConnections: LayoutConnection[] = connections.selfConnections;

        // Here we just calculate the anchor points for the splines
        // In the next step, additional control points will be added by other layouters

        if (outgoingConnectionsInside.length > 0 || incomingConnectionsInside.length > 0) {
            // Besides the inside connections, we also consider the incoming outside connections, in case that we can combine them with an inside connection
            const connectionsForCombining = [...outgoingConnectionsInside, ...incomingConnectionsInside, ...incomingConnectionsOutside, ...outgoingConnectionsOutside];

            const mapIdsToConnection = new Map<string, Map<string, LayoutConnection>>();
            connectionsForCombining.forEach((connection) => {
                mapIdsToConnection.set(connection.source.id, new Map());
                mapIdsToConnection.get(connection.source.id)!.set(connection.target.id, connection);
            });
            // A list of connections, that have an opposite connection as well
            const mapCombinedConnections = new Map<string, Map<string, [LayoutConnection, LayoutConnection]>>();
            [...outgoingConnectionsInside, ...outgoingConnectionsOutside].forEach((outgoingConnection) => {
                const incomingConnection = mapIdsToConnection.get(outgoingConnection.target.id)?.get(outgoingConnection.source.id);
                if (incomingConnection) {
                    if (!mapCombinedConnections.has(outgoingConnection.source.id)) {
                        mapCombinedConnections.set(outgoingConnection.source.id, new Map());
                    }
                    mapCombinedConnections.get(outgoingConnection.source.id)!.set(outgoingConnection.target.id, [outgoingConnection, incomingConnection]);
                }
            })

            // Remove the combined connections from the inside connections
            const onlyOutgoingConnections = outgoingConnectionsInside.filter((outgoingConnection) => {
                return !mapCombinedConnections.get(outgoingConnection.source.id)?.get(outgoingConnection.target.id) &&
                    !mapCombinedConnections.get(outgoingConnection.target.id)?.get(outgoingConnection.source.id)
            });
            const onlyIncomingConnections = incomingConnectionsInside.filter((incomingConnection) => {
                return !mapCombinedConnections.get(incomingConnection.source.id)?.get(incomingConnection.target.id) &&
                    !mapCombinedConnections.get(incomingConnection.target.id)?.get(incomingConnection.source.id)
            });
            filteredIncomingOutsideConnections = incomingConnectionsOutside.filter((incomingConnection) => {
                return !mapCombinedConnections.get(incomingConnection.source.id)?.get(incomingConnection.target.id) &&
                    !mapCombinedConnections.get(incomingConnection.target.id)?.get(incomingConnection.source.id)
            });
            filteredOutgoingOutsideConnections = outgoingConnectionsOutside.filter((outgoingConnection) => {
                return !mapCombinedConnections.get(outgoingConnection.source.id)?.get(outgoingConnection.target.id) &&
                    !mapCombinedConnections.get(outgoingConnection.target.id)?.get(outgoingConnection.source.id)
            });

            const combinedConnections: [LayoutConnection, LayoutConnection][] = [];
            mapCombinedConnections.forEach((map) => {
                map.forEach((connectionPair) => {
                    combinedConnections.push(connectionPair);
                })
            })

            console.log(node.id,
                {
                    onlyOutgoingConnections,
                    onlyIncomingConnections,
                    filteredIncomingOutsideConnections,
                    filteredOutgoingOutsideConnections,
                    combinedConnections
                }
            );

            // Sort the three groups of inside connections:
            // - first the outgoing connections, then the combined connections and then the incoming connections
            // - Inside the groups: sort the connections by the index of the target node in the sorting
            // RadialSplineConnectionAnchorPointCalculator.sortConnectionsByIndexInPlace(onlyOutgoingConnections, node);
            // RadialSplineConnectionAnchorPointCalculator.sortConnectionsByIndexInPlace(combinedConnections, node, false, (pair) => pair[0]);

            // We combine the outgoing connections and the combined connections, so we need to sort them together
            const outgoingConnectionsCombined = [...onlyOutgoingConnections, ...combinedConnections];
            const connectionGetter = (pair: [LayoutConnection, LayoutConnection] | LayoutConnection) => {
                if (Array.isArray(pair)) {
                    return pair[0];
                } else {
                    return pair;
                }
            }
            RadialSplineConnectionAnchorPointCalculator.sortConnectionsByIndexInPlace(outgoingConnectionsCombined, node, false, connectionGetter);

            RadialSplineConnectionAnchorPointCalculator.sortConnectionsByIndexInPlace(onlyIncomingConnections, node);

            const mapParentNodeIdToContinuum = new Map<string, Continuum>();

            const addConnectionToContinuum = (connections: [LayoutConnection, LayoutConnection] | LayoutConnection) => {
                const connection = connectionGetter(connections);
                const startNode = connection.source;
                const targetNode = connection.target;
                const commonParent = LayoutNode.firstCommonParent(startNode, targetNode)!;
                if (!mapParentNodeIdToContinuum.has(commonParent.id)) {
                    mapParentNodeIdToContinuum.set(commonParent.id, new Continuum(commonParent, 1));
                }

                const continuum = mapParentNodeIdToContinuum.get(commonParent.id)!;
                continuum.addConnection(connection);
            };

            outgoingConnectionsCombined.forEach(connections => {
                addConnectionToContinuum(connections);
            })

            mapParentNodeIdToContinuum.forEach(continuum => continuum.increaseContinuum(1));

            onlyIncomingConnections.forEach(connection => {
                addConnectionToContinuum(connection);
            })

            // const continuumMap = new Map<number, number>();
            // let currentPos = 1;
            // let currentIndex = 0;
            // outgoingConnectionsCombined.forEach(connection => {
            //     continuumMap.set(currentIndex, currentPos);
            //     currentPos += 1;
            //     currentIndex += 1;
            // });
            // // currentPos += (onlyOutgoingConnections.length > 0 && combinedConnections.length) ? 1 : 0;
            // // combinedConnections.forEach(connection => {
            // //     continuumMap.set(currentIndex, currentPos);
            // //     currentPos += 1;
            // //     currentIndex += 1;
            // // });
            // // currentPos += (combinedConnections.length > 0 && onlyIncomingConnections.length) ? 1 : 0;
            // currentPos += (outgoingConnectionsCombined.length > 0 && onlyIncomingConnections.length) ? 1 : 0;
            // onlyIncomingConnections.forEach(connection => {
            //     continuumMap.set(currentIndex, currentPos);
            //     currentPos += 1;
            //     currentIndex += 1;
            // });

            // const continuumSize = currentPos;
            // const sortedConnections = [...onlyOutgoingConnections, ...combinedConnections, ...onlyIncomingConnections];
            const sortedConnections = [...outgoingConnectionsCombined, ...onlyIncomingConnections];

            // Now we distribute the connections inside the parent circle
            sortedConnections.forEach((connections, index) => {
                const isArray = Array.isArray(connections);
                const connection = isArray ? connections[0] : connections;



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

                // const continuumPosNormed = continuumMap.get(index)! / continuumSize;
                const continuum = mapParentNodeIdToContinuum.get(commonParent.id)!;
                const continuumPosNormed = continuum.getContinuumPos(connection, true);
                const continuumSize = continuum.continuumSize;

                // const slopeRad = startSlope + (index + 1) * slopeDiff / (insideConnections.length + 1);
                const slopeRad = startSlope + slopeDiff * continuumPosNormed;
                const slopeVector = RadialUtils.radToVector(slopeRad);
                const slopeSegmentForIntersection = new Segment(node.center, node.center.translate(slopeVector.multiply(2 * node.outerCircle.r)));

                // There should be exactly one intersection point, that will be the anchor point
                const intersectionPoints = node.outerCircle.intersect(slopeSegmentForIntersection);
                if (intersectionPoints.length !== 1) {
                    throw new Error("No intersection point found.");
                }

                if (node.id == "facialexpressionmanager_node") {
                    console.log({
                        id: node.id,
                        commonParent: commonParent.id,
                        nextNode: nextNode.id,
                        prevNode: prevNode.id,
                        index,
                        continuumPosNormed,
                        slopeRad,
                        slopeVector,
                        intersectionPoints
                    })
                }

                const anchor = new Anchor(intersectionPoints[0], slopeVector);
                // const anchorOutgoing = new Anchor(intersectionPoints[0], slopeVector.rotate90CCW());
                // const anchorIncoming = new Anchor(intersectionPoints[0], slopeVector.rotate90CW());

                if (!isArray) {
                    if (isOutgoing) {
                        connection.startPoints = [anchor];
                    } else {
                        connection.endPoints = [anchor];
                    }
                } else {
                    connections.forEach(connection => {
                        const isOutgoing = connection.source == node;
                        const translationDistance = (1 / continuumSize) * node.outerCircle.r * slopeDiff / (Math.PI * 2);
                        if (isOutgoing) {
                            // The outgoing anchor should be translated a little bit to the left (so the vector rotated by 90 degrees CCW)
                            const anchor = new Anchor(intersectionPoints[0].translate(slopeVector.rotate90CCW().multiply(translationDistance)), slopeVector);
                            connection.startPoints = [anchor];
                        } else {
                            // The incoming anchor should be translated a little bit to the right (so the vector rotated by 90 degrees CW)
                            const anchor = new Anchor(intersectionPoints[0].translate(slopeVector.rotate90CW().multiply(translationDistance)), slopeVector);
                            connection.endPoints = [anchor];
                        }
                    })
                }
            })
        }

        if (outgoingConnectionsOutside.length > 0 || incomingConnectionsOutside.length > 0) {

            // Sort the outside connections:
            // - A) first the outgoing connections, then the incoming connections
            // - B) sort the connections by the index of the target node in the sorting

            RadialSplineConnectionAnchorPointCalculator.sortConnectionsByIndexInPlace(filteredOutgoingOutsideConnections, node, true);
            RadialSplineConnectionAnchorPointCalculator.sortConnectionsByIndexInPlace(filteredIncomingOutsideConnections, node, true);

            const outsideConnections = [...filteredOutgoingOutsideConnections, ...filteredIncomingOutsideConnections];

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

                
                if (isOutgoing) {
                    const anchor = new Anchor(intersectionPoints[0], slopeVector);
                    connection.startPoints = [anchor];
                } else {
                    const anchor = new Anchor(intersectionPoints[0], slopeVector);
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
            forwardBackwardThresholdDeg: 360
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


export class RadialSubConnectionLayouter extends BaseNodeConnectionLayouter {


    radialConnectionsHelper: RadialConnectionsHelper;

    constructor() {
        super();

        this.radialConnectionsHelper = new RadialConnectionsHelper({
            forwardBackwardThresholdDeg: 360
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

        node.outConnections.forEach(connection => {
            if (connection.hasParentHyperConnection) {
                const start = connection.source;
                const end = connection.target;

                let currentStart = start;
                let currentEnd = end;

                const parentHyperConnection = connection.parent!;
                const hyperStart = parentHyperConnection.source;
                const hyperEnd = parentHyperConnection.target;

                const startAnchors: LayoutConnectionPoint[] = [];
                const endAnchors: LayoutConnectionPoint[] = [];

                const segments: CircleSegmentConnection[] = [];

                // From the start node we build the connection to the start of the hyper connection
                while (currentStart != hyperStart) {
                    const node = currentStart;
                    // The anchor is outgoing from the current node away from the parent's center

                    const parentCenter = node.parent?.center ?? new Point(0, 0);
                    const nodeCenter = node.center;
                    const line = new Line(parentCenter, nodeCenter);
                    const intersections = node.outerCircle.intersect(line);
                    const intersection = ShapeUtil.getFurthestShapeToPoint(intersections, parentCenter, (intersection) => intersection)!;

                    const anchor = new Anchor(intersection, new Vector(parentCenter, intersection));

                    if (start.id == "4") {
                        const x = 5;
                    }

                    startAnchors.push(anchor);

                    // Adapt the last segment
                    const lastSegment = segments[segments.length - 1];
                    if (lastSegment) {
                        lastSegment.setEndAnchor(anchor);
                    }

                    const arcConnection = new CircleSegmentConnection(anchor, node.parent!.circle)
                    arcConnection.node = node;
                    segments.push(arcConnection);



                    currentStart = node.parent!;
                }

                const lastSegment = segments[segments.length - 1];
                if (lastSegment) {
                    const anchor = parentHyperConnection.startPoints[0] as Anchor ?? parentHyperConnection.points[0] as Anchor
                    lastSegment.setEndAnchor(anchor);
                }

                // connection.startPoints = startAnchors;
                connection.startPoints = segments;
                connection.points = parentHyperConnection.points;
            }
        })




    }
}
