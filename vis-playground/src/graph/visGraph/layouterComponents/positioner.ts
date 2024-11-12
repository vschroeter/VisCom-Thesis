import { LayoutNode } from "../layoutNode";

export class BasePositioner {

    constructor() { }

    /**
     * Do the positioning of the child nodes of the given parent node
     * @param parentNode The parent node of the child nodes, that should be positioned
     */
    positionChildren(parentNode: LayoutNode) {
        // Base positioner does not do anything
    }

}
