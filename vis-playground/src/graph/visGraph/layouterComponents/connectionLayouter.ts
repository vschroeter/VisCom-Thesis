import { LayoutConnection } from "../layoutConnection";
import { LayoutNode } from "../layoutNode";

export class BaseConnectionLayouter {
    
    /**
     * Calculate the layout of a connection.
     * @param connection The connection to layout.
     */
    layoutConnection(connection: LayoutConnection): void {
        // connection.points = [];
    }
}

export class BaseNodeConnectionLayouter {

    layoutConnectionsOfNode(node: LayoutNode): void {

    }

}