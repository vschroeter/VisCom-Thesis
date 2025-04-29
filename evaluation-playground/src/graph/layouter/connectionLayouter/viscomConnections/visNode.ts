import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { SubPath, SubPathGroup } from "./subPath";
import { ViscomConnectionLayouter } from "./viscomConnectionLayouter";
import { VisConnection } from "./visConnection";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { SubPathRange } from "./subPathRange";
import { Anchor } from "src/graph/graphical";



export class VisNode {

    ////////////////////////////////////////////////////////////////////////////
    // #region LayoutNode Props
    ////////////////////////////////////////////////////////////////////////////

    layoutNode: LayoutNode;

    get id(): string {
        return this.layoutNode.id;
    }

    get center() {
        return this.layoutNode.center;
    }

    get outerCircle() {
        return this.layoutNode.outerCircle;
    }

    get circle() {
        return this.layoutNode.circle;
    }

    get innerCircle() {
        return this.layoutNode.innerCircle;
    }

    get parent() {
        return this.layoutNode.parent;
    }

    get parentVisNode(): VisNode | undefined {
        return this.layoutNode.parent ? this.parentLayouter.getVisNode(this.layoutNode.parent) : undefined;
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Ranges
    ////////////////////////////////////////////////////////////////////////////

    innerRange: SubPathRange;
    outerRange: SubPathRange;
    circularRangeForward: SubPathRange;
    circularRangeBackward: SubPathRange;

    path2pathSubPaths: SubPath[] = [];

    circularSubPaths: SubPath[] = [];

    adaptRanges(anchor: Anchor) {
        [this.innerRange, this.outerRange].forEach(range => {
            range.trimToAnchor(anchor);
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Connection management
    ////////////////////////////////////////////////////////////////////////////

    connections: VisConnection[] = [];

    outConnections: VisConnection[] = [];
    inConnections: VisConnection[] = [];

    initConnections(includeSelfLoops: boolean = false) {
        this.connections = [];
        this.outConnections = [];
        this.inConnections = [];

        if (includeSelfLoops) {
            this.layoutNode.outConnections.forEach(connection => {
                this.addConnection(connection);
            });
            this.layoutNode.inConnections.forEach(connection => {
                this.addConnection(connection);
            });
        } else {
            this.layoutNode.outConnectionsWithoutSelfLoops.forEach(connection => {
                this.addConnection(connection);
            });
            this.layoutNode.inConnectionsWithoutSelfLoops.forEach(connection => {
                this.addConnection(connection);
            });
        }
    }

    addConnection(layoutConnection: LayoutConnection) {
        // const connection = new FlexConnection(layoutConnection, this);
        // const connection = FlexNode.createConnection(layoutConnection, this);
        const connection = this.parentLayouter.getVisConnection(layoutConnection);
        this.connections.push(connection);
        if (connection.source === this.layoutNode) {
            this.outConnections.push(connection);
        } else {
            this.inConnections.push(connection);
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Path Management
    ////////////////////////////////////////////////////////////////////////////


    /**
     * For some target nodes, a sub path might already be cached.
     */
    // cachedSubPaths: Map<VisNode, SubPath> = new Map();

    /**
     * Some subpaths share the same path segment.
     * Those shared paths are stored as SubPathGroups.
     * Holds sub-path groups for target VisNodes.
     */
    subPathGroups: Map<VisNode, SubPathGroup> = new Map();

    getSubPathGroup(targetVisNode: VisNode): SubPathGroup  {

        if (!this.subPathGroups.has(targetVisNode)) {
            this.subPathGroups.set(targetVisNode, new SubPathGroup(this, targetVisNode));
        }

        return this.subPathGroups.get(targetVisNode)!;
    }

    getSortedSubPaths(): SubPath[] {

        return [
            ...this.circularSubPaths,
            ...this.innerRange.getSortedSubPathInfo().map(info => info.subPath),
            ...this.outerRange.getSortedSubPathInfo().map(info => info.subPath),
        ]

    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Constructor
    ////////////////////////////////////////////////////////////////////////////

    parentLayouter: ViscomConnectionLayouter;

    constructor(layoutNode: LayoutNode, parentLayouter: ViscomConnectionLayouter) {
        this.layoutNode = layoutNode;
        this.parentLayouter = parentLayouter;

        this.innerRange = new SubPathRange(this, "inside");
        this.outerRange = new SubPathRange(this, "outside");
        this.circularRangeForward = new SubPathRange(this, "circleArcForward");
        this.circularRangeBackward = new SubPathRange(this, "circleArcBackward");
    }
}
