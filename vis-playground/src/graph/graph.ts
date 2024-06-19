import createGraph, { Graph } from "ngraph.graph";


export class MessageType {
    name: string
    definition: string | undefined
  
    constructor(name: string, definition?: string) {
      this.name = name
      this.definition = definition
    }
  
    toString() {
      return this.name
    }
  }

export class CommunicationTopic {
    id: string;
    channel: CommunicationChannel;
    messageType: MessageType;
    direction: "input" | "output";
}

export class CommunicationNode {
    id: string;
    topics: CommunicationTopic[];
}

export class CommunicationChannel {
    type: string;
    directed: boolean;
    // direction: "forward" | "backward" | "bidirectional";
}

export class CommunicationGraph {
    /** Nodes of the graph*/
    nodes: CommunicationNode[];

    /** Mapping node ids to nodes */
    nodesById: Map<string, CommunicationNode>;

    /** Channels mapping type id to the object  */
    channelsByType: Map<string, CommunicationChannel>;

    /**
     * Map for <channelType, <topic, CommunicationNode[]>>
     * e.g. <'Publisher', <'topic1', [node1, node2]>>
     */
    channelMapsByType: Map<string, Map<string, CommunicationNode[]>>;
    
    /**
     * Map for <channelType, Graph>
     */
    graphsByChannelType: Map<string, Graph>

    /**
     * List of topics that should be hidden
     */
    hiddenTopics: RegExp[] = [];


