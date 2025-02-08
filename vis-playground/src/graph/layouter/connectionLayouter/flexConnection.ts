import { CombinedPathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialCircularArcConnectionLayouter } from "./radialConnections";
import { Circle, Vector } from "2d-geometry";
import { Anchor, EllipticArc } from "src/graph/graphical";


export type FlexConnectionParentType = "sameParent" | "differentParent";

export type FlexConnectionType =
    "sameParentDirectForward" | "sameParentDirectBackward" |
    "sameParent" |
    "differentParentDirectForwardFromAnchor" | "differentParentDirectBackwardFromAnchor" |
    "differentParent" |
    "unknown";


export class FlexConnection extends CombinedPathSegment {

    type: FlexConnectionType = "unknown";

    constructor(connection: LayoutConnection) {
        super(connection);
        connection.pathSegment = this;

        const source = connection.source;
        const target = connection.target;

        if (source.parent === target.parent) {
            if (this.source.isDirectPredecessorInSortingTo(this.target)) {
                this.type = "sameParentDirectForward";
            } else if (this.source.isDirectSuccessorInSortingTo(this.target)) {
                this.type = "sameParentDirectBackward";
            } else {

                this.type = "sameParent"

            }
        } else {
            const commonParent = source.getCommonParent(target);
            if (source.isAnchor || target.isAnchor) {

                const firstChildContainingSource = commonParent?.getChildNodeContainingNodeAsDescendant(source);
                const firstChildContainingTarget = commonParent?.getChildNodeContainingNodeAsDescendant(target);

                if (firstChildContainingSource?.isDirectPredecessorInSortingTo(firstChildContainingTarget)) {
                    this.type = "differentParentDirectForwardFromAnchor";
                } else if (firstChildContainingSource?.isDirectSuccessorInSortingTo(firstChildContainingTarget)) {
                    this.type = "differentParentDirectBackwardFromAnchor";
                }
            }

            if (this.type == "unknown") {
                this.type = "differentParent";
            }


        }

    }


    calculate() {


        //++++ Source and Target have the same parent ++++//

        // Direct Case:
        // Source and Target are behind each other in the parent sorting



    }


    calculateConsecutive() {

    }

}




export type FlexConnectionsOfNode = {
    outDirectForward: FlexConnection[],
    outDirectBackward: FlexConnection[],
    outDirect: FlexConnection[],
    out: FlexConnection[],

    inDirectForward: FlexConnection[],
    inDirectBackward: FlexConnection[],
    inDirect: FlexConnection[],
    in: FlexConnection[],

}

export class FlexConnectionLayouter extends BaseNodeConnectionLayouter {

    connections: FlexConnection[] = [];

    mapNodeToConnections: Map<LayoutNode, FlexConnection[]> = new Map();
    mapNodeToIncomingConnections: Map<LayoutNode, FlexConnection[]> = new Map();
    mapNodeToOutgoingConnections: Map<LayoutNode, FlexConnection[]> = new Map();


    override layoutConnectionsOfNode(node: LayoutNode): void {
        node.outConnections.forEach(connection => {
            this.addConnection(connection);
        });
    }

    addConnection(connection: LayoutConnection) {
        const flex = new FlexConnection(connection)
        this.connections.push(flex);

        this.mapNodeToConnections.set(connection.source, (this.mapNodeToConnections.get(connection.source) ?? []).concat(flex));
        this.mapNodeToConnections.set(connection.target, (this.mapNodeToConnections.get(connection.target) ?? []).concat(flex));

        this.mapNodeToOutgoingConnections.set(connection.source, (this.mapNodeToOutgoingConnections.get(connection.source) ?? []).concat(flex));
        this.mapNodeToIncomingConnections.set(connection.target, (this.mapNodeToIncomingConnections.get(connection.target) ?? []).concat(flex));
    }


    getConnectionsOfNode(node: LayoutNode): FlexConnectionsOfNode {

        const outDirectForward = this.mapNodeToOutgoingConnections.get(node)?.filter(c => c.type === "sameParentDirectForward") ?? [];
        const outDirectBackward = this.mapNodeToOutgoingConnections.get(node)?.filter(c => c.type === "sameParentDirectBackward") ?? [];

        const outDirectForwardDifferentParent = this.mapNodeToOutgoingConnections.get(node)?.filter(c => c.type === "differentParentDirectForwardFromAnchor") ?? [];
        const outDirectBackwardDifferentParent = this.mapNodeToOutgoingConnections.get(node)?.filter(c => c.type === "differentParentDirectBackwardFromAnchor") ?? [];

        const outDirectSameParent = outDirectForward.concat(outDirectBackward);
        const outDirectDifferentParent = outDirectForwardDifferentParent.concat(outDirectBackwardDifferentParent);

        const outDirect = outDirectSameParent.concat(outDirectDifferentParent);

        const allOut = this.mapNodeToOutgoingConnections.get(node) ?? [];


        const inDirectForward = this.mapNodeToIncomingConnections.get(node)?.filter(c => c.type === "sameParentDirectForward") ?? [];
        const inDirectBackward = this.mapNodeToIncomingConnections.get(node)?.filter(c => c.type === "sameParentDirectBackward") ?? [];

        const inDirectForwardDifferentParent = this.mapNodeToIncomingConnections.get(node)?.filter(c => c.type === "differentParentDirectForwardFromAnchor") ?? [];
        const inDirectBackwardDifferentParent = this.mapNodeToIncomingConnections.get(node)?.filter(c => c.type === "differentParentDirectBackwardFromAnchor") ?? [];

        const inDirectSameParent = inDirectForward.concat(inDirectBackward);
        const inDirectDifferentParent = inDirectForwardDifferentParent.concat(inDirectBackwardDifferentParent);

        const inDirect = inDirectSameParent.concat(inDirectDifferentParent);

        const allIn = this.mapNodeToIncomingConnections.get(node) ?? [];


        return {
            outDirectForward,
            outDirectBackward,
            outDirect,
            out: allOut,

            inDirectForward,
            inDirectBackward,
            inDirect,
            in: allIn
        }

    }


