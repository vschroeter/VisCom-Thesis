import { CommunicationChannel, CommunicationGraph, CommunicationNode } from "src/graph/commGraph";
import { Sorter } from "./sorting";
import { Clusterer } from "../clustering";
import { IdSorter } from "./simple";
import { TopologicalSorter } from "./topological";
import { CommonSettings } from "src/graph/layouter/settings/commonSettings";

export class FlowSorter extends Sorter {

    clusterer: Clusterer
    topoligicalSorter: TopologicalSorter

    constructor(commGraph: CommunicationGraph, commonSettings: CommonSettings) {
        super(commGraph, commonSettings);

        this.clusterer = new Clusterer(commGraph);
        this.topoligicalSorter = new TopologicalSorter(commGraph, commonSettings);
    }

    protected override sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {

        if (this.startNodeSelectionSorter) {
            nodes = this.startNodeSelectionSorter.getSorting(nodes);
        }

        if (nodes.length == 0) return []

        const nodeIdsToInclude = new Set(nodes.map(node => node.id))

        this.topoligicalSorter.startNodeSelectionSorter = this.startNodeSelectionSorter
        this.topoligicalSorter.secondarySorting = this.secondarySorting

        const topoGens = this.topoligicalSorter.getTopologicalGenerations(nodes[0], undefined, nodes);

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
