/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export class LayoutGraphNode<NodeType = any> {
    id: string
    x: number
    y: number
    vx: number
    vy: number
    fx: number | undefined
    fy: number | undefined

    data?: NodeType

    constructor(id: string, data?: NodeType, x: number = 0, y: number = 0) {
        this.id = id
        this.x = x
        this.y = y
        this.vx = 0
        this.vy = 0
        this.fx = undefined
        this.fy = undefined
        this.data = data
    }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export class LayoutGraphLink<LinkType = any> {
    source: LayoutGraphNode
    target: LayoutGraphNode
    data?: LinkType

    constructor(source: LayoutGraphNode, target: LayoutGraphNode, data?: LinkType) {
        this.source = source
        this.target = target
        this.data = data
    }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export class LayoutGraph<NodeType = any, LinkType = any> {
    nodes: LayoutGraphNode<NodeType>[]
    links: LayoutGraphLink<LinkType>[]

    constructor(nodes: LayoutGraphNode<NodeType>[], links: LayoutGraphLink<LinkType>[]) {
        this.nodes = nodes
        this.links = links
    }
}