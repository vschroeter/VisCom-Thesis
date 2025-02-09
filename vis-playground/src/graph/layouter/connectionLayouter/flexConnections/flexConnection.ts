import { CombinedPathSegment, PathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialCircularArcConnectionLayouter } from "../radialConnections";
import { Circle, Point, Vector } from "2d-geometry";
import { Anchor, EllipticArc } from "src/graph/graphical";
import { RadialUtils } from "../../utils/radialUtils";
import { SmoothSplineSegment } from "src/graph/graphical/primitives/pathSegments/SmoothSpline";
import { DirectCircleArcConnection } from "./circularArcConnection";


export type FlexConnectionParentType = "sameParent" | "differentParent";

export type FlexConnectionType =
    "sameParentDirectForward" | "sameParentDirectBackward" |
    "sameParent" |
    "sameHyperParentDirectForward" | "sameHyperParentDirectBackward" |
    "sameHyperParentDirectForwardBetweenAnchors" | "sameHyperParentDirectBackwardBetweenAnchors" |
    "differentParent" |

    "circleArcForward" | "circleArcBackward" |

    "unknown";


export class FlexConnection extends CombinedPathSegment {

    type: FlexConnectionType = "unknown";

    flexNode: FlexNode;

    constructor(connection: LayoutConnection, flexNode: FlexNode) {
        super(connection);
        connection.pathSegment = this;

        this.flexNode = flexNode;

        const source = connection.source;
        const target = connection.target;

        if (source.parent === target.parent) {
            if (this.source.isDirectPredecessorInSortingTo(this.target)) {
                this.type = "circleArcForward";
            } else if (this.source.isDirectSuccessorInSortingTo(this.target)) {
                this.type = "circleArcBackward";
            } else {
                this.type = "sameParent"
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
                    this.type = "circleArcForward";
                } else if (firstChildContainingSource?.isDirectSuccessorInSortingTo(firstChildContainingTarget)) {
                    this.type = "circleArcBackward";
                }
            }

            if (this.type == "unknown") {
                this.type = "differentParent";
            }
        }
    }
}




export type FlexConnectionsOfNode = {
    circleArcForward: FlexConnection[],
    circleArcBackward: FlexConnection[],

    // outDirectForward: FlexConnection[],
    // outDirectBackward: FlexConnection[],
    // outDirect: FlexConnection[],
    // out: FlexConnection[],

    // inDirectForward: FlexConnection[],
    // inDirectBackward: FlexConnection[],
    // inDirect: FlexConnection[],
    // in: FlexConnection[],

}

export class FlexNode {

    layoutNode: LayoutNode;

    connections: FlexConnection[] = [];

    outConnections: FlexConnection[] = [];
    inConnections: FlexConnection[] = [];

    constructor(layoutNode: LayoutNode) {
        this.layoutNode = layoutNode;

        layoutNode.outConnections.forEach(connection => {
            this.addConnection(connection);
        });

        layoutNode.inConnections.forEach(connection => {
            this.addConnection(connection);
        });
    }

    addConnection(layoutConnection: LayoutConnection) {
        const connection = new FlexConnection(layoutConnection, this);
        this.connections.push(connection);
        if (connection.source === this.layoutNode) {
            this.outConnections.push(connection);
        } else {
            this.inConnections.push(connection);
        }
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

}

export class FlexConnectionLayouter extends BaseNodeConnectionLayouter {

    connections: FlexConnection[] = [];

    mapLayoutNodeToFlexNode: Map<LayoutNode, FlexNode> = new Map();


    override layoutConnectionsOfNode(node: LayoutNode): void {
        this.mapLayoutNodeToFlexNode.set(node, this.mapLayoutNodeToFlexNode.get(node) ?? new FlexNode(node));
    }

    override layoutConnectionsOfRootNode(root: LayoutNode): void {

        console.log("[FLEX]", this.connections.length, this.connections, this)
        const visGraph = root.visGraph;

        visGraph.allLayoutNodes.forEach(node => {
            const flexNode = this.mapLayoutNodeToFlexNode.get(node);

            if (!flexNode) {
                console.error("No flex node for node", node);
                return;
            }

            // Do circle connections where possible
            // This is mostly for the direct connections between consecutive nodes on a circle
            flexNode.circleArcConnections.forEach(connection => {
                connection.segments = [new DirectCircleArcConnection(connection)];
            })


        });

    }

}
