import mitt from "mitt"
import { Node2d } from "../graphical"


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

    addHoveredNode(nodeId: string) {
        this.hoveredNodeIds.add(nodeId)
        console.log("Hovered nodes", this.hoveredNodeIds)
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

    removeHoveredNode(nodeId: string) {
        this.hoveredNodeIds.delete(nodeId)
        this.emitter.emit("update")
    }


    isHovered(nodeId: string | Node2d): boolean {
        if (nodeId instanceof Node2d) {
            nodeId = nodeId.data?.id ?? ""
        }
        return this.hoveredNodeIds.has(nodeId)
    }

    isSelected(nodeId: string | Node2d): boolean {
        if (nodeId instanceof Node2d) {
            nodeId = nodeId.data?.id ?? ""
        }
        return this.selectedNodeIds.has(nodeId)
    }

    isFocused(nodeId: string | Node2d): boolean {
        if (nodeId instanceof Node2d) {
            nodeId = nodeId.data?.id ?? ""
        }
        return this.focusedNodeId === nodeId
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
