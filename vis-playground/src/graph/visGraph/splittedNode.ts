import { LayoutNode } from "./layoutNode";



export class SplittedLayoutNode extends LayoutNode {
    
    // The actual layout node that this node is a split of
    parentNode: LayoutNode;


    constructor(node: LayoutNode) {
        super(node.visGraph, node.visGraph.getNextFreeId(node.id));

        this.parentNode = node;
    }

    

}

