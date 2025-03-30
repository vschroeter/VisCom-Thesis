import { CommunicationChannel, CommunicationGraph, CommunicationLink } from "src/graph/commGraph";
import { Sorter } from "./sorting";
import { Clusterer } from "../clustering";
import { IdSorter } from "./simple";
import { TopologicalSorter } from "./topological";
import { CommonSettings } from "src/graph/layouter/settings/commonSettings";
import { VisGraph } from "src/graph/visGraph/visGraph";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

export type TopologicalGeneration = {
    nodes: LayoutNode[],
    generation: number
}

export class WeightedTopologicalSorter extends Sorter {

    clusterer: Clusterer
    topologicalSorter: TopologicalSorter

    /**
     * If true, generations are optimized by putting nodes in the latest possible generation.
     * E.g. a single parent node in Gen 0, having its only child in Gen 5, will be put in Gen 4.
     */
    optimizedGenerationGaps: boolean = true

    constructor(visGraph: VisGraph, commonSettings: CommonSettings) {
        super(visGraph, commonSettings);

        this.clusterer = new Clusterer(visGraph);
        this.topologicalSorter = new TopologicalSorter(visGraph, commonSettings);
    }

    getCycleFreeParentMap(nodes?: LayoutNode[], channels?: CommunicationChannel[]): Map<LayoutNode, Map<LayoutNode, number>> {
        const mapNodeToItsParents = new Map<LayoutNode, Map<LayoutNode, number>>()

        if (nodes) {
            nodes = nodes.map(node => this.visGraph.getNode(node)!) as LayoutNode[]
        } else {
            nodes = this.visGraph.allLayoutNodes;
        }

        const nodeIds = new Set(nodes.map(node => node.id))

        const mapNodeToItsAncestors = new Map<LayoutNode, Set<LayoutNode>>()
        const mapNodeToItsChildren = new Map<LayoutNode, Set<LayoutNode>>()

        // Get all merged connections and sort them by their weight
        const allLinks = this.visGraph.getAllConnectionsOfNodes(nodes, channels)
        // const mergedLinks = CommunicationLink.mergeLinks(allLinks)

        // TODO: ist es schlimm, dass hier Broadcast Connections mit denselben Gewichten komplett rausgefiltert werden? Vllt doch Sibling-Konzept wieder einführen?
        // const combinedLinks = CommunicationLink.filterLinksByWeight(CommunicationLink.combineInAndOutLinks(allLinks), this.commonSettings.hideLinksThreshold.getValue() ?? 0);

        const combinedLinks = LayoutConnection.combineInAndOutLinks(allLinks)

        // console.log("All links", allLinks);
        // console.log("Merged links", mergedLinks);
        // console.log("Combined links", combinedLinks);

        // Sort links by weight in descending order
        const sortedLinks = combinedLinks.sort((a, b) => {

            if (Math.abs(a.weight - b.weight) < 0.01) {
                // If the weights are equal, we sort by the score of the fromNode in descending order.
                // This way we make sure, that the links from a node with a higher score are visited first.

                if (Math.abs(a.source.score - b.source.score) < 0.01) {
                    // If the scores are equal, we sort by the id of the fromNode in ascending order.
                    // This way we make sure, that the links from a node with a lower id are visited first.

                    if (Math.abs(a.target.score - b.target.score) < 0.01) {
                        return a.id.localeCompare(b.id);
                    }
                    return b.target.score - a.target.score;
                }

                return b.source.score - a.source.score;
            }

            return b.weight - a.weight

        })

        // console.log("Sorted links", sortedLinks);

        // We now pop each link and store the parent relationships.
        while (sortedLinks.length > 0) {
            const link = sortedLinks.shift()!;

            const fromNode = link.source
            const toNode = link.target

            if (fromNode == toNode) continue;

            if (!mapNodeToItsParents.has(toNode)) mapNodeToItsParents.set(toNode, new Map<LayoutNode, number>())
            if (!mapNodeToItsAncestors.has(toNode)) mapNodeToItsAncestors.set(toNode, new Set<LayoutNode>())
            if (!mapNodeToItsAncestors.has(fromNode)) mapNodeToItsAncestors.set(fromNode, new Set<LayoutNode>())
            if (!mapNodeToItsChildren.has(fromNode)) mapNodeToItsChildren.set(fromNode, new Set<LayoutNode>())

            // We have to check, if the toNode is already an ancestor of the fromNode.
            // In this case we have a cycle. This cycle gets ignored.
            // Because we are iterating over the links in descending weight order, we make sure that cycles are ignored at the weakest links.
            const toNodeIsAncestor = mapNodeToItsAncestors.get(fromNode)!.has(toNode)
            if (toNodeIsAncestor) continue;

            // Store parent relationship
            // mapNodeToItsParents.get(toNode)!.add(fromNode)
            mapNodeToItsParents.get(toNode)!.set(fromNode, link.weight)

            // Store children relationship
            mapNodeToItsChildren.get(fromNode)!.add(toNode)

            // Store ancestor relationship:
            // - toNode gets all ancestors of fromNode (including fromNode) as ancestors
            // - each child of toNode gets all ancestors of fromNode as ancestors
            const childrenToVisit = [toNode]
            const newAncestors = Array.from(mapNodeToItsAncestors.get(fromNode)!)
            newAncestors.push(fromNode)

            while (childrenToVisit.length > 0) {
                const child = childrenToVisit.shift()!
                if (!mapNodeToItsAncestors.has(child)) mapNodeToItsAncestors.set(child, new Set<LayoutNode>())
                newAncestors.forEach(ancestor => mapNodeToItsAncestors.get(child)!.add(ancestor))
                if (mapNodeToItsChildren.has(child)) {
                    childrenToVisit.push(...Array.from(mapNodeToItsChildren.get(child)!))
                }
            }
        }

        // Get all nodes of the component that are not visited yet
        const nonVisitedNodes = new Set<LayoutNode>(nodes)
        Array.from(mapNodeToItsParents.keys()).forEach(node => nonVisitedNodes.delete(node))

        // If there are still non visited nodes, we have to add them to the parent map with an empty parent set
        nonVisitedNodes.forEach(node => {
            if (!mapNodeToItsParents.has(node)) mapNodeToItsParents.set(node, new Map<LayoutNode, number>())
        });

        // console.log("ParentMap", mapNodeToItsParents, nodes)
        return mapNodeToItsParents
    }

