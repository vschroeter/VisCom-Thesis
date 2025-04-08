import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { SubPath } from "./subPath";
import { VisConnection } from "./visConnection";
import { VisNode } from "./visNode";
import { RadialUtils } from "../../utils/radialUtils";

export type VisOrLayoutNode = VisNode | LayoutNode;

export class ViscomConnectionLayouter extends BaseNodeConnectionLayouter {

    connections: VisConnection[] = [];

    mapLayoutNodeToVisNode: Map<LayoutNode, VisNode> = new Map();
    mapLayoutConnectionToVisConnection: Map<LayoutConnection, VisConnection> = new Map();
    // mapLayerToFlexPaths: Map<number, FlexPath[]> = new Map();

    mapLayerToSubPaths: Map<number, SubPath[]> = new Map();

    optimizeConnectionAnchors: boolean = true;
    minimumRangeSizeFactor: number = 0.4;
    rangePaddingFactor: number = 0.1;
    combinedPathsDistanceFactor: number = 0.2;
    combineCounterPaths: boolean = true;

    useHierarchicalSubPaths: boolean = true;

    useHyperEdges: boolean = false;

    constructor(options?: {
        optimizeConnectionAnchors?: boolean,
        minimumRangeSizeFactor?: number,
        rangePaddingFactor?: number,
        combinedPathsDistanceFactor?: number,
        combinePaths?: boolean,
        useHierarchicalSubPaths?: boolean,
        useHyperEdges?: boolean
    }) {
        super();
        this.optimizeConnectionAnchors = options?.optimizeConnectionAnchors ?? true;
        this.minimumRangeSizeFactor = options?.minimumRangeSizeFactor ?? 0.4;
        this.rangePaddingFactor = options?.rangePaddingFactor ?? 0.1;
        this.combinedPathsDistanceFactor = options?.combinedPathsDistanceFactor ?? 0.2;
        this.combineCounterPaths = options?.combinePaths ?? true;
        this.useHierarchicalSubPaths = options?.useHierarchicalSubPaths ?? true;
        this.useHyperEdges = options?.useHyperEdges ?? false;

        if (!this.useHierarchicalSubPaths) {
            this.useHyperEdges = false;
        }

    }

    get visNodes(): VisNode[] {
        return Array.from(this.mapLayoutNodeToVisNode.values());
    }

    getVisNode(layoutNode: VisOrLayoutNode): VisNode {
        const node = layoutNode instanceof VisNode ? layoutNode.layoutNode : layoutNode;
        if (!this.mapLayoutNodeToVisNode.has(node)) {
            this.mapLayoutNodeToVisNode.set(node, new VisNode(node, this));
        }
        return this.mapLayoutNodeToVisNode.get(node)!;
    }

    getVisConnection(layoutConnection: LayoutConnection | VisConnection): VisConnection {

        const connection = layoutConnection instanceof VisConnection ? layoutConnection.connection : layoutConnection;

        if (!this.mapLayoutConnectionToVisConnection.has(connection)) {
            const visConnection = new VisConnection(connection, this);
            this.mapLayoutConnectionToVisConnection.set(connection, visConnection);
        }
        return this.mapLayoutConnectionToVisConnection.get(connection)!;
    }


    ////////////////////////////////////////////////////////////////////////////
    // #region Sub Path Management
    ////////////////////////////////////////////////////////////////////////////

    addPathToLayouter(subPath: SubPath) {
        if (!this.mapLayerToSubPaths.has(subPath.level)) {
            this.mapLayerToSubPaths.set(subPath.level, []);
        }
        this.mapLayerToSubPaths.get(subPath.level)!.push(subPath);
    }

    getSubPathsOfLayer(layer: number): SubPath[] {
        const paths = this.mapLayerToSubPaths.get(layer) ?? [];
        return paths.sort((a, b) => a.levelType === "sameLevel" ? -1 : 1);
    }

    getAllSubPaths(order: "desc" | "asc" = "asc"): SubPath[][] {
        const layerNumbers = Array.from(this.mapLayerToSubPaths.keys()).sort();
        const allPaths: SubPath[][] = [];
        layerNumbers.forEach(layerNumber => {
            allPaths.push(this.getSubPathsOfLayer(layerNumber));
        });

        return order === "asc" ? allPaths : allPaths.reverse();
    }

