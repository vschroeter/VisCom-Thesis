import { BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { SubPath } from "./subPath";
import { VisConnection } from "./visConnection";
import { VisNode } from "./visNode";

export type VisOrLayoutNode = VisNode | LayoutNode;

export class ViscomConnectionLayouter extends BaseNodeConnectionLayouter {

    connections: VisConnection[] = [];

    mapLayoutNodeToVisNode: Map<LayoutNode, VisNode> = new Map();
    mapLayoutConnectionToVisConnection: Map<LayoutConnection, VisConnection> = new Map();
    // mapLayerToFlexPaths: Map<number, FlexPath[]> = new Map();

    mapLayerToSubPaths: Map<number, SubPath[]> = new Map();


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





    override layoutConnectionsOfNode(node: LayoutNode): void {
        const visNode = this.getVisNode(node);
        visNode.initConnections();

        // this.mapLayoutNodeToVisNode.set(node, this.mapLayoutNodeToVisNode.get(node) ?? new VisNode(node, this));
    }

    override layoutConnectionsOfRootNode(root: LayoutNode): void {

        this.getAllSubPaths("asc").forEach(subPaths => {
            subPaths.forEach(subPath => {
                // console.log("[LAYOUT] Layouting subPath", subPath.cId, subPath.id, subPath.level, subPath.levelType, subPath);
                subPath.layout();
            });
        });



        // console.log("[FLEX]", Array.from(this.mapLayoutNodeToVisNode.values()), this.mapLayerToFlexPaths, this.connections, this)
        // const visGraph = root.visGraph;


        // const pathLayerValues = Array.from(this.mapLayerToFlexPaths.keys()).sort();
        // console.log("[FLEX] pathLayerValues", pathLayerValues);

        // pathLayerValues.forEach(layer => {
        //     const paths = this.mapLayerToFlexPaths.get(layer)!;

        //     paths.forEach(path => path.layout());
        // })

        // console.log("[FLEX] layout done", Array.from(this.mapLayoutNodeToVisNode.values()));

        // // this.visNodes.forEach(visNode => {
        // //     const anchors = visNode.innerContinuum.getValidRangeAnchors();
        // //     visNode.layoutNode.debugShapes.push(...anchors);
        // // })

        // return;

    }

}