    getWeightedTopologicalGenerations(nodes?: LayoutNode[], channels?: CommunicationChannel[]): TopologicalGeneration[] {
        // Get the connection component that this node belongs to or use the given nodes
        // const component = nodes ?? this.getConnectedComponent(startNode, includeServiceConnections)

        const allGenerations = new Array<TopologicalGeneration>()

        if (nodes) {
            nodes = nodes.map(node => this.visGraph.getNode(node)!) as LayoutNode[]
        }

        const components = this.clusterer.getConnectedComponents(nodes, channels)

        if (components.length == 0) return []

        components.forEach(component => {
            const mapNodeToItsParentsCycleFree = this.getCycleFreeParentMap(component, channels);

            // From the parent map we can now create the generations
            const generationMap = new Map<LayoutNode, number>()
            const nonAssignedNodes = new Set<LayoutNode>(component)
            const gen0nodes: Set<LayoutNode> = new Set<LayoutNode>()

            // Check the generation 0 nodes for each component,
            // otherwise there could be a deadlock between sibling nodes
            // components.forEach(singleComponent => {
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
                component.forEach(node => {
                    if (!mapNodeToItsParentsCycleFree.has(node) || mapNodeToItsParentsCycleFree.get(node)!.size == 0) {
                        generationMap.set(node, 0)
                        gen0nodes.add(node)
                        nonAssignedNodes.delete(node)
                    }
                })
            }
            // });

            while (nonAssignedNodes.size > 0) {
                // Every other node gets the maximum generation of its parents increased by one
                for (const node of nonAssignedNodes.keys()) {
                    if (generationMap.has(node)) continue

                    const parents = mapNodeToItsParentsCycleFree.get(node)!

                    // If there are parents, check if every parent already have a generation
                    // If so we take the maximum generation of the parents and increase it by one
                    if (parents.size > 0) {
                        const allParentsHaveGeneration = Array.from(parents.keys()).every(parent => generationMap.has(parent))
                        if (!allParentsHaveGeneration) continue

                        const maxParentGen = Math.max(...Array.from(parents.keys()).map(parent => generationMap.get(parent)!))
                        generationMap.set(node, maxParentGen + 1)
                        nonAssignedNodes.delete(node)
                    }
                    // // If there are no parents, we take the maximum generation of the siblings
                    // else if (siblings.size > 0) {
                    //     const allSiblingHaveGeneration = Array.from(siblings).every(sibling => generationMap.has(sibling))
                    //     if (!allSiblingHaveGeneration) continue

                    //     generationMap.set(node, Math.max(...Array.from(siblings).map(sibling => generationMap.get(sibling)!)))
                    //     nonAssignedNodes.delete(node)
                    // }
                    else {
                        console.error("This should never happen")
                    }
                }
            }

            // console.log("GenerationMap", Array.from(generationMap.entries()).map(item => [item[0].id, item[1]]))

            // Now we can create the generation map
            const generations: Map<number, TopologicalGeneration> = new Map<number, TopologicalGeneration>()
            Array.from(generationMap.entries()).forEach(item => {
                const node = item[0]
                const genNr = item[1]
                if (!generations.has(genNr)) {
                    generations.set(genNr, { nodes: new Array<LayoutNode>(), generation: genNr })
                }
                generations.get(genNr)!.nodes.push(node)
            });

            // Sort the nodes in a generation by score and id
            generations.forEach(gen => {
                gen.nodes.sort((a, b) => {
                    if (Math.abs(a.score - b.score) < 0.01) {
                        return a.id.localeCompare(b.id);
                    }
                    return b.score - a.score;
                })
            })

            const generationList = Array.from(generations.values()).sort((a, b) => a.generation - b.generation)

            if (!this.optimizedGenerationGaps) {
                // console.log("[UNADAPTED GENS]", generationList)
                allGenerations.push(...generationList)
                return
            }

            // We can now adapt the generation map by iterating over the assignment in reverse order and
            // increase every generation of parent nodes that don't have intermediately children.
            // Thus we have less distance between the nodes

            const adaptedGenerationMap = new Map<LayoutNode, number>()

            // Iterate over all generations in reverse order
            for (let i = generationList.length - 1; i >= 0; i--) {
                const generation = generationList[i]
                const genNr = generation.generation
                // Iterate over all nodes of the current generation
                for (const node of generation.nodes) {
                    if (!adaptedGenerationMap.has(node)) adaptedGenerationMap.set(node, genNr)

                    // Get all parents of the node
                    const parents = mapNodeToItsParentsCycleFree.get(node)
                    if (!parents) continue
                    for (const parent of parents.keys()) {
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
                    adaptedGenerations.set(genNr, { nodes: new Array<LayoutNode>(), generation: genNr })
                }
                adaptedGenerations.get(genNr)!.nodes.push(node)
            });


            const adaptedGenerationList = Array.from(adaptedGenerations.values())
            // console.log("Generations", adaptedGenerationList)
            allGenerations.push(...adaptedGenerationList)
            // return adaptedGenerationList
        })

