import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { BaseConnectionLayouter, BaseNodeConnectionLayouter } from "src/graph/visGraph/layouterComponents/connectionLayouter";
import { LayoutNode } from "src/graph/visGraph/layoutNode";


// export class BasicConnectionCombiner extends BaseNodeConnectionLayouter {

//     override layoutConnectionsOfNode(node: LayoutNode): void {
//         // This layouter combines the start and end point of a connection
//         node.outConnections.forEach((connection) => {
//             connection.points = connection.combinedPoints;
//             connection.finishedLayouting = true;
//         })
//     }
// }