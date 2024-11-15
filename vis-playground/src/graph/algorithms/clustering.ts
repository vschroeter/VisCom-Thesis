import { CommunicationChannel, CommunicationGraph, CommunicationNode } from "../commGraph";
import { VisGraph } from "../visGraph/visGraph";
import { LayoutNode } from "../visGraph/layoutNode";



export class Clusterer {

    constructor(public visGraph: VisGraph) {

    }

    /**
     * Get the connected component of a node.
     * The connected component is the set of nodes that are reachable from the given node.
     * @param nodeId Node id or the node itself to get the connected component of. If not given, an empty array is returned.
     * @param channels The channels to consider for the connected component.
     * @returns The connected component of the node.
     */
    getConnectedComponent(nodeId?: string | LayoutNode, channels?: CommunicationChannel[], nodes?: (string | LayoutNode)[]): LayoutNode[] {
        if (nodeId === undefined) {
            return [];
        }

        const node = this.visGraph.getNode(nodeId)!;

        const relevantNodeIds = new Set((nodes?.map(node => this.visGraph.getNode(node)!) ?? this.visGraph.allLayoutNodes).map(node => node.id));

        const visited = new Set<string>();
        const queue = [node];

        while (queue.length > 0) {
            const currentNode = queue.shift()!;
            if (visited.has(currentNode.id)) {
                continue;
            }

            if (!relevantNodeIds.has(currentNode.id)) {
                continue;
            }

            visited.add(currentNode.id);

            const succ = currentNode.getSuccessors(channels);
            const pred = currentNode.getPredecessors(channels);

            queue.push(...succ, ...pred);
        }

        return Array.from(visited).map(id => this.visGraph.getNode(id)!);
    }

    /**
     * Get the connected components of the graph.
     * @returns The connected components of the graph.
     */
    getConnectedComponents(nodes?: LayoutNode[], channels?: CommunicationChannel[]): LayoutNode[][] {
        nodes = nodes ?? this.visGraph.allLayoutNodes;
        const visited = new Set<string>();
        const components: LayoutNode[][] = [];

        for (const node of nodes) {
            if (visited.has(node.id)) {
                continue;
            }

            const component = this.getConnectedComponent(node, channels, nodes);
            components.push(component);
            component.forEach(node => visited.add(node.id));
        }

        return components;
    }

}