        allGenerations.sort((a, b) => a.generation - b.generation)

        // Merge the generations
        const mergedGenerations = new Array<TopologicalGeneration>()
        allGenerations.forEach(gen => {
            const lastGen = mergedGenerations[mergedGenerations.length - 1]
            if (lastGen && lastGen.generation == gen.generation) {
                lastGen.nodes.push(...gen.nodes)
            } else {
                mergedGenerations.push(gen)
            }
        })

        // Sort the nodes in a generation by score and id

        mergedGenerations.forEach(gen => {
            gen.nodes.sort((a, b) => {
                if (Math.abs(a.score - b.score) < 0.01) {
                    return a.id.localeCompare(b.id);
                }
                return b.score - a.score;
            })
        })



        return mergedGenerations
    }

    protected override sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {
        if (nodes.length == 0) return []

        const generations = this.getWeightedTopologicalGenerations(nodes);


        const innerSorter = this.secondarySorting ?? new IdSorter(this.visGraph, this.commonSettings);
        const sortedNodes = generations.map(gen => innerSorter.getSorting(gen.nodes)).flat()


        // console.log("[GENS]", generations, sortedNodes)

        return sortedNodes
    }
}



export class WeightedTopologicalSorterUnadapted extends WeightedTopologicalSorter {

    constructor(visGraph: VisGraph, commonSettings: CommonSettings) {
        super(visGraph, commonSettings);
        this.optimizedGenerationGaps = false
    }
}
