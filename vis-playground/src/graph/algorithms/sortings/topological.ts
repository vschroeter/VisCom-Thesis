import { CommunicationChannel, CommunicationGraph, CommunicationNode } from "src/graph/commGraph";
import { Sorter } from "./sorting";
import { Clusterer } from "../clustering";
import { IdSorter } from "./simple";
import { CommonSettings } from "src/graph/layouter/settings/commonSettings";

export type TopologicalGeneration = {
    nodes: CommunicationNode[],
    generation: number
}

export class TopologicalSorter extends Sorter {

    clusterer: Clusterer

    constructor(commGraph: CommunicationGraph, commonSettings: CommonSettings) {
        super(commGraph, commonSettings);

        this.clusterer = new Clusterer(commGraph);
    }

    getTopologicalGenerations(startNode?: CommunicationNode, channels?: CommunicationChannel[], nodes?: (string | CommunicationNode)[]): TopologicalGeneration[] {
        // Get the connection component that this node belongs to or use the given nodes
        // const component = nodes ?? this.getConnectedComponent(startNode, includeServiceConnections)

        if (nodes) {
            nodes = nodes.map(node => this.commGraph.getNode(node)!) as CommunicationNode[]
        }

        const component = (nodes as CommunicationNode[]) ?? this.clusterer.getConnectedComponent(startNode, channels)

        if (component.length == 0) return []

        const mapVisitedNodeToIteration = new Map<CommunicationNode, number>()
        const nonVisitedNodes = new Set<CommunicationNode>(component)

        const mapNodeToItsParents = new Map<CommunicationNode, Set<CommunicationNode>>()
        const mapNodeToItsSiblings = new Map<CommunicationNode, Set<CommunicationNode>>()

        let currentNode: CommunicationNode | null = startNode ?? component[0]
        let currentIteration = 0

        // Repeat until all nodes are visited
        while (nonVisitedNodes.size > 0) {

            const queue: CommunicationNode[] = [currentNode].filter(node => node !== null) as CommunicationNode[]

            // Repeat until the queue is empty
            while (queue.length > 0) {
                const node = queue.shift()!
                if (mapVisitedNodeToIteration.has(node)) continue

                if (!mapNodeToItsParents.has(node)) mapNodeToItsParents.set(node, new Set<CommunicationNode>())
                if (!mapNodeToItsSiblings.has(node)) mapNodeToItsSiblings.set(node, new Set<CommunicationNode>())

                // Mark current node as visited
                mapVisitedNodeToIteration.set(node, currentIteration)
                nonVisitedNodes.delete(node)

                // Get all the successor nodes add them to the queue (filter out the same node in case a node publishes to itself)
                const successorNodes = node.getSuccessors(channels).filter(n => n != node);

                if (nodes) queue.push(...successorNodes.filter(node => nodes!.includes(node)))
                else queue.push(...successorNodes);

                // Save the parent node for each successor node if they were not visited yet
                for (const successorNode of successorNodes) {
                    if (!mapNodeToItsParents.has(successorNode)) mapNodeToItsParents.set(successorNode, new Set<CommunicationNode>())
                    if (!mapNodeToItsSiblings.has(successorNode)) mapNodeToItsSiblings.set(successorNode, new Set<CommunicationNode>())

                    // If the successor node was already visited in the same iteration  
                    if (mapVisitedNodeToIteration.has(successorNode) && mapVisitedNodeToIteration.get(successorNode) == currentIteration) {
                        // If the successor node is already a parent of the current node, we have a sibling
                        if (mapNodeToItsParents.get(node)!.has(successorNode)) {
                            // Add the sibling to the sibling map and remove it from the parent map
                            mapNodeToItsSiblings.get(node)!.add(successorNode)
                            mapNodeToItsSiblings.get(successorNode)!.add(node)
                            mapNodeToItsParents.get(successorNode)!.delete(node)
                            mapNodeToItsParents.get(node)!.delete(successorNode)
                        }
                        // Otherwise we have to check all ancestors of the node and check, if the successor node is also a ancestor node to avoid cycles
                        else {
                            let hasCycle = false
                            const ancestors = new Set(mapNodeToItsParents.get(node)!)
                            const checkedAncestors = new Set<CommunicationNode>()

                            // Repeat until there are no ancestors left
                            while (ancestors.size > 0) {
                                const ancestor = ancestors.values().next().value!
                                ancestors.delete(ancestor)
                                checkedAncestors.add(ancestor)

                                // If the ancestor is the current successor node, we have a cycle
                                if (ancestor == successorNode) {
                                    hasCycle = true
                                    break
                                }
                                // Add all ancestors of the ancestor to the ancestors set
                                Array.from(mapNodeToItsParents.get(ancestor)!).forEach(parent => { if (!checkedAncestors.has(parent)) ancestors.add(parent) })
                            }

                            // If there is no cycle, add the current node as parent
                            if (!hasCycle) mapNodeToItsParents.get(successorNode)!.add(node)
                        }
                    }
                    // If the successor node was not visited yet, add the current node as parent
                    else {
                        mapNodeToItsParents.get(successorNode)!.add(node)
                    }
                }
            }

            // If there is no node left, we are done
            // Get the next node that is not visited yet
            currentNode = nonVisitedNodes.size > 0 ? nonVisitedNodes.values().next().value! : null
            // Increase the iteration to set proper parents
            currentIteration++;
        }


        // From the parent and sibling map we can now create the generations
        const generationMap = new Map<CommunicationNode, number>()
        const nonAssignedNodes = new Set<CommunicationNode>(component)
        const gen0nodes: Set<CommunicationNode> = new Set<CommunicationNode>()

        const components = this.clusterer.getConnectedComponents(nodes as CommunicationNode[]);

        // Check the generation 0 nodes for each component,
        // otherwise there could be a deadlock between sibling nodes
        components.forEach(singleComponent => {
            const addedNodes = [];
            // To start we take every node that has no parents and so siblings and set the generation to 0
            // singleComponent.forEach(node => {
            //     if ((!mapNodeToItsParents.has(node) || mapNodeToItsParents.get(node)!.size == 0) && (!mapNodeToItsSiblings.has(node) || mapNodeToItsSiblings.get(node)!.size == 0)) {
            //         generationMap.set(node, 0)
            //         gen0nodes.add(node)
            //         nonAssignedNodes.delete(node)
            //         addedNodes.push(node)
            //     }
            // })
            // If there are no gen0 nodes due to sibling structures, take all nodes, that have no parents
            if (addedNodes.length == 0) {
                singleComponent.forEach(node => {
                    if (!mapNodeToItsParents.has(node) || mapNodeToItsParents.get(node)!.size == 0) {
                        generationMap.set(node, 0)
                        gen0nodes.add(node)
                        nonAssignedNodes.delete(node)
                    }
                })
            }
        });


        while (nonAssignedNodes. size > 0) {
            // Every other node gets either the maximum generation of its parents increased by one, or if there are no parents the maximum generation of its siblings
            for (const node of nonAssignedNodes.keys()) {
                if (generationMap.has(node)) continue

                const parents = mapNodeToItsParents.get(node)!
                const siblings = mapNodeToItsSiblings.get(node)!

                // If there are parents, check if every parent already have a generation
                // If so we take the maximum generation of the parents and increase it by one
                if (parents.size > 0) {
                    const allParentsHaveGeneration = Array.from(parents).every(parent => generationMap.has(parent))
                    if (!allParentsHaveGeneration) continue

                    generationMap.set(node, Math.max(...Array.from(parents).map(parent => generationMap.get(parent)!)) + 1)
                    nonAssignedNodes.delete(node)
                }
                // If there are no parents, we take the maximum generation of the siblings
                else if (siblings.size > 0) {
                    const allSiblingHaveGeneration = Array.from(siblings).every(sibling => generationMap.has(sibling))
                    if (!allSiblingHaveGeneration) continue

                    generationMap.set(node, Math.max(...Array.from(siblings).map(sibling => generationMap.get(sibling)!)))
                    nonAssignedNodes.delete(node)
                } else {
                    console.error("This should never happen")
                }
            }
        }

        // Now we can create the generation map
        const generations: Map<number, TopologicalGeneration> = new Map<number, TopologicalGeneration>()
        Array.from(generationMap.entries()).forEach(item => {
            const node = item[0]
            const genNr = item[1]
            if (!generations.has(genNr)) {
                generations.set(genNr, { nodes: new Array<CommunicationNode>(), generation: genNr })
            }
            generations.get(genNr)!.nodes.push(node)
        });

        const generationList = Array.from(generations.values()).sort((a, b) => a.generation - b.generation)

        // We can now adapt the generation map by iterating over the assignment in reverse order and 
        // increase every generation of parent nodes that dont have intermediately children.
        // Thus we have less distance between the nodes

        const adaptedGenerationMap = new Map<CommunicationNode, number>()

        // Iterate over all generations in reverse order
        for (let i = generationList.length - 1; i >= 0; i--) {
            const generation = generationList[i]
            const genNr = generation.generation
            // Iterate over all nodes of the current generation
            for (const node of generation.nodes) {
                if (!adaptedGenerationMap.has(node)) adaptedGenerationMap.set(node, genNr)

                // Get all parents of the node
                const parents = mapNodeToItsParents.get(node)
                if (!parents) continue
                for (const parent of parents) {
                    if (!adaptedGenerationMap.has(parent)) adaptedGenerationMap.set(parent, genNr - 1)
                    else adaptedGenerationMap.set(parent, Math.min(adaptedGenerationMap.get(parent)!, genNr - 1))
                }
            }
        }

        // Create the adapted generation map
        const adaptedGenerations: Map<number, TopologicalGeneration> = new Map<number, TopologicalGeneration>()
        Array.from(adaptedGenerationMap.entries()).forEach(item => {
            const node = item[0]
            const genNr = item[1]
            if (!adaptedGenerations.has(genNr)) {
                adaptedGenerations.set(genNr, { nodes: new Array<CommunicationNode>(), generation: genNr })
            }
            adaptedGenerations.get(genNr)!.nodes.push(node)
        });


        const adaptedGenerationList = Array.from(adaptedGenerations.values()).sort((a, b) => a.generation - b.generation)
        console.log("Generations", adaptedGenerationList)
        return adaptedGenerationList
    }

    override sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {

        if (this.startNodeSelectionSorter) {
            nodes = this.startNodeSelectionSorter.getSorting(nodes);
        }

        if (nodes.length == 0) return []

        const generations = this.getTopologicalGenerations(nodes[0], undefined, nodes);

        const innerSorter = this.secondarySorting ?? new IdSorter(this.commGraph, this.commonSettings);
        const sortedNodes = generations.map(gen => innerSorter.getSorting(gen.nodes)).flat()
        return sortedNodes
    }


}
