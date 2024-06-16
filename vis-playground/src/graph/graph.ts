
// import createGraph, { Graph } from 'ngraph.graph';

// function parseGraphData(
//     { jsonString,
//         nodes = 'nodes',
//         links = 'links',
//         nodeID = 'id',
//         linkFrom = 'source',
//         linkTo = 'target',
//         nodeData = 'data',
//         linkData = 'data'
//     }: {
//         jsonString: string,
//         nodes?: string,
//         links?: string,
//         nodeID?: string,
//         linkFrom?: string,
//         linkTo?: string,
//         nodeData?: string,
//         linkData?: string
//     }
// ): Graph {

//     const graph = createGraph({ multigraph: true });
//     const data = JSON.parse(jsonString);

//     const dNodes = data[nodes] ?? [];
//     const dLinks = data[links] ?? [];

//     dNodes.forEach((node: any) => {
//         const dId = node[nodeID] ?? null;
//         const dData = node[nodeData] ?? null;
//         if (dId === null) {
//             throw new Error('nodeID not found in node' + JSON.stringify(node));
//         }
//         graph.addNode(dId, dData);
//     });
//     dLinks.forEach((link: any) => {
//         const dFrom = link[linkFrom] ?? null;
//         const dTo = link[linkTo] ?? null;
//         const dData = link[linkData] ?? null;
//         if (dFrom === null || dTo === null) {
//             throw new Error('linkFrom or linkTo not found in link' + JSON.stringify(link));
//         }
//         graph.addLink(dFrom, dTo, dData);
//     });
//     return graph;
// }


