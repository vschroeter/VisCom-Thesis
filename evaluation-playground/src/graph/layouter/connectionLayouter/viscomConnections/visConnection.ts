import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { SubPath } from "./subPath";
import { VisNode } from "./visNode";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { ViscomConnectionLayouter } from "./viscomConnectionLayouter";
import { CombinedPathSegment } from "src/graph/graphical/primitives/pathSegments/PathSegment";


export class VisConnection extends CombinedPathSegment {

    /**
     * The node path of the connection.
     * If the connection is from s to t, there can be multiple other nodes in between.
     * When connection is via hypernodes, the node path represents them, e.g.
     * s -> h1 -> h2 -> t
     **/
    nodePath: VisNode[] = [];

    subPaths: SubPath[] = [];

    layouter: ViscomConnectionLayouter;

    visNodeSource: VisNode;
    visNodeTarget: VisNode;

    constructor(connection: LayoutConnection, layouter: ViscomConnectionLayouter) {
        super(connection);
        this.layouter = layouter;
        this.visNodeSource = layouter.getVisNode(connection.source);
        this.visNodeTarget = layouter.getVisNode(connection.target);

        this.connection.pathSegment = this;
        this.initSubPaths();
    }

    initSubPaths() {
        const connPath = this.connection.getConnectionPathViaHyperAndVirtualNodes()
        const visNodePath = connPath.map(node => this.layouter.getVisNode(node));
        this.nodePath = visNodePath;
        const nodePathIds = connPath.map(node => node.id).join(" -> ")

        this.subPaths = VisConnection.createSubPathsFromNodePath(connPath, this);
        this.segments = this.subPaths.map(path => path);
    }

    ////////////////////////////////////////////////////////////////////////////
    // #region Sub Path Creation
    ////////////////////////////////////////////////////////////////////////////

    static createSubPathsFromNodePath(visNodePath: LayoutNode[], visConnection: VisConnection): SubPath[] {

        const subPaths: SubPath[] = [];

        let previousSubPath: SubPath | undefined = undefined;

        const useHierarchicalSubPaths = visConnection.layouter.useHierarchicalSubPaths;

        for (let i = 0; i < visNodePath.length - 1; i++) {
            // i is always the start node
            const sNode = visNodePath[i];

            let path2path: SubPath | undefined = undefined;

            // If there is a virtual node, add a path2path subpath
            if (sNode.isVirtual) {

                if (!previousSubPath) {
                    console.error("Path2path without previous subpath", sNode, visNodePath);
                } else {
                    path2path = new SubPath({
                        visConnection,
                        startNode: sNode,
                        endNode: sNode,
                        nodePath: [sNode],
                        previousSubPath
                    });
                    subPaths.push(path2path); // Add to paths
                }
                // previousSubPath = path;
            }

            // the end node t is the next node, that either:
            // t has the same parent as s --> then it is a same-level connection
            // OR
            // t is the node before t1, with t and t1 having same parent
            let j = i + 1;
            let tNode = visNodePath[j];

            if (useHierarchicalSubPaths) {
                while (tNode.parent != sNode.parent) {
                    const nextNode = visNodePath[j + 1];
                    if (!nextNode || nextNode.parent == tNode.parent) {
                        break;
                    }
                    tNode = nextNode;
                    j++;
                }
            }
            // If we do not use hierarchical subpaths, we just take the next non-hypernode node
            else {
                while (!sNode.isHyperNode && tNode.isHyperNode) {
                    j++;
                    tNode = visNodePath[j];

                    if (!tNode) {
                        console.error("No next node found", sNode, visNodePath);
                        break;
                    }
                }
            }


            //
            if (sNode.parent == tNode.parent) {
                // Inside parent connection
                const path: SubPath = new SubPath({
                    visConnection,
                    startNode: sNode,
                    endNode: tNode,
                    nodePath: visNodePath.slice(i, j + 1),
                    previousSubPath
                });

                subPaths.push(path); // Add to paths
                previousSubPath = path;
            } else {

                const path: SubPath = new SubPath({
                    visConnection,
                    startNode: sNode,
                    endNode: tNode,
                    nodePath: visNodePath.slice(i, j + 1),
                    previousSubPath,
                    // constraints: visNodePath.slice(i, j + 1),
                });

                subPaths.push(path);
                previousSubPath = path;
            }

            i = j - 1;
            // i = j;
            if (path2path) {
                path2path.nextSubPath = previousSubPath;
            }
        }


        return subPaths;
    }


}

