import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { degToRad, RadialUtils } from "../utils/radialUtils";


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

                if (commonParent) {
                    const forwardRadBetweenPoints = RadialUtils.forwardRadBetweenPoints(start.center, end.center, commonParent.center);
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
