import { CommunicationChannel, CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { Sorter } from "./sorting";
import { Clusterer } from "../clustering";
import { IdSorter } from "./simple";
import { TopologicalSorter } from "./topological";

export type TopologicalGeneration = {
    nodes: CommunicationNode[],
    generation: number
}

export class CommFlowSorter extends Sorter {

    clusterer: Clusterer
    topoligicalSorter: TopologicalSorter

    constructor(commGraph: CommunicationGraph) {
        super(commGraph);

        this.clusterer = new Clusterer(commGraph);
        this.topoligicalSorter = new TopologicalSorter(commGraph);
    }

    getWeightedTopologicalGenerations(nodes?: CommunicationNode[], channels?: CommunicationChannel[]): TopologicalGeneration[] {
        // Get the connection component that this node belongs to or use the given nodes
        // const component = nodes ?? this.getConnectedComponent(startNode, includeServiceConnections)

        const allGenerations = new Array<TopologicalGeneration>()

        if (nodes) {
            nodes = nodes.map(node => this.commGraph.getNode(node)!) as CommunicationNode[]
        }

        const components = this.clusterer.getConnectedComponents(nodes, channels)

        if (components.length == 0) return []

        components.forEach(component => {
            const mapVisitedNodeToIteration = new Map<CommunicationNode, number>()
            const nonVisitedNodes = new Set<CommunicationNode>(component)

            const mapNodeToItsParents = new Map<CommunicationNode, Set<CommunicationNode>>()
            const mapNodeToItsAncestors = new Map<CommunicationNode, Set<CommunicationNode>>()
            const mapNodeToItsChildren = new Map<CommunicationNode, Set<CommunicationNode>>()

            const mapNodeToItsSiblings = new Map<CommunicationNode, Set<CommunicationNode>>()

            // Get all merged connections and sort them by their weight
            const allLinks = this.commGraph.getAllLinksOfNodes(component, channels)
            const mergedLinks = CommunicationLink.mergeLinks(allLinks)

            // TODO: ist es schlimm, dass hier Broadcast Connections mit denselben Gewichten komplett rausgefiltert werden?
            const combinedLinks = CommunicationLink.combineInAndOutLinks(allLinks);

            console.log("All links", allLinks);
            console.log("Merged links", mergedLinks);
            console.log("Combined links", combinedLinks);

            // Sort links by weight in descending order
            const sortedLinks = combinedLinks.sort((a, b) => b.weight - a.weight)

            console.log("Sorted links", sortedLinks);

            // We now pop each link and store the parent relationships.
            while (sortedLinks.length > 0) {
                const link = sortedLinks.shift()!;

                const fromNode = link.fromNode
                const toNode = link.toNode

                if (!mapNodeToItsParents.has(toNode)) mapNodeToItsParents.set(toNode, new Set<CommunicationNode>())
                if (!mapNodeToItsAncestors.has(toNode)) mapNodeToItsAncestors.set(toNode, new Set<CommunicationNode>())
                if (!mapNodeToItsChildren.has(fromNode)) mapNodeToItsChildren.set(fromNode, new Set<CommunicationNode>())

                // We have to check, if the toNode is already an ancestor of the fromNode.
                // In this case we have a cycle. This cycle gets ignored.
                // Because we are iterating over the links in descending weight order, we make sure that cycles are ignored at the weakest links.
                const toNodeIsAncestor = mapNodeToItsAncestors.has(fromNode) && mapNodeToItsAncestors.get(fromNode)!.has(toNode)
                if (toNodeIsAncestor) continue;
                
                mapNodeToItsParents.get(toNode)!.add(fromNode)
                mapNodeToItsChildren.get(fromNode)!.add(toNode)

                // Store the ancestors of the toNode               
                // Add the parent and all ancestors of the parent to the ancestors of the toNode
                mapNodeToItsAncestors.get(toNode)!.add(fromNode)
                if (mapNodeToItsAncestors.has(fromNode)) {
                    const existingAncestors = mapNodeToItsAncestors.get(fromNode)!
                    existingAncestors.forEach(ancestor => mapNodeToItsAncestors.get(toNode)!.add(ancestor))
                }
                
                // Update the ancestors of the fromNode's children
                function updateChildren(node: CommunicationNode) {
                    if (!mapNodeToItsChildren.has(node)) return
                    mapNodeToItsChildren.get(node)!.forEach(child => {
                        if (!mapNodeToItsAncestors.has(child)) mapNodeToItsAncestors.set(child, new Set<CommunicationNode>())
                        mapNodeToItsAncestors.get(child)!.add(node)
                        updateChildren(child)
                    })
                }

                updateChildren(toNode)
                

            }


            return;

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

            // const components = this.clusterer.getConnectedComponents(nodes as CommunicationNode[]);

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


            while (nonAssignedNodes.size > 0) {
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


            const adaptedGenerationList = Array.from(adaptedGenerations.values())
            console.log("Generations", adaptedGenerationList)
            allGenerations.push(...adaptedGenerationList)
            // return adaptedGenerationList
        })

        allGenerations.sort((a, b) => a.generation - b.generation) 
        return allGenerations
    }

    protected override sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {



        /**
         
         Communication flow sorting does not work like the normal flow sorting.
         Normal flow sorting was based on topological generations, which are based on parent-child & sibling relationships.
         The following problems arise:
         A) In broadcast graphs (with a lot of low weighted connections between a lot of nodes):
            - Broadcaster (or gatherer) nodes would have the heighest source score, therefore they would be the first to be sorted and afterwards obscure the actual sorting 
            - Broadcast topics between node groups would obscure the actual sorting
        
        B) In graphs with weights:
            - The weight of the connections would not be considered in the sorting at all

        After converting a comm graph to a weighted comm graph, we can make use of the weights to sort the nodes.
        (Maybe first converting the weights to a inverted distance)

        The following is done for each connected component:
        Beginning with a high ranked node (e.g. based on comm graph centrality) as start node S, we can get our comm flow sorting by:
        1.0. From S, visit nodes in a Dijkstra-like manner, based on the distances of the forward connections.
        1.1. Store the forward score (the visit index) for each node
        2.0. From S, visit nodes in a Dijkstra-like manner, based on the distances of the backward connections.
        2.1. Store the negativ backward score (the visit index) for each node

        If there are now still unvisited nodes (so nodes, that are neither directly reachable from S nor can reach S directly), 


         */

        if (this.startNodeSelectionSorter) {
            nodes = this.startNodeSelectionSorter.getSorting(nodes);
        }

        if (nodes.length == 0) return []

        const nodeIdsToInclude = new Set(nodes.map(node => node.id))

        this.topoligicalSorter.startNodeSelectionSorter = this.startNodeSelectionSorter
        this.topoligicalSorter.secondarySorting = this.secondarySorting

        // const topoGens = this.topoligicalSorter.getTopologicalGenerations(nodes[0], undefined, nodes);
        const topoGens = this.getWeightedTopologicalGenerations(nodes)

        console.log("TopoGens", topoGens)

        return;

        const genMap = new Map<CommunicationNode, number>()
        topoGens.forEach(gen => {
            gen.nodes.forEach(node => {
                genMap.set(node, gen.generation)
            })
        })

        const sorted: CommunicationNode[] = []
        const sortedSet = new Set<CommunicationNode>()

        // console.log("!!!FLOW SORTING")
        // return topoSorting

        const visitNode = (node: CommunicationNode, currentlyVisited = new Set<CommunicationNode>()) => {
            // If the node is already sorted, we dont need to visit it again
            if (sortedSet.has(node)) return

            // Get all parents and all children of the node
            // Filter to only include the given nodes
            const parents = node.getPredecessors().filter(parent => nodeIdsToInclude.has(parent.id))
            const children = node.getSuccessors().filter(child => nodeIdsToInclude.has(child.id))

            const nodesGen = genMap.get(node)!

            // The node is added to the sorted list if one of the following is true:
            // 1. The node has no parents (e.g. for first generation nodes)
            // 2. All parents of the node are:
            //    - already sorted OR
            //    - currently visited, thus in the current path OR
            //    - also child, thus sibling connections, which can be ignored OR
            //    - in a later generation, thus the connections making this node a parent can be ignored
            const allParentsAreSorted = parents.length == 0 ||
                Array.from(parents).every(parent => sortedSet.has(parent) ||
                    currentlyVisited.has(parent) ||
                    children.includes(parent) ||
                    genMap.get(parent)! > nodesGen)
            if (!allParentsAreSorted) return

            // Add the node to the sorted list
            if (!sortedSet.has(node)) {
                sorted.push(node)
                sortedSet.add(node)
            }

            // Sort the children by the number of successors they have, descending
            const childrensSuccessorCount = children.map(child => {
                return {
                    node: child,
                    successorCount: child.getSuccessors().length
                }
            })
            // const sortedChildren = childrensSuccessorCount.sort((a, b) => a.successorCount - b.successorCount).map(item => item.node)
            const sortedChildren = childrensSuccessorCount.sort((a, b) => b.successorCount - a.successorCount).map(item => item.node)

            // Visit each child
            sortedChildren.forEach(child => {
                if (!currentlyVisited.has(child)) {
                    currentlyVisited.add(child)
                    visitNode(child, currentlyVisited)
                }
            })
        }

        // We don't want to visit nodes from different connected components at the same time, 
        // so we do the visiting for each connected component separately, starting with the smallest one

        // Get the connected components
        const connectedComponents = this.clusterer.getConnectedComponents(nodes).sort((a, b) => a.length - b.length)

        // Visit each connected component
        connectedComponents.forEach(component => {
            const topoSorting = this.topoligicalSorter.getSorting(component)

            const alreadySortedCount = sorted.length

            // Visit each node in the topological sorting
            while ((sorted.length - alreadySortedCount) < topoSorting.length) {
                topoSorting.forEach(node => {
                    visitNode(node)
                })
            }
        })


        return sorted
    }


}
