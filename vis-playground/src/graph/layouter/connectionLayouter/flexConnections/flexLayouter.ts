import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { FlexConnection, FlexPath } from "./flexConnection";
import { FlexNode } from "./flexNode";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

export type FlexOrLayoutNode = FlexNode | LayoutNode;

export class FlexConnectionLayouter extends BaseNodeConnectionLayouter {

    connections: FlexConnection[] = [];

    mapLayoutNodeToFlexNode: Map<LayoutNode, FlexNode> = new Map();
    mapLayoutConnectionToFlexConnection: Map<LayoutConnection, FlexConnection> = new Map();
    mapLayerToFlexPaths: Map<number, FlexPath[]> = new Map();




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

        console.log("[FLEX]", Array.from(this.mapLayoutNodeToFlexNode.values()), this.mapLayerToFlexPaths, this.connections, this)
        const visGraph = root.visGraph;


        const pathLayerValues = Array.from(this.mapLayerToFlexPaths.keys()).sort();
        console.log("[FLEX] pathLayerValues", pathLayerValues);

        pathLayerValues.forEach(layer => {
            const paths = this.mapLayerToFlexPaths.get(layer)!;

            paths.forEach(path => path.layout());
        })

        console.log("[FLEX] layout done", Array.from(this.mapLayoutNodeToFlexNode.values()));

        // this.flexNodes.forEach(flexNode => {
        //     const anchors = flexNode.innerContinuum.getValidRangeAnchors();
        //     flexNode.layoutNode.debugShapes.push(...anchors);
        // })

        return;

    }

}