    override layoutConnectionsOfRootNode(root: LayoutNode): void {

        console.log("[FLEX]", this.connections.length, this.connections, this)
        const visGraph = root.visGraph;

        visGraph.allLayoutNodes.forEach(node => {


            const flexConnections = this.getConnectionsOfNode(node);
            // console.log("[FLEX]", node.id, flexConnections);

            flexConnections.outDirect.forEach(connection => {
                this.calculatedDirectConnection(connection, true);
            })


        });

    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Connection Layouter Methods
    ////////////////////////////////////////////////////////////////////////////


    calculatedDirectConnection(connection: FlexConnection, hasCounterConnection: boolean = true) {
        const source = connection.source;
        const target = connection.target;
        // const parent = source.parent;
        const parent = source.getCommonParent(target);

        const hyperSource = parent?.getChildNodeContainingNodeAsDescendant(source);
        const hyperTarget = parent?.getChildNodeContainingNodeAsDescendant(target);

        const arcSourceCircle = hyperSource?.outerCircle;
        const arcTargetCircle = hyperTarget?.outerCircle;

        let segmentCircle = parent?.innerCircle.clone();

        if (!segmentCircle || !arcSourceCircle || !arcTargetCircle) {
            console.error("No segment circle for connection", connection, arcSourceCircle, arcTargetCircle);
            return;
        };

        const isForward = connection.type == "sameParentDirectForward" || connection.type == "differentParentDirectForwardFromAnchor";
        const direction = isForward ? "clockwise" : "counter-clockwise";

        // If there is a counter connection, adapt the radius of the segment circles so that the counter connection is not too close
        if (hasCounterConnection) {
            if (isForward) {
                segmentCircle.r += 0.1 * Math.min(arcSourceCircle.r, arcTargetCircle.r);
            } else {
                segmentCircle.r -= 0.2 * Math.min(arcSourceCircle.r, arcTargetCircle.r);
            }
        }

        // If the parent node has only two children, the circle is adapted to be larger, so that the connection is more direct
        if (parent?.children.length === 2) {
            const _centerVector = new Vector(arcSourceCircle.center, arcTargetCircle.center);
            const centerTranslationVector = isForward ? _centerVector.rotate90CW() : _centerVector.rotate90CCW();
            const newCenter = parent.center.translate(centerTranslationVector);
            const newRadius = newCenter.distanceTo(source.center)[0];
            segmentCircle = new Circle(newCenter, newRadius);
            // node.debugShapes.push(adaptedCircle);
        }

        let hyperArc: EllipticArc | undefined;

        try {
            hyperArc = RadialCircularArcConnectionLayouter.getCircularArcBetweenCircles(
                connection.connection,
                arcSourceCircle,
                arcTargetCircle,
                segmentCircle,
                direction
            )
        } catch (e) {
            // connection.source.debugShapes.push(start.outerCircle);
            // connection.source.debugShapes.push(end.outerCircle);
            // connection.source.debugShapes.push(segmentCircle);
            console.error("Error in circular arc connection layouting", {
                connection,
                source,
                target,
                segmentCircle
            })
            throw e;
        }

        if (hyperSource != source || hyperTarget != target) {

            const sourceOuter = source.getValidOuterRadRange(1);
            const targetOuter = target.getValidOuterRadRange(1);

            const sourceTangentAnchor1 = new Anchor(source.center, new Vector(sourceOuter[0]));
            const sourceTangentAnchor2 = new Anchor(source.center, new Vector(sourceOuter[1]));

            const targetTangentAnchor1 = new Anchor(target.center, new Vector(targetOuter[0]));
            const targetTangentAnchor2 = new Anchor(target.center, new Vector(targetOuter[1]));

            sourceTangentAnchor1._data = { length: 100, stroke: "red" };
            sourceTangentAnchor2._data = { length: 100, stroke: "green" };
            targetTangentAnchor1._data = { length: 100, stroke: "blue" };
            targetTangentAnchor2._data = { length: 100, stroke: "cyan" };

            source.debugShapes.push(sourceTangentAnchor1)
            source.debugShapes.push(sourceTangentAnchor2)
            target.debugShapes.push(targetTangentAnchor1)
            target.debugShapes.push(targetTangentAnchor2)
            // target.debugShapes.push(parent!.innerCircle.clone())

        }

        connection.segments = [hyperArc];


    }
}
