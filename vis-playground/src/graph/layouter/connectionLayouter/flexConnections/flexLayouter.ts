import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { FlexConnection } from "./flexConnection";
import { FlexNode } from "./flexNode";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";



export class FlexConnectionLayouter extends BaseNodeConnectionLayouter {

    connections: FlexConnection[] = [];

    mapLayoutNodeToFlexNode: Map<LayoutNode, FlexNode> = new Map();
    mapLayoutConnectionToFlexConnection: Map<LayoutConnection, FlexConnection> = new Map();


    getFlexNode(layoutNode: LayoutNode): FlexNode {
        if (!this.mapLayoutNodeToFlexNode.has(layoutNode)) {
            this.mapLayoutNodeToFlexNode.set(layoutNode, new FlexNode(layoutNode, this));
        }
        return this.mapLayoutNodeToFlexNode.get(layoutNode)!;
    }

    getFlexConnection(layoutConnection: LayoutConnection): FlexConnection {
        if (!this.mapLayoutConnectionToFlexConnection.has(layoutConnection)) {
            const flexConnection = new FlexConnection(layoutConnection, this);
            this.mapLayoutConnectionToFlexConnection.set(layoutConnection, flexConnection);
        }
        return this.mapLayoutConnectionToFlexConnection.get(layoutConnection)!;
    }



    override layoutConnectionsOfNode(node: LayoutNode): void {
        const flexNode = this.getFlexNode(node);
        flexNode.initConnections();

        // this.mapLayoutNodeToFlexNode.set(node, this.mapLayoutNodeToFlexNode.get(node) ?? new FlexNode(node, this));
    }

    override layoutConnectionsOfRootNode(root: LayoutNode): void {

        console.log("[FLEX]", this.connections.length, this.connections, this)
        const visGraph = root.visGraph;


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
