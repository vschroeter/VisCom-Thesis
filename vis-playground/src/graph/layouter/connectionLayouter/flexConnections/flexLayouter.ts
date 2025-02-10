import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { FlexConnection, FlexPart } from "./flexConnection";
import { FlexNode } from "./flexNode";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

export type FlexOrLayoutNode = FlexNode | LayoutNode;

export class FlexConnectionLayouter extends BaseNodeConnectionLayouter {

    connections: FlexConnection[] = [];

    mapLayoutNodeToFlexNode: Map<LayoutNode, FlexNode> = new Map();
    mapLayoutConnectionToFlexConnection: Map<LayoutConnection, FlexConnection> = new Map();
    mapLayerToFlexParts: Map<number, FlexPart[]> = new Map();




    get flexNodes(): FlexNode[] {
        return Array.from(this.mapLayoutNodeToFlexNode.values());
    }

    getFlexNode(layoutNode: FlexOrLayoutNode): FlexNode {
        const node = layoutNode instanceof FlexNode ? layoutNode.layoutNode : layoutNode;
        if (!this.mapLayoutNodeToFlexNode.has(node)) {
            this.mapLayoutNodeToFlexNode.set(node, new FlexNode(node, this));
        }
        return this.mapLayoutNodeToFlexNode.get(node)!;
    }

    getFlexConnection(layoutConnection: LayoutConnection | FlexConnection): FlexConnection {

        const connection = layoutConnection instanceof FlexConnection ? layoutConnection.connection : layoutConnection;

        if (!this.mapLayoutConnectionToFlexConnection.has(connection)) {
            const flexConnection = new FlexConnection(connection, this);
            this.mapLayoutConnectionToFlexConnection.set(connection, flexConnection);
        }
        return this.mapLayoutConnectionToFlexConnection.get(connection)!;
    }



    override layoutConnectionsOfNode(node: LayoutNode): void {
        const flexNode = this.getFlexNode(node);
        flexNode.initConnections();

        // this.mapLayoutNodeToFlexNode.set(node, this.mapLayoutNodeToFlexNode.get(node) ?? new FlexNode(node, this));
    }

    override layoutConnectionsOfRootNode(root: LayoutNode): void {

        console.log("[FLEX]", Array.from(this.mapLayoutNodeToFlexNode.values()), this.mapLayerToFlexParts, this.connections, this)
        const visGraph = root.visGraph;


        const partLayerValues = Array.from(this.mapLayerToFlexParts.keys()).sort();
        console.log("[FLEX] partLayerValues", partLayerValues);

        partLayerValues.forEach(layer => {
            const parts = this.mapLayerToFlexParts.get(layer)!;

            parts.forEach(part => part.layout());
        })

        console.log("[FLEX] layout done", Array.from(this.mapLayoutNodeToFlexNode.values()));

        // this.flexNodes.forEach(flexNode => {
        //     const anchors = flexNode.innerContinuum.getValidRangeAnchors();
        //     flexNode.layoutNode.debugShapes.push(...anchors);
        // })

        return;


        // Fill in the references for the inConnections
        this.mapLayoutNodeToFlexNode.forEach(flexNode => {
            flexNode.outConnections.forEach(connection => {
                const targetFlexNode = this.mapLayoutNodeToFlexNode.get(connection.target);
                if (targetFlexNode) {
                    targetFlexNode.inConnections.push(connection);
                }
            })
        })


        visGraph.allLayoutNodes.forEach(node => {
            const flexNode = this.mapLayoutNodeToFlexNode.get(node);

            if (!flexNode) {
                console.error("No flex node for node", node);
                return;
            }

            flexNode.outConnections.forEach(connection => {
                connection.calculate();
            });

            // // Do circle connections where possible
            // // This is mostly for the direct connections between consecutive nodes on a circle
            // flexNode.circleArcConnections.forEach(connection => {
            //     connection.segments = [new DirectCircleArcConnection(connection)];
            // })

            // // Do smooth spline connections for connections inside the same parent
            // flexNode.sameParentConnections.forEach(connection => {
            //     connection.segments = [new InsideParentConnection(connection)];
            // });

        });

    }

}