    constructor(nodes: CommunicationNode[], channels: CommunicationChannel[]) {
        // Init the nodes
        this.nodes = nodes;
        this.nodesById = new Map<string, CommunicationNode>();
        this.nodes.forEach((node) => {
            this.nodesById.set(node.id, node);
        });

        this.channelsByType = new Map<string, CommunicationChannel>();
        this.channelMapsByType = new Map<string, Map<string, CommunicationNode[]>>();
        this.graphsByChannelType = new Map<string, Graph>();

        // Init the channels
        channels.forEach((channel) => {
            this.channelsByType.set(channel.type, channel);
            this.channelMapsByType.set(channel.type, new Map<string, CommunicationNode[]>());
        });

        // Init the channel type maps
        this.nodes.forEach((node) => {

            // For each of the node's topics, add the node to the topic map of the channel type
            node.topics.forEach((topic) => {
                const channelType = topic.channel.type;
                const topicId = topic.id;
                const topicMap = this.getTopicTpNodeMapByChannelType(channelType);

                if (!topicMap.has(topicId)) {
                    topicMap.set(topicId, []);
                }

                topicMap.get(topicId)!.push(node);
            });            
        });

        // Init the graphs
        this.channels.forEach((channel) => {
            this.graphsByChannelType.set(channel.type, createGraph({ multigraph: true }));
        });

        // Add the nodes to the graphs
        this.nodes.forEach((node) => {
            // Each node is part of each graph
            this.graphsByChannelType.forEach((graph) => {
                graph.addNode(node.id, node);
            });

            node.topics.forEach((topic) => {
                const channelType = topic.channel.type;
                const graph = this.graphsByChannelType.get(channelType)!;

                graph.addLink()
            });
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Getter and setter
    ////////////////////////////////////////////////////////////////////////////

    get channels(): CommunicationChannel[] {
        return Array.from(this.channelsByType.values());
    }

    ////////////////////////////////////////////////////////////////////////////
    // Internal helper methods
    ////////////////////////////////////////////////////////////////////////////

    _checkIfChannelTypeExists(channelType: string) {
        if (!this.channelsByType.has(channelType)) {
            throw new Error(`Channel type ${channelType} not found`);
        }
    }

    getTopicTpNodeMapByChannelType(channelType: string): Map<string, CommunicationNode[]> {
        this._checkIfChannelTypeExists(channelType);
        return this.channelMapsByType.get(channelType)!;
    }

}





////////////////////////////////////////////////////////////////////////////
// rosGraph.ts Implementation
////////////////////////////////////////////////////////////////////////////


// import createGraph, { type Graph, type Link } from 'ngraph.graph'
// import * as ROS from 'src/ros/rosNode'
// import { Ref, computed, ref, toValue } from 'vue'

// export type SortingMethod = "topological" | "flow" | "breadth-first" | "breadth-first-forward" | "depth-first" | "depth-first-forward"


// export interface GraphLayoutNode {
//   id: string
//   x: number
//   y: number
//   vx: number
//   vy: number
//   fx: number | undefined
//   fy: number | undefined
// }

// export interface GraphLayoutLink {
//   source: GraphLayoutNode
//   target: GraphLayoutNode

//   // id(d: GraphLayoutNode): string
// }

// export interface GraphLayout {
//   nodes: GraphLayoutNode[]
//   links: GraphLayoutLink[]
// }

// export class RosGraphLayoutNode implements GraphLayoutNode {
//   id: string
//   x: number
//   y: number
//   vx: number
//   vy: number
//   fx: number | undefined
//   fy: number | undefined

//   constructor(id: string, x: number, y: number) {
//     this.id = id
//     this.x = x
//     this.y = y
//     this.vx = 0
//     this.vy = 0
//     this.fx = undefined
//     this.fy = undefined
//   }
// }

// export class RosGraphLayoutLink implements GraphLayoutLink {
//   source: GraphLayoutNode
//   target: GraphLayoutNode

//   constructor(source: GraphLayoutNode, target: GraphLayoutNode) {
//     this.source = source
//     this.target = target
//   }
// }

// export class RosGraphLayout {
//   nodes: RosGraphLayoutNode[]
//   links: RosGraphLayoutLink[]

//   constructor(nodes: RosGraphLayoutNode[], links: RosGraphLayoutLink[]) {
//     this.nodes = nodes
//     this.links = links
//   }
// }

// export const HiddenLinks = [
//   /\/parameter_events/,
//   /\/.*?\/describe_parameters/,
//   /\/.*?\/get_parameter_types/,
//   /\/.*?\/get_parameters/,
//   /\/.*?\/set_parameters/,
//   /\/.*?\/set_parameters_atomically/,
//   /\/.*?\/list_parameters/
// ]

// export type InternalRosLinkData = { topic: string, type: "PubSub" | "Service" }
// export type InternalRosNodeGraph = Graph<any, InternalRosLinkData>


// /**
//  * A node in the ROS graph representation
//  */
// export class RosGraphNode {
//   /**
//    * The ROS node of the Graph Node 
//    */
//   node: ROS.Node
//   /**
//    * The ROS graph
//    */
//   rosGraph: RosGraphData

//   nodesPublishedTo: ROS.Node[] = []
//   nodesSubscribedFrom: ROS.Node[] = []
//   nodesUsingServer: ROS.Node[] = []
//   nodesClientsConnectedTo: ROS.Node[] = []
//   nodesBroadcastedTo: ROS.Node[] = []

//   broadCastTopics: ROS.Topic[] = []

//   sourceScore = 0
//   sourceScorePubSub = 0

//   constructor(node: ROS.Node, rosGraph: RosGraphData) {
//     this.node = node
//     this.rosGraph = rosGraph

//     this.broadCastTopics = this.node.topics.filter(topic =>
//       topic.type === 'Publishers' && this.node.topics.some(t =>
//         t.name === topic.name && t.type === 'Subscribers'
//       )
//     );
//     // if (this.broadCastTopics.length > 0) {
//     //   console.log("BroadCastTopics", this.broadCastTopics)
//     // }

//     const broadCastFilterList = this.broadCastTopics.map(topic => new RegExp(topic.name)).concat(HiddenLinks);

//     this.nodesPublishedTo = this._getNodesFromLinks(this._getOutgoingLinks(this.rosGraph.publisherGraph, broadCastFilterList))
//     this.nodesSubscribedFrom = this._getNodesFromLinks(this._getOutgoingLinks(this.rosGraph.subscriberGraph, broadCastFilterList))
//     this.nodesUsingServer = this._getNodesFromLinks(this._getOutgoingLinks(this.rosGraph.serverGraph))
//     this.nodesClientsConnectedTo = this._getNodesFromLinks(this._getOutgoingLinks(this.rosGraph.clientGraph))

//     const outLinks = this._getOutgoingLinks(this.rosGraph.publisherGraph)
//     this.nodesBroadcastedTo = this._getNodesFromLinks(outLinks.filter(link => broadCastFilterList.some((regex) => { return link.data.topic.match(regex) })))

//     this.sourceScore = this._getSourceScore(true, true)
//     this.sourceScorePubSub = this._getSourceScore(true, false)
//   }

//   get key(): string {
//     return this.node.key
//   }

//   get broadCastNodes(): ROS.Node[] {
//     return this.nodesBroadcastedTo
//   }

//   get successorNodes(): ROS.Node[] {
//     return this.nodesPublishedTo.concat(this.nodesClientsConnectedTo)
//   }

//   get predecessorNodes(): ROS.Node[] {
//     return this.nodesSubscribedFrom.concat(this.nodesUsingServer)
//   }

//   _getNodesFromLinks(links: Link<InternalRosLinkData>[]): ROS.Node[] {
//     const nodeNames = links.map(link => link.toId.toString())
//     const nodeNameSet = new Set(nodeNames)
//     return Array.from(nodeNameSet).map(n => this.rosGraph.nodeMap.get(n)!)
//   }

//   /**
//    * Get a list of links from a sub graph. Returns all links, incoming and outgoing.
//    * @param graph The internal graph to get the links from
//    * @param filter Optional list of regex patterns to filter out links
//    * @returns List of links from the graph
//    */
//   _getLinks(graph: InternalRosNodeGraph, filter: RegExp[] = HiddenLinks): Link<InternalRosLinkData>[] {
//     const links = graph.getLinks(this.node.key)
//     if (!links) return []
//     return Array.from(links).filter(link => !filter.some((regex) => { return link.data.topic.match(regex) }))
//   }

//   /**
//    * Get a list of outgoing links from a sub graph.
//    * @param graph The internal graph to get the links from
//    * @param filter Optional list of regex patterns to filter out links
//    * @returns List of outgoing links from the graph
//    */
//   _getOutgoingLinks(graph: InternalRosNodeGraph, filter: RegExp[] = HiddenLinks): Link<InternalRosLinkData>[] {
//     const links = this._getLinks(graph, filter)
//     return links.filter(link => link.fromId == this.node.key)
//   }

//   /**
//    * Get a list of incoming links from a sub graph.
//    * @param graph The internal graph to get the links from
//    * @param filter Optional list of regex patterns to filter out links
//    * @returns List of incoming links from the graph
//    */
//   _getIncomingLinks(graph: InternalRosNodeGraph, filter: RegExp[] = HiddenLinks): Link<InternalRosLinkData>[] {
//     const links = this._getLinks(graph, filter)
//     return links.filter(link => link.toId == this.node.key)
//   }

//   /**
//    * Returns a score how much this node is a source node. 
//    * The higher the score, the more this node is a source node.
//    */
//   _getSourceScore(pubSub = true, services = true): number {
//     // Outgoing nodes
//     const nodesPubTo = this.nodesPublishedTo
//     const nodesClientTo = this.nodesClientsConnectedTo
//     const numOutgoing = (pubSub ? nodesPubTo.length : 0) + (services ? nodesClientTo.length : 0)

//     // Incoming nodes
//     const nodesSubFrom = this.nodesSubscribedFrom
//     const nodesServer = this.nodesUsingServer
//     const numIncoming = (pubSub ? nodesSubFrom.length : 0) + (services ? nodesServer.length : 0)

//     // Diff score
//     // const score = (numOutgoing - numIncoming)

//     // Weighted diff
//     // This score not only takes the difference into account, but also the total number of connections
//     // const score = (numOutgoing - numIncoming) / (numOutgoing + numIncoming)

//     // 
//     const dif = (numOutgoing - numIncoming)
//     const score = dif / (Math.abs(dif) + 1)
//     if (isNaN(score)) return 0

//     // const links = this.rosGraph.subscriberGraph.getLinks(this.node.key)
//     // console.log("Score for " + this.node.key, numOutgoing, numIncoming, score, nodesPubTo, nodesClientTo, nodesSubFrom, nodesServer, links)
//     return score
//   }
// }

// export type RosNodeGraphGeneration = { nodes: RosGraphNode[], generation: number }

// export class RosNodeGraph {

//   nodes: RosGraphNode[] = []
//   _nodeMap: Map<ROS.Node, RosGraphNode> = new Map<ROS.Node, RosGraphNode>()
//   _nodeNameMap: Map<string, RosGraphNode> = new Map<string, RosGraphNode>()

//   constructor(nodes: RosGraphNode[]) {
//     this.nodes = nodes
//     for (const node of nodes) {
//       this._nodeMap.set(toValue(node.node), node)
//       this._nodeNameMap.set(toValue(node.node.key), node)
//     }
//   }

//   /**
//    * Get the graph node for a given ROS node.
//    * @param node ROS node or node name to get the graph node for
//    * @returns The associated graph node
//    */
//   getGraphNode(node: ROS.Node | string): RosGraphNode {
//     const nodeVal = toValue(node)
//     if (typeof nodeVal === 'string') return this._nodeNameMap.get(nodeVal)!
//     return this._nodeMap.get(nodeVal)!;
//   }

//   /**
//    * Get successor nodes of a given node. 
//    * This is the list of nodes that are directly connected from the given node.
//    * @param node The node to get the successor nodes for
//    * @param includePubSubConnections If true, include pub/sub connections to determine the successor nodes.
//    * @param includeServiceConnections If true, include service connections to determine the successor nodes.
//    * @param includeBroadcastConnections If true, include broadcast connections to determine the successor nodes.
//    * @returns The successor nodes of the given node
//    */
//   getSuccessorNodes(node: RosGraphNode, includePubSubConnections = true, includeServiceConnections = false, includeBroadcastConnections = false): RosGraphNode[] {

//     const nodes: ROS.Node[] = []
//     if (includePubSubConnections) nodes.push(...node.nodesPublishedTo)
//     if (includeServiceConnections) nodes.push(...node.nodesClientsConnectedTo)
//     if (includeBroadcastConnections) nodes.push(...node.nodesBroadcastedTo.filter(n => n.key != node.key))

//     // Remove duplicates
//     const nodeSet = new Set(nodes)
//     return Array.from(nodeSet).map(node => this._nodeMap.get(node)!)
//   }

//   /**
//    * Get predecessor nodes of a given node.
//    * This is the list of nodes that are directly connected to the given node.
//    * @param node The node to get the predecessor nodes for
//    * @param includePubSubConnections If true, also include pub/sub connections to determine the predecessor nodes.
//    * @param includeServiceConnections If true, also include service connections to determine the predecessor nodes.
//    * @param includeBroadcastConnections If true, also include broadcast connections to determine the predecessor nodes.
//    * @returns The predecessor nodes of the given node
//    */
//   getPredecessorNodes(node: RosGraphNode, includePubSubConnections = true, includeServiceConnections = false, includeBroadcastConnections = false): RosGraphNode[] {
//     const nodes: ROS.Node[] = []
//     if (includePubSubConnections) nodes.push(...node.nodesSubscribedFrom)
//     if (includeServiceConnections) nodes.push(...node.nodesUsingServer)
//     if (includeBroadcastConnections) nodes.push(...node.nodesBroadcastedTo.filter(n => n.key != node.key))

//     // Remove duplicates
//     const nodeSet = new Set(nodes)
//     return Array.from(nodeSet).map(node => this._nodeMap.get(node)!)
//   }

//   /**
//    * Get the connected component of a node. This is the set of nodes that are connected to the given node.
//    * @param node The node to get the connected component for
//    * @param includePubSubConnections If true, also include pub/sub connections to determine the connected component.
//    * @param includeServiceConnections If true, also include service connections to determine the connected component.
//    * @param includeBroadcastConnections If true, also include broadcast connections to determine the connected component.
//    * @returns The connected component of the node (as list of nodes)
//    */
//   getConnectedComponent(node: RosGraphNode | undefined, includePubSubConnections = true, includeServiceConnections = false, includeBroadcastConnections = false): RosGraphNode[] {
//     if (node == undefined) return []
//     const visited = new Set<RosGraphNode>()
//     const queue = [node]
//     while (queue.length > 0) {
//       const node = queue.shift()!
//       if (visited.has(node)) continue
//       visited.add(node)
//       queue.push(...this.getSuccessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections))
//       queue.push(...this.getPredecessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections))
//     }
//     return Array.from(visited)
//   }

//   /**
//    * Get the topological generations for the sub graph that the given node belongs to.
//    * @param startNode This node defines the sub graph to get the topological generations for
//    * @param includePubSubConnections If true, also include pub/sub connections. Otherwise only include service connections to retrieve the topological generations.
//    * @param includeServiceConnections If true, also include service connections. Otherwise only include pub/sub connections to retrieve the topological generations.
//    * @param includeBroadcastConnections If true, also include broadcast connections. Otherwise only include pub/sub connections to retrieve the topological generations.
//    * @param nodes If given, use these nodes to calculate the generations instead of the connected component of the given start node
//    * @returns The topological generations for the sub graph that the given node belongs to
//    */
//   getTopologicalGenerations(startNode?: RosGraphNode, includePubSubConnections = true, includeServiceConnections = false, includeBroadcastConnections = true, nodes?: RosGraphNode[]): RosNodeGraphGeneration[] {

//     // Get the connection component that this node belongs to or use the given nodes
//     // const component = nodes ?? this.getConnectedComponent(startNode, includeServiceConnections)
//     const component = nodes ?? this.getConnectedComponent(startNode, includePubSubConnections, includeServiceConnections, includeBroadcastConnections)

//     if (component.length == 0) return []

//     const visitedNodes = new Map<RosGraphNode, number>()
//     const nonVisitedNodes = new Set<RosGraphNode>(component)

//     const parentMap = new Map<RosGraphNode, Set<RosGraphNode>>()
//     const siblingMap = new Map<RosGraphNode, Set<RosGraphNode>>()

//     let currentNode: RosGraphNode = startNode ?? component[0]
//     let currentIteration = 0

//     // Repeat until all nodes are visited
//     while (nonVisitedNodes.size > 0) {

//       const queue: RosGraphNode[] = [currentNode]

//       // Repeat until the queue is empty
//       while (queue.length > 0) {
//         const node = queue.shift()!
//         if (visitedNodes.has(node)) continue

//         if (!parentMap.has(node)) parentMap.set(node, new Set<RosGraphNode>())
//         if (!siblingMap.has(node)) siblingMap.set(node, new Set<RosGraphNode>())

//         // Mark current node as visited
//         visitedNodes.set(node, currentIteration)
//         nonVisitedNodes.delete(node)

//         // Get all the successor nodes add them to the queue (filter out the same node in case a node publishes to itself)
//         // const successorNodes = this.getSuccessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections).filter(n => n != node)
//         const successorNodes = this.getSuccessorNodes(node, includePubSubConnections, false, false).filter(n => n != node)

//         if (nodes === undefined) queue.push(...successorNodes)
//         else {
//           queue.push(...successorNodes.filter(node => nodes.includes(node)))
//         }
//         // Save the parent node for each successor node if they were not visited yet
//         for (const successorNode of successorNodes) {
//           if (!parentMap.has(successorNode)) parentMap.set(successorNode, new Set<RosGraphNode>())
//           if (!siblingMap.has(successorNode)) siblingMap.set(successorNode, new Set<RosGraphNode>())

//           // If the successor node was already visited in the same iteration  
//           if (visitedNodes.has(successorNode) && visitedNodes.get(successorNode) == currentIteration) {
//             // If the successor node is already a parent of the current node, we have a sibling
//             if (parentMap.get(node)!.has(successorNode)) {
//               // Add the sibling to the sibling map and remove it from the parent map
//               siblingMap.get(node)!.add(successorNode)
//               siblingMap.get(successorNode)!.add(node)
//               parentMap.get(successorNode)!.delete(node)
//               parentMap.get(node)!.delete(successorNode)
//             }
//             // Otherwise we have to check all ancestors of the node and check, if the successor node is also a ancestor node to avoid cycles
//             else {
//               let hasCycle = false
//               const ancestors = new Set(parentMap.get(node)!)
//               const checkedAncestors = new Set<RosGraphNode>()

//               // Repeat until there are no ancestors left
//               while (ancestors.size > 0) {
//                 const ancestor = ancestors.values().next().value
//                 ancestors.delete(ancestor)
//                 checkedAncestors.add(ancestor)

//                 // If the ancestor is the current successor node, we have a cycle
//                 if (ancestor == successorNode) {
//                   hasCycle = true
//                   break
//                 }
//                 // Add all ancestors of the ancestor to the ancestors set
//                 Array.from(parentMap.get(ancestor)!).forEach(parent => { if (!checkedAncestors.has(parent)) ancestors.add(parent) })
//               }

//               // If there is no cycle, add the current node as parent
//               if (!hasCycle) parentMap.get(successorNode)!.add(node)
//             }
//           }
//           // If the successor node was not visited yet, add the current node as parent
//           else {
//             parentMap.get(successorNode)!.add(node)
//           }
//         }
//       }

//       // If there is no node left, we are done
//       // Get the next node that is not visited yet
//       currentNode = nonVisitedNodes.size > 0 ? nonVisitedNodes.values().next().value : null
//       // Increase the iteration to set proper parents
//       currentIteration++;
//     }


//     // From the parent and sibling map we can now create the generations
//     const generationMap = new Map<RosGraphNode, number>()
//     const nonAssignedNodes = new Set<RosGraphNode>(component)
//     const gen0nodes: Set<RosGraphNode> = new Set<RosGraphNode>()

//     // To start we take every node that has no parents and set the generation to 0
//     for (const node of parentMap.keys()) {
//       if (!parentMap.has(node) || parentMap.get(node)!.size == 0) {
//         generationMap.set(node, 0)
//         gen0nodes.add(node)
//         nonAssignedNodes.delete(node)
//       }
//     }

//     while (nonAssignedNodes.size > 0) {
//       // Every other node gets either the maximum generation of its parents increased by one, or if there are no parents the maximum generation of its siblings
//       for (const node of nonAssignedNodes.keys()) {
//         if (generationMap.has(node)) continue

//         const parents = parentMap.get(node)!
//         const siblings = siblingMap.get(node)!

//         // If there are parents, check if every parent already have a generation
//         // If so we take the maximum generation of the parents and increase it by one
//         if (parents.size > 0) {
//           const allParentsHaveGeneration = Array.from(parents).every(parent => generationMap.has(parent))
//           if (!allParentsHaveGeneration) continue

//           generationMap.set(node, Math.max(...Array.from(parents).map(parent => generationMap.get(parent)!)) + 1)
//           nonAssignedNodes.delete(node)
//         }
//         // If there are no parents, we take the maximum generation of the siblings
//         else if (siblings.size > 0) {
//           const allSiblingHaveGeneration = Array.from(siblings).every(sibling => generationMap.has(sibling))
//           if (!allSiblingHaveGeneration) continue

//           generationMap.set(node, Math.max(...Array.from(siblings).map(sibling => generationMap.get(sibling)!)))
//           nonAssignedNodes.delete(node)
//         } else {
//           console.error("This should never happen")
//         }
//       }
//     }

//     // Now we can create the generation map
//     const generations: Map<number, RosNodeGraphGeneration> = new Map<number, RosNodeGraphGeneration>()
//     Array.from(generationMap.entries()).forEach(item => {
//       const node = item[0]
//       const genNr = item[1]
//       if (!generations.has(genNr)) {
//         generations.set(genNr, { nodes: new Array(), generation: genNr })
//       }
//       generations.get(genNr)!.nodes.push(node)
//     });

//     const generationList = Array.from(generations.values()).sort((a, b) => a.generation - b.generation)

//     // We can now adapt the generation map by iterating over the assignment in reverse order and 
//     // increase every generation of parent nodes that dont have intermediately children.
//     // Thus we have less distance between the nodes

//     const adaptedGenerationMap = new Map<RosGraphNode, number>()

//     // Iterate over all generations in reverse order
//     for (let i = generationList.length - 1; i >= 0; i--) {
//       const generation = generationList[i]
//       const genNr = generation.generation
//       // Iterate over all nodes of the current generation
//       for (const node of generation.nodes) {
//         if (!adaptedGenerationMap.has(node)) adaptedGenerationMap.set(node, genNr)

//         // Get all parents of the node
//         const parents = parentMap.get(node)!
//         for (const parent of parents) {
//           if (!adaptedGenerationMap.has(parent)) adaptedGenerationMap.set(parent, genNr - 1)
//           else adaptedGenerationMap.set(parent, Math.min(adaptedGenerationMap.get(parent)!, genNr - 1))
//         }
//       }
//     }

//     // Create the adapted generation map
//     const adaptedGenerations: Map<number, RosNodeGraphGeneration> = new Map<number, RosNodeGraphGeneration>()
//     Array.from(adaptedGenerationMap.entries()).forEach(item => {
//       const node = item[0]
//       const genNr = item[1]
//       if (!adaptedGenerations.has(genNr)) {
//         adaptedGenerations.set(genNr, { nodes: new Array(), generation: genNr })
//       }
//       adaptedGenerations.get(genNr)!.nodes.push(node)
//     });


//     const adaptedGenerationList = Array.from(adaptedGenerations.values()).sort((a, b) => a.generation - b.generation)

//     return adaptedGenerationList
//   }

//   /**
//    * Get the topological sorting of the subgraph the given node is in.
//    * The sorting inside a generation is done alphabetically by the key of the nodes.
//    * @param startNode This nodes determines the subgraph what we get the topological sorting for
//    * @param includePubSubConnections If true, also include pub/sub connections. Otherwise only include service connections to retrieve the topological sorting.
//    * @param includeServiceConnections If true, also include service connections. Otherwise only include pub/sub connections to retrieve the topological sorting.
//    * @param includeBroadcastConnections If true, also include broadcast connections. Otherwise only include pub/sub connections to retrieve the topological sorting.
//    * @returns The topological sorting of the subgraph
//    */
//   getTopologicalSorting(
//     startNode: RosGraphNode,
//     includePubSubConnections = true,
//     includeServiceConnections = false,
//     includeBroadcastConnections = true,
//     sortGenBy: "key" | "childrenCount" | "sourceScore" = "childrenCount",
//     reverse = false,
//     topo_generations: RosNodeGraphGeneration[] | null = null
//   ): RosGraphNode[] {
//     const generations = topo_generations || this.getTopologicalGenerations(startNode, includePubSubConnections, includeServiceConnections, includeBroadcastConnections)

//     const sorted: RosGraphNode[] = []
//     generations.forEach(generation => {
//       if (sortGenBy == "childrenCount") generation.nodes.sort((a, b) => a.successorNodes.length - b.successorNodes.length)
//       else if (sortGenBy == "key") generation.nodes.sort((a, b) => a.key.localeCompare(b.key))
//       else if (sortGenBy == "sourceScore") generation.nodes.sort((a, b) => b.sourceScore - a.sourceScore)

//       if (reverse) generation.nodes.reverse()

//       generation.nodes.forEach(node => {
//         sorted.push(node)
//       })
//     })
//     return sorted
//   }

//   /**
//    * Get the flow sorting of the subgraph the given node is in.
//    * Flow sorting tries to minimize the distance between nodes that are connected to each other,
//    * thus also minimizing the number of nodes that are bridged by connections overall.
//    * @param startNode This nodes determines the subgraph what we get the flow sorting for
//    * @param includePubSubConnections If true, also include pub/sub connections. Otherwise only include service connections to retrieve the flow sorting.
//    * @param includeServiceConnections If true, also include service connections. Otherwise only include pub/sub connections to retrieve the flow sorting.
//    * @param includeBroadcastConnections If true, also include broadcast connections. Otherwise only include pub/sub connections to retrieve the flow sorting.
//    * @returns The flow sorting of the subgraph
//    */
//   getFlowSorting(startNode: RosGraphNode, includePubSubConnections = true, includeServiceConnections = false, includeBroadcastConnections = true): RosGraphNode[] {
//     const topoGens = this.getTopologicalGenerations(startNode, includePubSubConnections, includeServiceConnections, includeBroadcastConnections)
//     const topoSorting = this.getTopologicalSorting(startNode, includePubSubConnections, includeServiceConnections, includeBroadcastConnections, "childrenCount", false, topoGens)

//     const topoGensNameMapping = new Map<number, string[]>()
//     topoGens.forEach(gen => {
//       topoGensNameMapping.set(gen.generation, gen.nodes.map(node => node.key))
//     })

//     const genMap = new Map<RosGraphNode, number>()
//     topoGens.forEach(gen => {
//       gen.nodes.forEach(node => {
//         genMap.set(node, gen.generation)
//       })
//     })

//     const sorted: RosGraphNode[] = []
//     const sortedSet = new Set<RosGraphNode>()

//     console.log("!!!FLOW SORTING")
//     // return topoSorting

//     const visitNode = (node: RosGraphNode, currentlyVisited = new Set<RosGraphNode>()) => {
//       // If the node is already sorted, we dont need to visit it again
//       if (sortedSet.has(node)) return

//       // Get all parents and all children of the node
//       const parents = this.getPredecessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections)
//       const children = this.getSuccessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections)

//       const nodesGen = genMap.get(node)!

//       // The node is added to the sorted list if one of the following is true:
//       // 1. The node has no parents (e.g. for first generation nodes)
//       // 2. All parents of the node are:
//       //    - already sorted OR
//       //    - currently visited, thus in the current path OR
//       //    - also child, thus sibling connections, which can be ignored OR
//       //    - in a later generation, thus the connections making this node a parent can be ignored
//       const allParentsAreSorted = parents.length == 0 || Array.from(parents).every(parent => sortedSet.has(parent) || currentlyVisited.has(parent) || children.includes(parent) || genMap.get(parent)! > nodesGen)
//       if (!allParentsAreSorted) return

//       // Add the node to the sorted list
//       if (!sortedSet.has(node)) {
//         sorted.push(node)
//         sortedSet.add(node)
//       }

//       // Sort the children by the number of successors they have, ascending
//       const childrensSuccessorCount = children.map(child => {
//         return {
//           node: child,
//           successorCount: this.getSuccessorNodes(child, includePubSubConnections, includeServiceConnections, includeBroadcastConnections).length
//         }
//       })
//       const sortedChildren = childrensSuccessorCount.sort((a, b) => a.successorCount - b.successorCount).map(item => item.node)

//       // Visit each child
//       sortedChildren.forEach(child => {
//         if (!currentlyVisited.has(child)) {
//           currentlyVisited.add(child)
//           visitNode(child, currentlyVisited)
//         }
//       })
//     }

//     // Visit each node in the topological sorting
//     while (sorted.length < topoSorting.length) {
//       let i = 0;
//       while (i < topoSorting.length) {
//         visitNode(topoSorting[i])
//         i++
//       }
//     }

//     return sorted
//   }

//   /**
//    * Return all connection components of the graph.
//    * A connection component is a list of nodes that are connected to each other.
//    * The nodes inside a component are sorted topologically.
//    * @param includeServiceConnections If true, service connections are included in the components
//    * @returns All connection components of the graph
//    */
//   getConnectionComponents(sorting: SortingMethod = "flow", includePubSubConnections = true, includeServiceConnections = false, includeBroadcastConnections = false): RosGraphNode[][] {
//     const scoredNodes = this.nodes.map(n => {
//       const score = n.sourceScorePubSub
//       return { node: n, name: n.node.key, score: score, scorePubSub: n.sourceScorePubSub }
//     })
//     let sortedNodes = scoredNodes.sort((a, b) => b.scorePubSub - a.scorePubSub)

//     const components: RosGraphNode[][] = []

//     while (sortedNodes.length > 0) {
//       const startNode = sortedNodes[0].node

//       // Get the topological sorting of the subgraph starting at the start node
//       let nodes: RosGraphNode[] | undefined = undefined
//       if (sorting == "topological") nodes = this.getTopologicalSorting(startNode, includePubSubConnections, includeServiceConnections, includeBroadcastConnections)
//       else if (sorting == "flow") nodes = this.getFlowSorting(startNode, includePubSubConnections, includeServiceConnections, includeBroadcastConnections)
//       else if (sorting == "breadth-first") nodes = this.getBreadthFirstSearch(startNode, includePubSubConnections, includeServiceConnections, includeBroadcastConnections)
//       else if (sorting == "breadth-first-forward") nodes = this.getBreadthFirstSearch(startNode, includePubSubConnections, includeServiceConnections, includeBroadcastConnections, false)
//       else if (sorting == "depth-first") nodes = this.getDepthFirstSearch(startNode, includePubSubConnections, includeServiceConnections, includeBroadcastConnections)
//       else if (sorting == "depth-first-forward") nodes = this.getDepthFirstSearch(startNode, includePubSubConnections, includeServiceConnections, includeBroadcastConnections, false)

//       if (nodes == undefined) throw new Error("Unknown sorting type")

//       // Add the nodes to the components list
//       components.push(nodes)

//       // Remove all nodes from sortedNodes
//       sortedNodes = sortedNodes.filter(n => !nodes!.includes(n.node))
//     }

//     return components
//   }

//   getLinksBetweenNodes(from: RosGraphNode, to: RosGraphNode, includePubSubConnections = true, includeServiceConnections = false, includeBroadcastConnections = true): Link<InternalRosLinkData>[] {
//     const outgoingPubLinks = from.rosGraph.publisherGraph.getLinks(from.node.key)
//     const outgoingClientLinks = from.rosGraph.clientGraph.getLinks(from.node.key)

//     const broadCastFilterList = from.broadCastTopics.map(topic => new RegExp(topic.name));
//     const filteredLinks: Link<InternalRosLinkData>[] = []


//     if (outgoingPubLinks) {
//       if (includePubSubConnections) {
//         outgoingPubLinks.forEach(link => {
//           const isBroadcast = broadCastFilterList.some((regex) => { return link.data.topic.match(regex) })
//           if (link.toId == to.node.key && (includeBroadcastConnections || !isBroadcast)) filteredLinks.push(link)
//         })
//       } else if (includeBroadcastConnections) {
//         outgoingPubLinks.forEach(link => {
//           const isBroadcast = broadCastFilterList.some((regex) => { return link.data.topic.match(regex) })
//           if (link.toId == to.node.key && isBroadcast) filteredLinks.push(link)
//         })
//       }
//     }


//     if (includeServiceConnections && outgoingClientLinks) {
//       outgoingClientLinks.forEach(link => {
//         if (link.toId == to.node.key) filteredLinks.push(link)
//       })
//     }

//     return filteredLinks

//   }

//   /**
//    * Breadth-first search to find all nodes that are connected to the given node.
//    */
//   getBreadthFirstSearch(startNode: RosGraphNode, includePubSubConnections = true, includeServiceConnections = false, includeBroadcastConnections = false, includeBackwardEdges = true): RosGraphNode[] {
//     const visited = new Set<RosGraphNode>()

//     if (includeBackwardEdges) {
//       const queue = [startNode]

//       while (queue.length > 0) {
//         const node = queue.shift()!
//         if (visited.has(node)) continue
//         visited.add(node)
//         queue.push(...this.getSuccessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections))
//         queue.push(...this.getPredecessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections))
//       }
//     } else {

//       const queue = new Array<RosGraphNode>()
//       const backwardQueue = [startNode]

//       while (backwardQueue.length > 0) {
//         queue.push(backwardQueue.shift()!)
//         while (queue.length > 0) {
//           const node = queue.shift()!
//           if (visited.has(node)) continue
//           visited.add(node)
//           queue.push(...this.getSuccessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections))
//           backwardQueue.push(...this.getPredecessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections))
//         }
//       }
//     }
//     return Array.from(visited)
//   }

//   /**
//    * Depth-first search to find all nodes that are connected to the given node.
//    */
//   getDepthFirstSearch(startNode: RosGraphNode, includePubSubConnections = true, includeServiceConnections = false, includeBroadcastConnections = false, includeBackwardEdges = true): RosGraphNode[] {
//     const visited = new Set<RosGraphNode>()
//     const visit = (node: RosGraphNode) => {
//       if (visited.has(node)) return
//       visited.add(node)
//       this.getSuccessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections).forEach(visit)
//       this.getPredecessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections).forEach(visit)
//     }
//     visit(startNode);

//     if (!includeBackwardEdges) {
//       const lenNodes = visited.size
//       visited.clear()

//       const queue = new Array<RosGraphNode>()
//       queue.push(startNode)

//       const visitForward = (node: RosGraphNode) => {
//         if (visited.has(node)) return
//         visited.add(node)
//         this.getSuccessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections).forEach(visitForward)
//         queue.push(...(this.getPredecessorNodes(node, includePubSubConnections, includeServiceConnections, includeBroadcastConnections)))
//       }

//       while (visited.size < lenNodes) {
//         visitForward(queue.shift()!)
//       }

//     }
//     return Array.from(visited);
//   }
// }


// export class RosGraphData {
//   /** The nodes of the graph */
//   nodes: ROS.Node[]
//   /** Mapping node names to nodes */
//   nodeMap: Map<string, ROS.Node> = new Map<string, ROS.Node>()
//   /** Mapping topic names to nodes that publish on them */
//   publisherMap: Map<string, ROS.Node[]> = new Map<string, ROS.Node[]>()
//   /** Mapping topic names to nodes that subscribe to them */
//   subscriberMap: Map<string, ROS.Node[]> = new Map<string, ROS.Node[]>()
//   /** Mapping service names to nodes that provide them as server */
//   serviceMap: Map<string, ROS.Node[]> = new Map<string, ROS.Node[]>()
//   /** Mapping service names to nodes that uses them as client */
//   clientMap: Map<string, ROS.Node[]> = new Map<string, ROS.Node[]>()

//   topicGraph: Graph<any, any>
//   serviceGraph: Graph<any, any>

//   /** Graph containing links from nodes that publish topics to nodes that subscribe to them */
//   publisherGraph: InternalRosNodeGraph
//   /** Graph containing links from nodes that subscribe to topics to nodes that publish them */
//   subscriberGraph: InternalRosNodeGraph
//   /** Graph containing links from nodes that provide services to nodes that use them as client */
//   serverGraph: InternalRosNodeGraph
//   /** Graph containing links from nodes that use services as client to nodes that provide them */
//   clientGraph: InternalRosNodeGraph

//   constructor(nodes: ROS.Node[]) {
//     this.nodes = nodes

//     for (const node of nodes) {
//       this.nodeMap.set(node.key, node)

//       for (const topic of node.topics) {
//         if (topic.type == "Publishers") {
//           if (!this.publisherMap.has(topic.name))
//             this.publisherMap.set(topic.name, [])
//           this.publisherMap.get(topic.name)?.push(node)
//         } else if (topic.type == "Subscribers") {
//           if (!this.subscriberMap.has(topic.name))
//             this.subscriberMap.set(topic.name, [])
//           this.subscriberMap.get(topic.name)?.push(node)
//         } else if (topic.type == "Services") {
//           if (!this.serviceMap.has(topic.name)) this.serviceMap.set(topic.name, [])
//           this.serviceMap.get(topic.name)?.push(node)
//         } else if (topic.type == "Clients") {
//           if (!this.clientMap.has(topic.name)) this.clientMap.set(topic.name, [])
//           this.clientMap.get(topic.name)?.push(node)
//         }
//       }
//     }

//     this.topicGraph = createGraph({ multigraph: true })
//     this.serviceGraph = createGraph({ multigraph: true })

//     this.publisherGraph = createGraph({ multigraph: true })
//     this.subscriberGraph = createGraph({ multigraph: true })
//     this.serverGraph = createGraph({ multigraph: true })
//     this.clientGraph = createGraph({ multigraph: true })

//     for (const node of nodes) {
//       this.topicGraph.addNode(node.key)
//       this.serviceGraph.addNode(node.key)
//       this.publisherGraph.addNode(node.key)
//       this.subscriberGraph.addNode(node.key)
//       this.serverGraph.addNode(node.key)
//       this.clientGraph.addNode(node.key)

//       node.topics.forEach((topic) => {
//         if (!HiddenLinks.some((regex) => { return topic.name.match(regex) })) {
//           if (topic.type == "Publishers") {
//             for (const subscriber of this.subscriberMap.get(topic.name) || []) {
//               this.topicGraph.addLink(node.key, subscriber.key)
//             }
//           } else if (topic.type == "Services") {
//             for (const client of this.clientMap.get(topic.name) || []) {
//               this.serviceGraph.addLink(node.key, client.key)
//             }
//           }
//         }

//         if (topic.type == "Publishers") {
//           for (const subscriber of this.subscriberMap.get(topic.name) || []) {
//             this.publisherGraph.addLink(node.key, subscriber.key, { topic: topic.name, type: "PubSub" })
//           }
//         } else if (topic.type == "Subscribers") {
//           for (const publisher of this.publisherMap.get(topic.name) || []) {
//             this.subscriberGraph.addLink(node.key, publisher.key, { topic: topic.name, type: "PubSub" })
//           }
//         } else if (topic.type == "Clients") {
//           for (const server of this.serviceMap.get(topic.name) || []) {
//             this.clientGraph.addLink(node.key, server.key, { topic: topic.name, type: "Service" })
//           }
//         } else if (topic.type == "Services") {
//           for (const client of this.clientMap.get(topic.name) || []) {
//             this.serverGraph.addLink(node.key, client.key, { topic: topic.name, type: "Service" })
//           }
//         }

//       })
//     }
//   }

//   getSuccessors(nodeName: string): ROS.Node[] {
//     const successors: ROS.Node[] = []
//     const addedNodes = new Set<string>()

//     this.publisherGraph.forEachLinkedNode(nodeName, (linkedNode, link) => {
//       if (!HiddenLinks.some((regex) => { return link.data.topic.match(regex) })) {
//         if (!addedNodes.has(linkedNode.id as string)) {
//           addedNodes.add(linkedNode.id as string)
//           successors.push(this.nodeMap.get(linkedNode.id as string)!)
//         }
//       }
//     }, true)
//     this.clientGraph.forEachLinkedNode(nodeName, (linkedNode, link) => {
//       if (!HiddenLinks.some((regex) => { return link.data.topic.match(regex) })) {
//         if (!addedNodes.has(linkedNode.id as string)) {
//           addedNodes.add(linkedNode.id as string)
//           successors.push(this.nodeMap.get(linkedNode.id as string)!)
//         }
//       }
//     }, true)
//     return successors
//   }

//   getPredecessors(nodeName: string): ROS.Node[] {
//     const predecessors: ROS.Node[] = []
//     const addedNodes = new Set<string>()

//     this.subscriberGraph.forEachLinkedNode(nodeName, (linkedNode, link) => {
//       if (!HiddenLinks.some((regex) => { return link.data.topic.match(regex) })) {
//         if (!addedNodes.has(linkedNode.id as string)) {
//           addedNodes.add(linkedNode.id as string)
//           predecessors.push(this.nodeMap.get(linkedNode.id as string)!)
//         }
//       }
//     }, true)
//     this.serverGraph.forEachLinkedNode(nodeName, (linkedNode, link) => {
//       if (!HiddenLinks.some((regex) => { return link.data.topic.match(regex) })) {
//         if (!addedNodes.has(linkedNode.id as string)) {
//           addedNodes.add(linkedNode.id as string)
//           predecessors.push(this.nodeMap.get(linkedNode.id as string)!)
//         }
//       }
//     }, true)
//     return predecessors
//   }

//   getGraphLayout(): GraphLayout {
//     const nodes: Map<string, GraphLayoutNode> = new Map<string, GraphLayoutNode>()
//     for (const node of this.nodes) {
//       nodes.set(node.key, new RosGraphLayoutNode(node.key, 0, 0))
//     }

//     const links: GraphLayoutLink[] = []
//     console.log()
//     this.topicGraph.forEachLink((link) => {
//       links.push(
//         new RosGraphLayoutLink(
//           nodes.get(link.fromId.valueOf() as string)!,
//           nodes.get(link.toId.valueOf() as string)!
//         )
//       )
//     })

//     this.serviceGraph.forEachLink((link) => {
//       links.push(
//         new RosGraphLayoutLink(
//           nodes.get(link.fromId.valueOf() as string)!,
//           nodes.get(link.toId.valueOf() as string)!
//         )
//       )
//     })

//     const layout = new RosGraphLayout(Array.from(nodes.values()), links)
//     return layout
//   }
// }



// export class SortingEvaluation {
//   graph: RosNodeGraph
//   sorting: RosGraphNode[]

//   countNodes: Ref<number> = ref(0)
//   countLinksTotal: Ref<number> = ref(0)
//   countBroadcastLinks: Ref<number> = ref(0)
//   countPubSubLinks: Ref<number> = ref(0)
//   countServiceLinks: Ref<number> = ref(0)

//   countForwardLinksTotal: Ref<number> = ref(0)
//   countForwardLinksBroadcast: Ref<number> = ref(0)
//   countForwardLinksPubSub: Ref<number> = ref(0)
//   countForwardLinksService: Ref<number> = ref(0)

//   countBackwardLinksTotal: Ref<number> = ref(0)
//   countBackwardLinksBroadcast: Ref<number> = ref(0)
//   countBackwardLinksPubSub: Ref<number> = ref(0)
//   countBackwardLinksService: Ref<number> = ref(0)

//   totalEdgeLength: Ref<number> = ref(0)

//   totalEdgeLengthForward: Ref<number> = ref(0)
//   totalEdgeLengthForwardBroadcast: Ref<number> = ref(0)
//   totalEdgeLengthForwardPubSub: Ref<number> = ref(0)
//   totalEdgeLengthForwardService: Ref<number> = ref(0)

//   totalEdgeLengthBackward: Ref<number> = ref(0)
//   totalEdgeLengthBackwardBroadcast: Ref<number> = ref(0)
//   totalEdgeLengthBackwardPubSub: Ref<number> = ref(0)
//   totalEdgeLengthBackwardService: Ref<number> = ref(0)

//   totalEdgeCrossings: Ref<number> = ref(0)

//   constructor(graph: RosNodeGraph, sorting: RosGraphNode[]) {
//     this.graph = graph
//     this.sorting = sorting

//     this.countNodes.value = sorting.length
//   }

//   logTable() {
//     // Every key value pair of the object
//     const entries = Object.entries(this)
//     var obj = {}
//     entries.forEach(entry => {

//       obj[entry[0]] = entry[1].value
//     })
//     console.table(obj)

//   }

//   calculate() {

//     const sortingMap = new Map<string, number>()
//     this.sorting.forEach((node, index) => {
//       sortingMap.set(node.node.key, index)
//     })


//     const nodeLinksPubSub = new Map<number, Array<number>>()
//     const nodeLinksService = new Map<number, Array<number>>()
//     const nodeLinksBroadcast = new Map<number, Array<number>>()

//     this.sorting.forEach((nodeName, index) => {
//       const node = this.graph._nodeNameMap.get(nodeName.node.key)!

//       const successorsPubSub = this.graph.getSuccessorNodes(node, true, false, false)
//       const successorsService = this.graph.getSuccessorNodes(node, false, true, false)
//       const successorsBroadcast = this.graph.getSuccessorNodes(node, false, false, true)

//       const successorsPubSubIndex = successorsPubSub.map(s => sortingMap.get(s.node.key)!)
//       const successorsServiceIndex = successorsService.map(s => sortingMap.get(s.node.key)!)
//       const successorsBroadcastIndex = successorsBroadcast.map(s => sortingMap.get(s.node.key)!)

//       nodeLinksPubSub.set(index, successorsPubSubIndex)
//       nodeLinksService.set(index, successorsServiceIndex)
//       nodeLinksBroadcast.set(index, successorsBroadcastIndex)

//       this.countPubSubLinks.value += successorsPubSub.length
//       this.countServiceLinks.value += successorsService.length
//       this.countBroadcastLinks.value += successorsBroadcast.length
//     })

//     this.countLinksTotal.value = this.countPubSubLinks.value + this.countServiceLinks.value // + this.countBroadcastLinks.value

//     console.log(sortingMap)
//     console.log(nodeLinksPubSub, nodeLinksService, nodeLinksBroadcast)

//     // Forward links == if the successor is after the current node
//     // Backward links == if the successor is before the current node

//     const linksList = [
//       {
//         nodeLinks: nodeLinksPubSub,
//         countForward: this.countForwardLinksPubSub,
//         countBackward: this.countBackwardLinksPubSub,
//         totalEdgeLengthForward: this.totalEdgeLengthForwardPubSub,
//         totalEdgeLengthBackward: this.totalEdgeLengthBackwardPubSub
//       },
//       {
//         nodeLinks: nodeLinksService,
//         countForward: this.countForwardLinksService,
//         countBackward: this.countBackwardLinksService,
//         totalEdgeLengthForward: this.totalEdgeLengthForwardService,
//         totalEdgeLengthBackward: this.totalEdgeLengthBackwardService
//       },
//       {
//         nodeLinks: nodeLinksBroadcast,
//         countForward: this.countForwardLinksBroadcast,
//         countBackward: this.countBackwardLinksBroadcast,
//         totalEdgeLengthForward: this.totalEdgeLengthForwardBroadcast,
//         totalEdgeLengthBackward: this.totalEdgeLengthBackwardBroadcast
//       },
//     ];

//     linksList.forEach((obj) => {
//       const nodeLinks = obj.nodeLinks
//       const countForward = obj.countForward
//       const countBackward = obj.countBackward
//       const totalEdgeLengthForward = obj.totalEdgeLengthForward
//       const totalEdgeLengthBackward = obj.totalEdgeLengthBackward

//       nodeLinks.forEach((successors, nodeIndex) => {
//         successors.forEach(successorIndex => {
//           if (successorIndex > nodeIndex) {
//             countForward.value++;
//             totalEdgeLengthForward.value += successorIndex - nodeIndex;
//           } else if (successorIndex < nodeIndex) {
//             countBackward.value++;
//             totalEdgeLengthBackward.value += nodeIndex - successorIndex;
//           }
//         })
//       })
//     })


//     this.countForwardLinksTotal.value = this.countForwardLinksPubSub.value + this.countForwardLinksService.value // + this.countForwardLinksBroadcast.value
//     this.countBackwardLinksTotal.value = this.countBackwardLinksPubSub.value + this.countBackwardLinksService.value // + this.countBackwardLinksBroadcast.value
//     this.totalEdgeLengthBackward.value = this.totalEdgeLengthBackwardPubSub.value + this.totalEdgeLengthBackwardService.value // + this.totalEdgeLengthBackwardBroadcast.value
//     this.totalEdgeLengthForward.value = this.totalEdgeLengthForwardPubSub.value + this.totalEdgeLengthForwardService.value // + this.totalEdgeLengthForwardBroadcast.value
//     this.totalEdgeLength.value = this.totalEdgeLengthBackward.value + this.totalEdgeLengthForward.value;

//     this.countLinksTotal.value = this.countForwardLinksTotal.value + this.countBackwardLinksTotal.value;


//     // Edge crossings --> iterate each edge and check if it crosses another edge:
//     // Edge1 = (e1_start, e1_end)
//     // Edge2 = (e2_start, e2_end)
//     // 1) (e1_start < e2_start && e1_start < e1_end) && (e1_end > e2_start && e1_end < e2_end) --> crossing
//     // 2) (e2_start > e1_start && e2_start < e1_end) && (e2_end > e1_start && e2_end > e1_end) --> crossing 

//     [nodeLinksPubSub, nodeLinksService].forEach(e1_links => {
//       e1_links.forEach((successors, e1_start) => {
//         successors.forEach(e1_end => {
//           [nodeLinksPubSub, nodeLinksService].forEach(e2_links => {
//             e2_links.forEach((successors, e2_start) => {
//               successors.forEach(e2_end => {

//                 const bla = this.totalEdgeCrossings.value
//                 if (e1_start < e1_end && e2_start < e2_end) {
//                   if ((e1_start < e2_start && e1_start < e1_end) && (e1_end > e2_start && e1_end < e2_end)) this.totalEdgeCrossings.value++;
//                   else if ((e2_start > e1_start && e2_start < e1_end) && (e2_end > e1_start && e2_end > e1_end)) this.totalEdgeCrossings.value++;

//                 } else if (e1_start > e1_end && e2_start > e2_end) {
//                   if ((-e1_start < -e2_start && -e1_start < -e1_end) && (-e1_end > -e2_start && -e1_end < -e2_end)) this.totalEdgeCrossings.value++;
//                   else if ((-e2_start > -e1_start && -e2_start < -e1_end) && (-e2_end > -e1_start && -e2_end > -e1_end)) this.totalEdgeCrossings.value++;
//                 }

//                 if (bla != this.totalEdgeCrossings.value) {
//                   console.log("CROSSING", e1_start, e1_end, e2_start, e2_end)
//                 }

//               })
//             })
//           })
//         })
//       });
//     });


//     this.logTable();
//   }

// }
