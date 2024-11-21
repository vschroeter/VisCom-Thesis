import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialCircularArcConnectionLayouter, RadialPositioner, RadialPositionerDynamicDistribution } from "../linear/radial/radialLayouter";
import { RadialUtils } from "../utils/radialUtils";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

export class RadialSplineConnectionLayouter extends BaseNodeConnectionLayouter {

    // distanceBetweenNodes(node1: LayoutNode, node2: LayoutNode): number {

    //     // If the nodes have the same parent, we calculate the radial distance
    //     if ((node1.parent && node2.parent) && node1.parent == node2.parent) {

    //         const center = node1.parent.center;
    //         const angle1 = RadialPositioner.getAngleRad(node1.center, center);
    //         const angle2 = RadialPositioner.getAngleRad(node2.center, center);
    //         const radialDistance = RadialPositioner.getRadialDistance(angle1, angle2, node1.parent.innerRadius);
    //         return radialDistance;
    //     }

    //     return Math.sqrt((node1.x - node2.x) ** 2 + (node1.y - node2.y) ** 2);
    // }

    // angleBetweenNodes(node1: LayoutNode, node2: LayoutNode): number {

    //     // If the nodes have the same parent, we calculate the radial distance
    //     if ((node1.parent && node2.parent) && node1.parent == node2.parent) {

    //         const center = node1.parent.center;
    //         const angle1 = RadialPositioner.getAngleRad(node1.center, center);
    //         const angle2 = RadialPositioner.getAngleRad(node2.center, center);
    //         return Math.abs(angle1 - angle2);
    //     }

    //     return Math.atan2(node2.y - node1.y, node2.x - node1.x);
    // }

    override layoutConnectionsOfNode(node: LayoutNode): void {

        const forwardBackwardThresholdDeg = 270;
        const forwardBackwardThresholdRad = forwardBackwardThresholdDeg * Math.PI / 180;

        const outgoingConnections = node.outConnections;
        const incomingConnections = node.inConnections;
        // const bidirectionalConnections = node.bidirectionalConnections;

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

        allConnections.forEach((connection) => {
            if (connection.finishedLayouting) return;

            const start = connection.source;
            const end = connection.target;
            const isOutgoing = start == node;

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
                if ((start.parent && end.parent) && start.parent == end.parent) {

                    const forwardRadBetweenPoints = RadialUtils.forwardRadBetweenPoints(start.center, end.center, start.parent.center);
                    const isAboveThreshold = forwardRadBetweenPoints > forwardBackwardThresholdRad;

                    if (isAboveThreshold && isOutgoing) {
                        outgoingConnectionsOutside.push(connection);
                    } else if (isAboveThreshold && !isOutgoing) {
                        incomingConnectionsOutside.push(connection);
                    } else if (!isAboveThreshold && isOutgoing) {
                        outgoingConnectionsInside.push(connection);
                    } else if (!isAboveThreshold && !isOutgoing) {
                        incomingConnectionsInside.push(connection);
                    }
                } else {
                    connectionsWithDifferentParents.push(connection);
                }
            }
        })

        console.log({
            id: node.id,
            directOutForwardConnections,
            directOutBackwardConnections,
            directInForwardConnections,
            directInBackwardConnections,
            outgoingConnectionsInside,
            incomingConnectionsInside,
            outgoingConnectionsOutside,
            incomingConnectionsOutside
        });



        // Render direct connections
        [...directOutForwardConnections, ...directInForwardConnections].forEach(connection => {
            const start = connection.source;
            const end = connection.target;
            const parent = start.parent;
            if (!parent) return;

            // Make the parent circle slightly smaller
            const outerC = parent.innerCircle.clone()
            // outerC.r += 10 * parent.sizeFactor;
            outerC.r -= 0.1 * Math.min(start.outerCircle.r, end.outerCircle.r);
            if (!parent) return;

            connection.points = RadialCircularArcConnectionLayouter.getCircularArcBetweenCircles(
                start.outerCircle,
                end.outerCircle,
                outerC,
                "clockwise"
            )
            connection.finishedLayouting = true;
        });

        // Render direct backward connections
        [...directOutBackwardConnections, ...directInBackwardConnections].forEach(connection => {
            const start = connection.source;
            const end = connection.target;
            const parent = start.parent;
            if (!parent) return;

            // Make the parent circle slightly larger
            const outerC = parent.innerCircle.clone()
            // outerC.r += 10 * parent.sizeFactor;
            outerC.r += 0.3 * Math.min(start.outerCircle.r, end.outerCircle.r);

            connection.points = RadialCircularArcConnectionLayouter.getCircularArcBetweenCircles(
                start.outerCircle,
                end.outerCircle,
                outerC,
                "counter-clockwise"
            )
        });

        // Render connections inside the parent circle

        // For the inside connections, we first determine the available range to positions connections 
        // without overlapping with the adjacent nodes
        const nextNode = node.getNextNodeInSorting();
        const prevNode = node.getPreviousNodeInSorting();

        if (nextNode && prevNode) {
            // For that we can calculate the tangent from the start node to the adjacent nodes
            const nextTangents = RadialUtils.getTangentsToCircle(node.center, nextNode.outerCircle);
            const prevTangents = RadialUtils.getTangentsToCircle(node.center, prevNode.outerCircle);

            const nextTangent = RadialUtils.getClosestShapeToPoint(nextTangents, node.center);


        }




    }

}
