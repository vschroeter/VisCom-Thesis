import mitt from "mitt"
import { Node2d } from "../graphical"
import { LayoutNodeOrId, VisGraph } from "../visGraph/visGraph"
import { LayoutConnection } from "../visGraph/layoutConnection"


interface NodeWithId {
    id: string
}

export interface MouseEvents<EventData> {
    mouseenter?: (d: EventData, e: MouseEvent) => void,
    mouseleave?: (d: EventData, e: MouseEvent) => void,
    click?: (d: EventData, e: MouseEvent) => void
}

export class UserInteractions {

    visGraph: VisGraph

    private focusedNodeId: string | undefined = undefined

    private selectedNodeIds: Set<string> = new Set()
    private hoveredNodeIds: Set<string> = new Set()

    private hoveredConnection: Set<LayoutConnection> = new Set()

    constructor(visGraph: VisGraph) {
        this.visGraph = visGraph
    }


    emitter = mitt<{
        update: void
    }>();

    addSelectedNode(nodeId: string) {
        this.selectedNodeIds.add(nodeId)
        this.emitter.emit("update")
    }

    addHoveredConnection(connection: LayoutConnection, addChildren = true) {
        this.hoveredConnection.add(connection)

        if (addChildren) {
            connection.children.forEach(child => this.hoveredConnection.add(child))
        }

        console.log("Hovered connections", Array.from(this.hoveredConnection))

        this.emitter.emit("update")
    }

    removeHoveredConnection(connection: LayoutConnection, removeChildren = true) {
        this.hoveredConnection.delete(connection)

        if (removeChildren) {
            connection.children.forEach(child => this.hoveredConnection.delete(child))
        }
        this.emitter.emit("update")
    }

    addHoveredNode(nodeId: LayoutNodeOrId | LayoutNodeOrId[], addDescendants = true) {

        const nodeIds = Array.isArray(nodeId) ? nodeId : [nodeId]
        const nodes = nodeIds.map(id => this.visGraph.getNode(id))

        if (nodes.length > 0) {
            // console.log(nodes[0].center)
        }

        nodes.forEach(node => this.hoveredNodeIds.add(node.id))

        if (addDescendants) {
            nodes.forEach(node => {
                node.descendants.forEach(descendant => this.hoveredNodeIds.add(descendant.id))
            })
        }

        nodes.forEach(node => {
            if (node.splitParent) {
                this.hoveredNodeIds.add(node.splitParent.id)
                node.splitParent.splitChildren.map(child => child.id).forEach(id => this.hoveredNodeIds.add(id))
            }

            if (node.splitChildren.length > 0) {
                node.splitChildren.map(child => child.id).forEach(id => this.hoveredNodeIds.add(id))
            }

            if (node.isVirtual) {
                this.hoveredNodeIds.add(node.virtualParent!.id)
            }

        });

        console.log("Hovered nodes", (Array.from(this.hoveredNodeIds)).map(id => this.visGraph.getNode(id)))
        this.emitter.emit("update")
    }

    setFocusedNode(nodeId?: string) {
        this.focusedNodeId = nodeId
        this.emitter.emit("update")
    }

    clearSelectedNodes() {
        this.selectedNodeIds.clear()
        this.emitter.emit("update")
    }

    clearHoveredNodes() {
        this.hoveredNodeIds.clear()
        this.emitter.emit("update")
    }

    clearFocusedNode() {
        this.focusedNodeId = undefined
        this.emitter.emit("update")
    }

    removeSelectedNode(nodeId: string) {
        this.selectedNodeIds.delete(nodeId)
        this.emitter.emit("update")
    }

    removeHoveredNode(nodeId: LayoutNodeOrId | LayoutNodeOrId[], removeDescendants = true) {
        const nodeIds = Array.isArray(nodeId) ? nodeId : [nodeId]
        const nodes = nodeIds.map(id => this.visGraph.getNode(id))

        nodes.forEach(node => this.hoveredNodeIds.delete(node.id))

        if (removeDescendants) {
            nodes.forEach(node => {
                node.descendants.forEach(descendant => this.hoveredNodeIds.delete(descendant.id))
            })
        }

        nodes.forEach(node => {
            if (node.splitParent) {
                this.hoveredNodeIds.delete(node.splitParent.id)
                node.splitParent.splitChildren.map(child => child.id).forEach(id => this.hoveredNodeIds.delete(id))
            }

            if (node.splitChildren.length > 0) {
                node.splitChildren.map(child => child.id).forEach(id => this.hoveredNodeIds.delete(id))
            }

            if (node.isVirtual) {
                this.hoveredNodeIds.delete(node.virtualParent!.id)
            }
        });


        this.emitter.emit("update")
    }

    isHovered(connection: LayoutConnection): boolean;
    isHovered(nodeId: string | NodeWithId): boolean;
    isHovered(connectionOrNode: LayoutConnection | string | NodeWithId): boolean {

        if (connectionOrNode instanceof LayoutConnection) {
            return this.hoveredConnection.has(connectionOrNode)
        }

        const _nodeId = (connectionOrNode as NodeWithId).id ?? connectionOrNode

        if (this.hoveredNodeIds.size > 0) {
            return this.hoveredNodeIds.has(_nodeId)
        }

        return false
    }

    isAdjacentToHovered(nodeId: string | NodeWithId): boolean {
        const _nodeId = (nodeId as NodeWithId).id ?? nodeId

        for (const hoveredNodeId of this.hoveredNodeIds) {
            const node = this.visGraph.getNode(hoveredNodeId);

            for (const successor of node.getSuccessors()) {
                if (successor.id === _nodeId) {
                    return true
                }
            }

            for (const predecessor of node.getPredecessors()) {
                if (predecessor.id === _nodeId) {
                    return true
                }
            }
        }

        if (this.hoveredConnection.size > 0) {
            for (const connection of this.hoveredConnection) {
                if (connection.source.id === _nodeId || connection.target.id === _nodeId) {
                    return true
                }
            }
        }

        return false
    }

    isSelected(nodeId: string | NodeWithId): boolean {
        const _nodeId = (nodeId as NodeWithId).id ?? nodeId
        return this.selectedNodeIds.has(_nodeId)
    }

    isFocused(nodeId: string | NodeWithId): boolean {
        const _nodeId = (nodeId as NodeWithId).id ?? nodeId
        return this.focusedNodeId === _nodeId
    }


    get currentFocusedNode(): string | undefined {
        return this.focusedNodeId
    }

    get currentSelectedNodes(): Set<string> {
        return this.selectedNodeIds
    }

    get currentHoveredNodes(): Set<string> {
        return this.hoveredNodeIds
    }

    get somethingIsFocused(): boolean {
        return this.focusedNodeId !== undefined && this.focusedNodeId !== null
    }

    get somethingIsHovered(): boolean {
        return this.hoveredNodeIds.size > 0 || this.hoveredConnection.size > 0
    }

    get somethingIsSelected(): boolean {
        return this.selectedNodeIds.size > 0 || this.hoveredConnection.size > 0
    }


    get somethingIsSelectedOrFocusedOrHovered(): boolean {
        return this.somethingIsSelected || this.somethingIsFocused || this.somethingIsHovered
    }


}