    getAllVisNodes(order: "desc" | "asc" = "asc"): VisNode[] {
        const nodes = this.visNodes.slice().sort((a, b) => a.layoutNode.layerFromTop - b.layoutNode.layerFromTop);
        return order === "asc" ? nodes : nodes.reverse();
    }




    override layoutConnectionsOfNode(node: LayoutNode): void {
        const visNode = this.getVisNode(node);
        visNode.initConnections();

        // this.mapLayoutNodeToVisNode.set(node, this.mapLayoutNodeToVisNode.get(node) ?? new VisNode(node, this));
    }

    override layoutConnectionsOfRootNode(root: LayoutNode): void {

        const sortedNodes = this.getAllVisNodes("asc");
        console.log("[VISCOM] sortedNodes", sortedNodes.map(node => node.layoutNode.id + " " + node.layoutNode.layerFromTop));

        sortedNodes.forEach(visNode => {
            const circularSubPathInfos = visNode.circularRangeForward.getSortedSubPathInfo();
            circularSubPathInfos.forEach(subPathInfo => {
                const subPath = subPathInfo.subPath;
                // console.log("[VISCOM] subPath", subPath.cId, subPath.level);
                subPath.layout();
            });
        });

        sortedNodes.forEach(visNode => {
            const innerSubPathInfos = visNode.innerRange.getSortedSubPathInfo();
            innerSubPathInfos.forEach(subPathInfo => {
                const subPath = subPathInfo.subPath;
                // console.log("[VISCOM] subPath", subPath.cId, subPath.level);
                subPath.layout();
            });

        })

        sortedNodes.forEach(visNode => {
            const outerSubPathInfos = visNode.outerRange.getSortedSubPathInfo();
            outerSubPathInfos.forEach(subPathInfo => {
                const subPath = subPathInfo.subPath;
                // console.log("[VISCOM] subPath", subPath.cId, subPath.level);
                subPath.layout();
            });
        })

        sortedNodes.forEach(visNode => {

            // visNode.layoutNode.debugShapes.push(visNode.layoutNode.innerEnclosingCircle);
            // visNode.layoutNode.debugShapes.push(visNode.layoutNode.innerEnclosingCircle.center);
            // visNode.layoutNode.debugShapes.push(visNode.layoutNode.innerCircle.center);
            // visNode.layoutNode.debugShapes.push(visNode.layoutNode.innerCircle);

            visNode.path2pathSubPaths.forEach(subPath => {
                // console.log("[VISCOM] subPath", subPath.cId, subPath.level);
                subPath.layout();
            });
        })


        // root.debugShapes.push(root.innerCircle);

        return;
        sortedNodes.forEach(visNode => {

            if (visNode.id != "M") return;

            const node = visNode.layoutNode;
            const nextNode = node.getNextNodeInSorting();
            const previousNode = node.getPreviousNodeInSorting();

            if (nextNode && previousNode) {
                const nextTangents = RadialUtils.getTangentsFromPointToCircle(node.center, nextNode!.circle);
                const prevTangents = RadialUtils.getTangentsFromPointToCircle(node.center, previousNode!.circle);
                // node.debugShapes.push(...nextTangents, ...prevTangents, nextNode!.circle, previousNode!.circle, node.center);
                node.debugShapes.push(...nextTangents, ...prevTangents);
            }

            const f = 0.9;
            const anchorOutStart = visNode.outerRange.getValidAnchorsOfRange(visNode.layoutNode.getValidOuterRadRange(f)).startAnchor;
            const anchorOutEnd = visNode.outerRange.getValidAnchorsOfRange(visNode.layoutNode.getValidOuterRadRange(f)).endAnchor;
            const anchorInStart = visNode.innerRange.getValidAnchorsOfRange(visNode.layoutNode.getValidInnerRadRange(f)).startAnchor;
            const anchorInEnd = visNode.innerRange.getValidAnchorsOfRange(visNode.layoutNode.getValidInnerRadRange(f)).endAnchor;

            anchorOutStart._data!.stroke = "cyan";
            anchorOutEnd._data!.stroke = "magenta";
            anchorInStart._data!.stroke = "green";
            anchorInEnd._data!.stroke = "red";

            const o = 0.7;
            anchorOutStart._data!.opacity = o;
            anchorOutEnd._data!.opacity = o;
            anchorInStart._data!.opacity = o;
            anchorInEnd._data!.opacity = o;



            visNode.layoutNode.debugShapes.push(anchorOutStart, anchorOutEnd, anchorInStart, anchorInEnd);
        })


    }

}
