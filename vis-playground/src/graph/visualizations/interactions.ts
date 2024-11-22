import mitt from "mitt"
import { Node2d } from "../graphical"
import { VisGraph } from "../visGraph/visGraph"


interface NodeWithId {
    id: string
}

export interface MouseEvents<EventData> {
    mouseenter?: (d: EventData, e: MouseEvent) => void,
    mouseleave?: (d: EventData, e: MouseEvent) => void,
    click?: (d: EventData, e: MouseEvent) => void
}

export class UserInteractions {

    private focusedNodeId: string | undefined = undefined

    private selectedNodeIds: Set<string> = new Set()
    private hoveredNodeIds: Set<string> = new Set()


    emitter = mitt<{
        update: void
    }>();

    addSelectedNode(nodeId: string) {
        this.selectedNodeIds.add(nodeId)
        this.emitter.emit("update")
    }

    addHoveredNode(nodeId: string | string[]) {
        const nodeIds = Array.isArray(nodeId) ? nodeId : [nodeId]
        nodeIds.forEach(id => this.hoveredNodeIds.add(id))
        // console.log("Hovered nodes", this.hoveredNodeIds)
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

    removeHoveredNode(nodeId: string | string[]) {
        const nodeIds = Array.isArray(nodeId) ? nodeId : [nodeId]
        nodeIds.forEach(id => this.hoveredNodeIds.delete(id))
        this.emitter.emit("update")
    }


    isHovered(nodeId: string | NodeWithId): boolean {
        const _nodeId = (nodeId as NodeWithId).id ?? nodeId
        return this.hoveredNodeIds.has(_nodeId)
    }

    isAdjacentToHovered(nodeId: string | NodeWithId, visGraph: VisGraph): boolean {
        const _nodeId = (nodeId as NodeWithId).id ?? nodeId

        for (const hoveredNodeId of this.hoveredNodeIds) {
            const node = visGraph.getNode(hoveredNodeId);

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
        return this.focusedNodeId !== undefined
    }

    get somethingIsHovered(): boolean {
        return this.hoveredNodeIds.size > 0
    }

    get somethingIsSelected(): boolean {
        return this.selectedNodeIds.size > 0
    }


    get somethingIsSelectedOrFocusedOrHovered(): boolean {
        return this.somethingIsSelected || this.somethingIsFocused || this.somethingIsHovered
    }


}
