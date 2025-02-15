import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialUtils } from "../utils/radialUtils";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { Segment } from "2d-geometry";
import { Anchor } from "src/graph/graphical";
import { RadialConnectionsHelper } from "./radialConnections";
import { SmoothSplineSegment } from "src/graph/graphical/primitives/pathSegments/SmoothSpline";

////////////////////////////////////////////////////////////////////////////
// #region Continuum
////////////////////////////////////////////////////////////////////////////

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


////////////////////////////////////////////////////////////////////////////
// #region Spline Layouter
////////////////////////////////////////////////////////////////////////////

export class RadialSplineConnectionLayouter extends BaseNodeConnectionLayouter {
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

            // console.log(node.id,
            //     {
            //         onlyOutgoingConnections,
            //         onlyIncomingConnections,
            //         filteredIncomingOutsideConnections,
            //         filteredOutgoingOutsideConnections,
            //         combinedConnections
            //     }
            // );

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
            RadialSplineConnectionLayouter.sortConnectionsByIndexInPlace(outgoingConnectionsCombined, node, false, connectionGetter);

            RadialSplineConnectionLayouter.sortConnectionsByIndexInPlace(onlyIncomingConnections, node);

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

            const sortedConnections = [...outgoingConnectionsCombined, ...onlyIncomingConnections];

            // Now we distribute the connections inside the parent circle
            sortedConnections.forEach((connections, index) => {
                const isArray = Array.isArray(connections);
                const connection = isArray ? connections[0] : connections;

                if (isArray) {
                    connections.forEach(connection => {
                        connection.pathSegment = connection.pathSegment ?? new SmoothSplineSegment(connection);
                    })
                }

                const spline = (connection.pathSegment ?? new SmoothSplineSegment(connection)) as SmoothSplineSegment;
                connection.pathSegment = spline;

                // For the inside connections, we first determine the available range to positions connections
                // without overlapping with the adjacent nodes
                const sourceNode = connection.source;
                const targetNode = connection.target;
                const commonParent = LayoutNode.firstCommonParent(sourceNode, targetNode)!;
                const nodeIndexInCommonParent = commonParent.getIndexOfNodeContainingDescendant(node);
                const nextNode = commonParent.getNodeAtIndex(nodeIndexInCommonParent + 1);
                const prevNode = commonParent.getNodeAtIndex(nodeIndexInCommonParent - 1);

                const nextTangents = RadialUtils.getTangentsFromPointToCircle(node.center, nextNode.outerCircle);
                const prevTangents = RadialUtils.getTangentsFromPointToCircle(node.center, prevNode.outerCircle);

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

                const anchor = new Anchor(intersectionPoints[0], slopeVector);
                const anchorReversed = anchor.cloneReversed();
                // const anchorOutgoing = new Anchor(intersectionPoints[0], slopeVector.rotate90CCW());
                // const anchorIncoming = new Anchor(intersectionPoints[0], slopeVector.rotate90CW());


                if (!isArray) {
                    if (isOutgoing) {
                        // connection.startPoints = [anchor];
                        spline.startAnchor = anchor;
                    } else {
                        spline.endAnchor = anchorReversed;
                    }
                } else {
                    // Here we adapt the anchors for the combined connections
                    connections.forEach(connection => {
                        const isOutgoing = connection.source == node;
                        const smallerR = Math.min(connection.source.outerCircle.r, connection.target.outerCircle.r);
                        const translationDistance = (1 / continuumSize) * smallerR * slopeDiff / (Math.PI * 2);
                        if (isOutgoing) {
                            // The outgoing anchor should be translated a little bit to the left (so the vector rotated by 90 degrees CCW)
                            const anchor = new Anchor(intersectionPoints[0].translate(slopeVector.rotate90CCW().multiply(translationDistance)), slopeVector);
                            connection.pathSegment!.startAnchor = anchor;
                        } else {
                            // The incoming anchor should be translated a little bit to the right (so the vector rotated by 90 degrees CW)
                            const anchor = new Anchor(intersectionPoints[0].translate(slopeVector.rotate90CW().multiply(translationDistance)), slopeVector.rotate(Math.PI));
                            connection.pathSegment!.endAnchor = anchor;
                        }
                    })
                }
            })
        }

        if (outgoingConnectionsOutside.length > 0 || incomingConnectionsOutside.length > 0) {

            // Sort the outside connections:
            // - A) first the outgoing connections, then the incoming connections
            // - B) sort the connections by the index of the target node in the sorting

            RadialSplineConnectionLayouter.sortConnectionsByIndexInPlace(filteredOutgoingOutsideConnections, node, true);
            RadialSplineConnectionLayouter.sortConnectionsByIndexInPlace(filteredIncomingOutsideConnections, node, true);

            const outsideConnections = [...filteredOutgoingOutsideConnections, ...filteredIncomingOutsideConnections];

            // Now we distribute the connections inside the parent circle
            outsideConnections.forEach((connection, index) => {

                const spline = (connection.pathSegment ?? new SmoothSplineSegment(connection)) as SmoothSplineSegment;
                connection.pathSegment = spline;

                // For the inside connections, we first determine the available range to positions connections
                // without overlapping with the adjacent nodes
                const sourceNode = connection.source;
                const targetNode = connection.target;
                const commonParent = LayoutNode.firstCommonParent(sourceNode, targetNode)!;
                const nodeIndexInCommonParent = commonParent.getIndexOfNodeContainingDescendant(node);
                const nextNode = commonParent.getNodeAtIndex(nodeIndexInCommonParent + 1);
                const prevNode = commonParent.getNodeAtIndex(nodeIndexInCommonParent - 1);

                const nextTangents = RadialUtils.getTangentsFromPointToCircle(node.center, nextNode.outerCircle);
                const prevTangents = RadialUtils.getTangentsFromPointToCircle(node.center, prevNode.outerCircle);

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
                    spline.startAnchor = anchor;
                } else {
                    const anchor = new Anchor(intersectionPoints[0], slopeVector.rotate90CW());
                    spline.endAnchor = anchor;
                }
            })
        }
    }

    override layoutConnectionsOfChildren(parent: LayoutNode): void {

    }
}
