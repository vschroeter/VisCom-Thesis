import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { DirectCircleArcConnection } from "./circularArcConnection";
import { FlexConnection, FlexConnectionType, EmptyFlexConnection } from "./flexConnection";
import { InsideParentConnection } from "./insideConnection";
import { FlexConnectionLayouter } from "./flexLayouter";


export class FlexNode {

    layoutNode: LayoutNode;

    connections: FlexConnection[] = [];

    outConnections: FlexConnection[] = [];
    inConnections: FlexConnection[] = [];

    parentLayouter: FlexConnectionLayouter;

    constructor(layoutNode: LayoutNode, parentLayouter: FlexConnectionLayouter) {
        this.layoutNode = layoutNode;
        this.parentLayouter = parentLayouter;

        // layoutNode.outConnections.forEach(connection => {
        //     this.addConnection(connection);
        // });

        // layoutNode.inConnections.forEach(connection => {
        //     this.addConnection(connection);
        // });
    }

    initConnections() {
        this.layoutNode.outConnections.forEach(connection => {
            this.addConnection(connection);
        });
        this.layoutNode.inConnections.forEach(connection => {
            this.addConnection(connection);
        });
    }

    addConnection(layoutConnection: LayoutConnection) {
        // const connection = new FlexConnection(layoutConnection, this);
        // const connection = FlexNode.createConnection(layoutConnection, this);
        const connection = this.parentLayouter.getFlexConnection(layoutConnection);
        this.connections.push(connection);
        if (connection.source === this.layoutNode) {
            this.outConnections.push(connection);
        } else {
            this.inConnections.push(connection);
        }
    }

    static createConnection(connection: LayoutConnection, flexNode: FlexNode): FlexConnection {
        const source = connection.source;
        const target = connection.target;
        let type: FlexConnectionType = "unknown";
        if (source.parent === target.parent) {
            if (source.isDirectPredecessorInSortingTo(target)) {
                type = "circleArcForward";
            } else if (source.isDirectSuccessorInSortingTo(target)) {
                type = "circleArcBackward";
            } else {
                type = "sameParent";
            }
        } else {
            const commonParent = source.getCommonParent(target);

            // if ((commonParent == source.parent || commonParent == source.parent?.parent) && (commonParent == target.parent || commonParent == target.parent?.parent)) {
            //     const firstChildContainingSource = commonParent?.getChildNodeContainingNodeAsDescendant(source);
            //     const firstChildContainingTarget = commonParent?.getChildNodeContainingNodeAsDescendant(target);

            //     if (firstChildContainingSource?.isDirectPredecessorInSortingTo(firstChildContainingTarget)) {
            //         this.type = "sameHyperParentDirectForward";
            //     } else if (firstChildContainingSource?.isDirectSuccessorInSortingTo(firstChildContainingTarget)) {
            //         this.type = "sameHyperParentDirectBackward";
            //     }
            // }

            if (source.isAnchor || target.isAnchor) {

                const firstChildContainingSource = commonParent?.getChildNodeContainingNodeAsDescendant(source);
                const firstChildContainingTarget = commonParent?.getChildNodeContainingNodeAsDescendant(target);

                if (firstChildContainingSource?.isDirectPredecessorInSortingTo(firstChildContainingTarget)) {
                    type = "circleArcForward";
                } else if (firstChildContainingSource?.isDirectSuccessorInSortingTo(firstChildContainingTarget)) {
                    type = "circleArcBackward";
                }
            }

            if (type == "unknown") {
                type = "differentParent";
            }
        }

        switch (type) {
            case "circleArcForward":
                return new DirectCircleArcConnection(connection, type, flexNode);
            case "circleArcBackward":
                return new DirectCircleArcConnection(connection, type, flexNode);
            case "sameParent":
                return new InsideParentConnection(connection, type, flexNode);

            // case "differentParent":
            //     return
            // // return new DifferentParentConnection(connection, flexNode);
            // default:
            //     throw new Error(`Unknown FlexConnectionType: ${type}`);
        }

        return new EmptyFlexConnection(connection, type, flexNode);
    }

    ////////////////////////////////////////////////////////////////////////////
    // #regio Flex Connection Types
    ////////////////////////////////////////////////////////////////////////////

    get circleArcForwardConnections() {
        return this.connections.filter(c => c.type === "circleArcForward");
    }

    get circleArcBackwardConnections() {
        return this.connections.filter(c => c.type === "circleArcBackward");
    }

    get circleArcConnections() {
        return this.circleArcForwardConnections.concat(this.circleArcBackwardConnections);
    }

    get sameParentConnections() {
        return this.connections.filter(c => c.type === "sameParent");
    }

}
