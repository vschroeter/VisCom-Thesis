import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialCircularArcConnectionLayouter, RadialConnectionsHelper } from "./radialConnections";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { Circle, Vector } from "2d-geometry";


export class DirectCircularConnectionLayouter extends BaseNodeConnectionLayouter {

    radialConnectionsHelper: RadialConnectionsHelper;

    constructor() {
        super();

        this.radialConnectionsHelper = new RadialConnectionsHelper({
            forwardBackwardThresholdDeg: 270
        });
    }

    static calculateConnection(connection: LayoutConnection, segmentCircle: Circle, direction: "clockwise" | "counter-clockwise"): void {
        const start = connection.source;
        const end = connection.target;

        try {

            connection.pathSegment = RadialCircularArcConnectionLayouter.getCircularArcBetweenCircles(
                connection,
                start.outerCircle,
                end.outerCircle,
                segmentCircle,
                direction
            );
        } catch (e) {
            // connection.source.debugShapes.push(start.outerCircle);
            // connection.source.debugShapes.push(end.outerCircle);
            // connection.source.debugShapes.push(segmentCircle);
            console.error("Error in circular arc connection layouting", {
                connection,
                start,
                end,
                segmentCircle
            })
            throw e;
        }
        connection.finishedLayouting = true;

    }

    override layoutConnectionsOfNode(node: LayoutNode): void {

        // const forwardBackwardThresholdDeg = 270;
        // const forwardBackwardThresholdRad = forwardBackwardThresholdDeg * Math.PI / 180;

        // const outgoingConnections = node.outConnections;
        // const incomingConnections = node.inConnections;
        // // const bidirectionalConnections = node.bidirectionalConnections;

        // const allConnections = [...outgoingConnections, ...incomingConnections];

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
        const directOutForwardConnections = connections.directOutForwardConnections;
        const directOutBackwardConnections = connections.directOutBackwardConnections;
        const directInForwardConnections = connections.directInForwardConnections;
        const directInBackwardConnections = connections.directInBackwardConnections;


        directOutForwardConnections.forEach(connection => {
            let adaptedCircle = node.parent?.innerCircle.clone();
            if (!adaptedCircle) return;
            adaptedCircle.r += 0.1 * Math.min(connection.source.outerCircle.r, connection.target.outerCircle.r);

            // If the parent node has only two children, the circle is adapted to be larger, so that the connection is more direct
            if (node.parent?.children.length === 2) {
                const centerTranslationVector = new Vector(connection.source.center, connection.target.center).rotate90CW();
                const newCenter = node.parent.center.translate(centerTranslationVector);
                const newRadius = newCenter.distanceTo(node.center)[0];
                adaptedCircle = new Circle(newCenter, newRadius);
                // node.debugShapes.push(adaptedCircle);
            }

            DirectCircularConnectionLayouter.calculateConnection(connection, adaptedCircle, "clockwise");
        });

        directOutBackwardConnections.forEach(connection => {
            let adaptedCircle = node.parent?.innerCircle.clone();
            if (!adaptedCircle) return;
            adaptedCircle.r -= 0.2 * Math.min(connection.source.outerCircle.r, connection.target.outerCircle.r);

            // If the parent node has only two children, the circle is adapted to be larger, so that the connection is more direct
            if (node.parent?.children.length === 2) {
                const centerTranslationVector = new Vector(connection.source.center, connection.target.center).rotate90CCW();
                const newCenter = node.parent.center.translate(centerTranslationVector);
                const newRadius = newCenter.distanceTo(node.center)[0];
                adaptedCircle = new Circle(newCenter, newRadius);
                // node.debugShapes.push(adaptedCircle);
            }

            DirectCircularConnectionLayouter.calculateConnection(connection, adaptedCircle, "counter-clockwise");
        });
    }

}
