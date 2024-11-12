import { CommunicationChannel, CommunicationGraph, CommunicationLink, CommunicationNode } from "src/graph/commGraph";
import { Sorter } from "./sorting";
import { Clusterer } from "../clustering";
import { IdSorter } from "./simple";
import { TopologicalSorter } from "./topological";
import { WeightedTopologicalSorter } from "./weightedTopological";
import { CommonSettings } from "src/graph/layouter/settings/commonSettings";
import { VisGraph } from "src/graph/visGraph/visGraph";
import { LayoutNode } from "src/graph/visGraph/layoutNode";

export type TopologicalGeneration = {
    nodes: LayoutNode[],
    generation: number
}

export class CommFlowSorter extends Sorter {

    clusterer: Clusterer
    topoligical: WeightedTopologicalSorter

    constructor(visGraph: VisGraph, commonSettings: CommonSettings) {
        super(visGraph, commonSettings);

        this.clusterer = new Clusterer(visGraph);
        this.topoligical = new WeightedTopologicalSorter(visGraph, commonSettings);
    }

    protected override sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {

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

        this.topoligical.startNodeSelectionSorter = this.startNodeSelectionSorter
        this.topoligical.secondarySorting = this.secondarySorting

        // const topoGens = this.topoligicalSorter.getTopologicalGenerations(nodes[0], undefined, nodes);

        const topoGens = this.topoligical.getWeightedTopologicalGenerations(nodes)
        
        const mapNodeToParentsCycleFree = this.topoligical.getCycleFreeParentMap(nodes);

        // Create the childMap based on the parentMap
        const mapNodeToChildrenCycleFree = new Map<LayoutNode, Map<LayoutNode, number>>()

        mapNodeToParentsCycleFree.forEach((parentAndWeights, node) => {
            parentAndWeights.forEach((weight, parent) => {
                if (!mapNodeToChildrenCycleFree.has(parent)) {
                    mapNodeToChildrenCycleFree.set(parent, new Map())
                }
                mapNodeToChildrenCycleFree.get(parent)!.set(node, weight)
            })
        })

        const successorsOfNode = (node: LayoutNode) => {            
            if (!mapNodeToChildrenCycleFree.has(node)) return []

            const childrenAndWeights = mapNodeToChildrenCycleFree.get(node)!
            // return Array.from(childrenAndWeights).sort((a, b) => b[1] - a[1]).filter(item => item[1] > 0.25).map(item => item[0])
            return Array.from(childrenAndWeights).sort((a, b) => b[1] - a[1]).map(item => item[0])
        }

        const predecessorsOfNode = (node: LayoutNode) => {
            if (!mapNodeToParentsCycleFree.has(node)) return []

            const parentsAndWeights = mapNodeToParentsCycleFree.get(node)!
            // return Array.from(parentsAndWeights).sort((a, b) => b[1] - a[1]).filter(item => item[1] > 0.25).map(item => item[0])
            return Array.from(parentsAndWeights).sort((a, b) => b[1] - a[1]).map(item => item[0])
        }

        console.log("TopoGens", topoGens)


        const genMap = new Map<LayoutNode, number>()
        topoGens.forEach(gen => {
            gen.nodes.forEach(node => {
                genMap.set(node, gen.generation)
            })
        })

        const sorted: LayoutNode[] = []
        const sortedSet = new Set<LayoutNode>()

        // console.log("!!!FLOW SORTING")
        // return topoSorting

        const visitNode = (node: LayoutNode, currentlyVisited = new Set<LayoutNode>()) => {
            // If the node is already sorted, we dont need to visit it again
            if (sortedSet.has(node)) return

            // Get all parents and all children of the node
            // Filter to only include the given nodes
            const parents = predecessorsOfNode(node).filter(parent => nodeIdsToInclude.has(parent.id))
            const children = successorsOfNode(node).filter(child => nodeIdsToInclude.has(child.id))

            const nodesGen = genMap.get(node)!

            if (node.id == "display_eye_right") {
                const x = 5;
            }

            // The node is added to the sorted list if one of the following is true:
            // 1. The node has no parents (e.g. for first generation nodes)
            // 2. All parents of the node are:
            //    - already sorted OR
            //    - currently visited, thus in the current path OR
            //    - also child, thus sibling connections, which can be ignored OR
            //    - in a later generation, thus the connections making this node a parent can be ignored
            const allParentsAreSorted = parents.length == 0 ||
                Array.from(parents).every(parent => sortedSet.has(parent) ||
                    // currentlyVisited.has(parent) ||
                    children.includes(parent) ||
                    genMap.get(parent)! > nodesGen)
            if (!allParentsAreSorted) return

            // Add the node to the sorted list
            if (!sortedSet.has(node)) {
                sorted.push(node)
                sortedSet.add(node)
            }

            // const sortedChildren = Array.from(children).sort((a, b) => b.score - a.score)

            // // Sort the children by the number of successors they have, descending
            const childrensSuccessorCount = children.map(child => {
                return {
                    node: child,
                    successorCount: successorsOfNode(child).length
                }
            })
            // const sortedChildren = childrensSuccessorCount.sort((a, b) => a.successorCount - b.successorCount).map(item => item.node)
            const sortedChildren = childrensSuccessorCount.sort((a, b) => b.successorCount - a.successorCount).map(item => item.node)

            // Visit each child
            sortedChildren.forEach(child => {
                visitNode(child, currentlyVisited);

                // if (!currentlyVisited.has(child)) {
                //     currentlyVisited.add(child)
                //     visitNode(child, currentlyVisited)
                // }
            })
        }

        // We don't want to visit nodes from different connected components at the same time, 
        // so we do the visiting for each connected component separately, starting with the smallest one

        // Get the connected components
        const connectedComponents = this.clusterer.getConnectedComponents(nodes).sort((a, b) => a.length - b.length)

        // Visit each connected component
        connectedComponents.forEach(component => {
            const topoSorting = this.topoligical.getSorting(component)

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
