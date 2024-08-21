import { CommunicationChannel, CommunicationGraph, CommunicationNode } from "../commGraph";



export class Clusterer {

    constructor(public commGraph: CommunicationGraph) {

    }

    /**
     * Get the connected component of a node.
     * The connected component is the set of nodes that are reachable from the given node.
     * @param nodeId Node id or the node itself to get the connected component of. If not given, an empty array is returned.
     * @param channels The channels to consider for the connected component.
     * @returns The connected component of the node.
     */
    getConnectedComponent(nodeId?: string | CommunicationNode, channels?: CommunicationChannel[]): CommunicationNode[] {
        if (nodeId === undefined) {
            return [];
        }
        
        const node = this.commGraph.getNode(nodeId)!;
        const visited = new Set<string>();
        const queue = [node];

        while (queue.length > 0) {
            const currentNode = queue.shift()!;
            if (visited.has(currentNode.id)) {
                continue;
            }

            visited.add(currentNode.id);

            const succ = currentNode.getSuccessors(channels);
            const pred = currentNode.getPredecessors(channels);

            queue.push(...succ, ...pred);
        }

        return Array.from(visited).map(id => this.commGraph.getNode(id)!);
    }

    /**
     * Get the connected components of the graph.
     * @returns The connected components of the graph.
     */
    getConnectedComponents(): CommunicationNode[][] {
        const nodes = this.commGraph.nodes;
        const visited = new Set<string>();
        const components: CommunicationNode[][] = [];

        for (const node of nodes) {
            if (visited.has(node.id)) {
                continue;
            }
            
            const component = this.getConnectedComponent(node);
            components.push(component);
            component.forEach(node => visited.add(node.id));
        }

        return components;
    }

}

