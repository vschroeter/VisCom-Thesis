import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialCircularArcConnectionLayouter, RadialConnectionsHelper } from "./radialConnections";


export class DirectCircularConnectionLayouter extends BaseNodeConnectionLayouter {

    radialConnectionsHelper: RadialConnectionsHelper;

    constructor() {
        super();

        this.radialConnectionsHelper = new RadialConnectionsHelper({
            forwardBackwardThresholdDeg: 270
        });
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

        // Render direct connections
        [...directOutForwardConnections, ...directInForwardConnections].forEach(connection => {
            const start = connection.source;
            const end = connection.target;
            const parent = start.parent;
            if (!parent) return;

            // Make the parent circle slightly smaller
            const outerC = parent.innerCircle.clone()
            // outerC.r += 10 * parent.sizeFactor;
            outerC.r += 0.1 * Math.min(start.outerCircle.r, end.outerCircle.r);
            if (!parent) return;

            connection.setPoints(RadialCircularArcConnectionLayouter.getCircularArcBetweenCircles(
                start.outerCircle,
                end.outerCircle,
                outerC,
                "clockwise"
            ));
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
            outerC.r -= 0.2 * Math.min(start.outerCircle.r, end.outerCircle.r);

            connection.setPoints(RadialCircularArcConnectionLayouter.getCircularArcBetweenCircles(
                start.outerCircle,
                end.outerCircle,
                outerC,
                "counter-clockwise"
            ));
        });
    }

}
