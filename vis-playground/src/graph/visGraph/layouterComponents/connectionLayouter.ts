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


export type NodeConnectionLayouterHook = (node: LayoutNode) => void;


/**
 * Base class for layouting connections of a node.
 * 
 * This class provides hooks to add additional layouting steps before and after the actual layouting.
 * The layouting is done in the following order:
 * 1. Pre hooks for the node
 * 2. Layout connections of a node's children 
 * 3. Layout connections of a node
 * 4. Post hooks for the node
 */
export class BaseNodeConnectionLayouter {

    protected preHooks: NodeConnectionLayouterHook[] = [];
    protected postHooks: NodeConnectionLayouterHook[] = [];

    constructor() {

    }

    addPreHook(hook: NodeConnectionLayouterHook): void {
        this.preHooks.push(hook);
    }

    addPostHook(hook: NodeConnectionLayouterHook): void {
        this.postHooks.push(hook);
    }

    layoutConnections(node: LayoutNode): void {
        this.preHooks.forEach(hook => hook(node));
        this.layoutConnectionsOfChildren(node);
        this.layoutConnectionsOfNode(node);
        this.postHooks.forEach(hook => hook(node));
    }

    layoutConnectionsOfChildren(node: LayoutNode): void {
            
    }

    layoutConnectionsOfNode(node: LayoutNode): void {

    }

}