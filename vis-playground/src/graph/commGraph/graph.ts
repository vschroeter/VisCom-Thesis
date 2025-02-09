import createGraph, { Graph } from "ngraph.graph";
import { CommunicationChannel, CommunicationDirection, CommunicationDirectionPendant } from "./channel";
import { ChannelGraphLinkData, CommunicationLink, NodeToNodeConnection, NodeToNodeConnections } from "./link";
import { CommunicationNode } from "./node";
import { CommunicationTopic } from "./topic";
import { NodeCommunities } from "./community";

////////////////////////////////////////////////////////////////////////////
// #region Helper classes
////////////////////////////////////////////////////////////////////////////

/**
 * Helper class representing a mapping of topics to nodes on a specific communication channel.
 * The mapping is separated into incoming, outgoing, bidirectional, and all topics.
 */
export class TopicToNodeMap<NodeData> {
  /** The channel for all topics in this mapping */
  channel: CommunicationChannel;

  /** Mapping of topics to nodes in outgoing direction (thus, nodes publishing data on a topic on this channel) */
  outgoing: Map<string, CommunicationNode<NodeData>[]> = new Map<
    string,
    CommunicationNode<NodeData>[]
  >();

  /** Mapping of topics to nodes in incoming directio (thus, nodes receiving data on a topic on this channel) */
  incoming: Map<string, CommunicationNode<NodeData>[]> = new Map<
    string,
    CommunicationNode<NodeData>[]
  >();

  /** Mapping of topics to nodes in bidirectional direction (thus, nodes communicating data in both directions on a topic on this channel) */
  bidirectional: Map<string, CommunicationNode<NodeData>[]> = new Map<
    string,
    CommunicationNode<NodeData>[]
  >();

  /** Mapping of all topics to nodes on this channel */
  all: Map<string, CommunicationNode<NodeData>[]> = new Map<
    string,
    CommunicationNode<NodeData>[]
  >();

  directions: {
    [key in CommunicationDirection]: Map<string, CommunicationNode<NodeData>[]>;
  } = {
      incoming: this.incoming,
      outgoing: this.outgoing,
      bidirectional: this.bidirectional,
    };

  /**
   * Create a new mapping of topics to nodes on a specific communication channel.
   * @param channel The channel for all topics in this mapping
   */
  constructor(channel: CommunicationChannel) {
    this.channel = channel;
  }
}

/**
 * Helper class representing the graphs on a communication channel.
 */
export class CommunicationChannelGraphs {
  /** The channel for the graphs */
  channel: CommunicationChannel;

  /** The graph representing the outgoing direction of the channel */
  outgoing: Graph<any, ChannelGraphLinkData>;
  /** The graph representing the incoming direction of the channel */
  incoming: Graph<any, ChannelGraphLinkData>;
  /** The graph representing the bidirectional direction of the channel */
  bidirectional: Graph<any, ChannelGraphLinkData>;
  /** The graph representing all directions of the channel */
  all: Graph<any, ChannelGraphLinkData>;

  directions: {
    [key in CommunicationDirection]: Graph<any, ChannelGraphLinkData>;
  };

  /**
   * Create a new set of graphs for a communication channel.
   * @param channel The channel for the graphs
   */
  constructor(channel: CommunicationChannel) {
    this.channel = channel;
    this.outgoing = createGraph({ multigraph: true });
    this.incoming = createGraph({ multigraph: true });
    this.bidirectional = createGraph({ multigraph: true });
    this.all = createGraph({ multigraph: true });

    this.directions = {
      incoming: this.incoming,
      outgoing: this.outgoing,
      bidirectional: this.bidirectional,
    };
  }

  /**
   * Add a node to all graphs
   * @param node The node to add
   */
  addNode(node: CommunicationNode) {
    this.outgoing.addNode(node.id, node);
    this.incoming.addNode(node.id, node);
    this.bidirectional.addNode(node.id, node);
    this.all.addNode(node.id, node);
  }
}

////////////////////////////////////////////////////////////////////////////
// #region CommGraph class
////////////////////////////////////////////////////////////////////////////

/**
 * Class representing a communication graph.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export class CommunicationGraph<NodeData = any> {
  /** Nodes of the graph*/
  nodes: CommunicationNode<NodeData>[] = [];

  /** Mapping node ids to nodes */
  nodesById: Map<string, CommunicationNode<NodeData>>;

  /** Mapping channel type id to the CommunicationChannel object  */
  channelsByType: Map<string, CommunicationChannel>;

  /** Mapping channel type id to the TopicToNodeMap object */
  topicToNodeMapsByChannelType: Map<string, TopicToNodeMap<NodeData>>;

  /** Mapping channel type id to the CommunicationChannelGraphs object */
  graphsByChannelType: Map<string, CommunicationChannelGraphs>;

  communities: NodeCommunities = new NodeCommunities();
  // scoring: NodeScoring = new NodeScoring();

  /**
   * List of topics that should be hidden
   */
  hiddenTopics: RegExp[] = [];

  // hiddenLinksThreshold: number = 0;

  constructor(
    nodes: CommunicationNode<NodeData>[],
    channels: CommunicationChannel[],
  ) {
    // Init the nodes
    // this.nodes = nodes;
    this.nodesById = new Map<string, CommunicationNode<NodeData>>();
    this.channelsByType = new Map<string, CommunicationChannel>();
    this.topicToNodeMapsByChannelType = new Map<
      string,
      TopicToNodeMap<NodeData>
    >();
    this.graphsByChannelType = new Map<string, CommunicationChannelGraphs>();

    // Init the channels
    channels.forEach((channel) => {
      this.channelsByType.set(channel.type, channel);
      this.topicToNodeMapsByChannelType.set(
        channel.type,
        new TopicToNodeMap(channel),
      );
    });

    // this.nodes.forEach((node) => {
    //     this.addNode(node);
    // });
    this.addNodes(nodes);
  }

  /**
   * Add a node / nodes to the communication graph.
   * @param nodes The node / nodes to add
   */
  addNodes(nodes: CommunicationNode<NodeData> | CommunicationNode<NodeData>[]) {
    nodes = Array.isArray(nodes) ? nodes : [nodes];
    nodes.forEach((node) => {
      node.graph = this;
      this.nodes.push(node);
      this.nodesById.set(node.id, node);

      // For each of the node's topics, add the node to the topic map of the channel type
      node.topics.forEach((topic) => {
        const channelType = topic.channel.type;
        const topicId = topic.id;
        const topicMap = this.getTopicToNodeMapByChannelType(channelType);
        const directedTopicMap = topicMap[topic.direction];
        if (!directedTopicMap.has(topicId)) {
          directedTopicMap.set(topicId, []);
        }
        // if (!topicMap.all.has(topicId)) {
        //   topicMap.all.set(topicId, []);
        // }

        directedTopicMap.get(topicId)!.push(node);
        // topicMap.all.get(topicId)!.push(node);
      });
    });

    this.communities.initDefaultCommunities(this.nodes.map(node => node.id));

    this._updateLinks();
  }

  ////////////////////////////////////////////////////////////////////////////
  // Getter and setter
  ////////////////////////////////////////////////////////////////////////////

  /**
   * Get the channels of the communication graph
   */
  get channels(): CommunicationChannel[] {
    return Array.from(this.channelsByType.values());
  }

  ////////////////////////////////////////////////////////////////////////////
  // Internal helper methods
  ////////////////////////////////////////////////////////////////////////////

  private _checkIfChannelTypeExists(channelType: string) {
    if (!this.channelsByType.has(channelType)) {
      throw new Error(`Channel type ${channelType} not found`);
    }
  }

  getTopicToNodeMapByChannelType(
    channelType: string,
  ): TopicToNodeMap<NodeData> {
    this._checkIfChannelTypeExists(channelType);
    return this.topicToNodeMapsByChannelType.get(channelType)!;
  }

  private _updateLinks() {
    // Init the graphs
    this.channels.forEach((channel) => {
      this.graphsByChannelType.set(
        channel.type,
        new CommunicationChannelGraphs(channel),
      );
    });

    this.nodes.forEach((node) => {
      // Add the nodes to the graphs
      // Each node is part of each graph
      this.graphsByChannelType.forEach((graph) => {
        graph.addNode(node);
      });

      // Add the links between the nodes
      node.topics.forEach((topic) => {
        const channelType = topic.channel.type;
        const graphs = this.graphsByChannelType.get(channelType)!;
        const topicMap = this.getTopicToNodeMapByChannelType(channelType);

        // Adding links to the graph representing the direction of the topic
        const graph: Graph<any, ChannelGraphLinkData> = graphs[topic.direction];

        // To add the links from the current node to destination nodes,
        // we get all nodes that have the pendant direction of the same topic
        const directionTopicMap =
          topicMap[CommunicationDirectionPendant[topic.direction]].get(
            topic.id,
          ) || [];

        // For each destination node, add a link
        directionTopicMap.forEach((destinationNode) => {
          graph.addLink(
            node.id,
            destinationNode.id,
            new ChannelGraphLinkData(topic, topic.channel),
          );
        });
      });
    });
  }

  static getNodeID(node: string | CommunicationNode<any>): string {
    if (typeof node === 'string') {
      return node;
    } else {
      return node.id;
    }
  }

  getNode(nodeID?: string | CommunicationNode<NodeData>): CommunicationNode<NodeData> | undefined {
    if (nodeID === undefined) {
      return undefined;
    }
    if (typeof nodeID === 'string') {
      return this.nodesById.get(nodeID);
    }
    return nodeID;
  }

  getChannels(
    channels?: CommunicationChannel[] | string[] | string,
  ): CommunicationChannel[] {
    // If no channels are set, consider all channels
    if (channels === undefined) {
      return this.channels;
    } else if (typeof channels === 'string') {
      return [this.channelsByType.get(channels)!];
    } else if (Array.isArray(channels)) {
      return channels.map((channel) => {
        if (typeof channel === 'string') {
          return this.channelsByType.get(channel)!;
        } else {
          return channel;
        }
      });
    }
    return [];
  }

  ////////////////////////////////////////////////////////////////////////////
  // Successor and predeccessor methods
  ////////////////////////////////////////////////////////////////////////////

  /**
   * Get successors of a node on the given channel(s) according to the direction.
   * @param node The starting node
   * @param direction The direction of the communication topic
   * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
   * @returns List of successor nodes
   */
  getSuccesscorsAccordingToDirection(
    node: string | CommunicationNode<NodeData>,
    direction: CommunicationDirection,
    channels?: CommunicationChannel[] | string[] | string,
  ): CommunicationNode[] {
    const successors: CommunicationNode<NodeData>[] = [];
    const addedNodes = new Set<string>();

    const nodeID = CommunicationGraph.getNodeID(node);
    const commChannels = this.getChannels(channels);

    commChannels.forEach((channel) => {
      this.graphsByChannelType
        .get(channel.type)!
        .directions[direction].forEachLinkedNode(
          nodeID,
          (linkedNode, link) => {
            if (
              !this.hiddenTopics.some((regex) => {
                return link.data.topic.id.match(regex);
              })
            ) {
              if (!addedNodes.has(linkedNode.id as string)) {
                addedNodes.add(linkedNode.id as string);
                successors.push(this.nodesById.get(linkedNode.id as string)!);
              }
            }
          },
          true,
        );
    });

    return successors;
  }

  /**
   * Get the successors of a node on the given channel(s) (thus, successor nodes that receive data from the given node).
   * @param nodeID The starting node
   * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
   * @returns List of successor nodes
   */
  getSuccessors(
    nodeID: string | CommunicationNode<NodeData>,
    channels?: CommunicationChannel[] | string[],
  ): CommunicationNode<NodeData>[] {
    return this.getSuccesscorsAccordingToDirection(
      nodeID,
      'outgoing',
      channels,
    );
  }

  /**
   * Get the predecessors of a node on the given channel(s) (thus, predecessor nodes that send data to the given node).
   * @param nodeID The starting node
   * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
   * @returns List of predecessor nodes
   */
  getPredecessors(
    nodeID: string | CommunicationNode<NodeData>,
    channels?: CommunicationChannel[] | string[],
  ): CommunicationNode<NodeData>[] {
    return this.getSuccesscorsAccordingToDirection(
      nodeID,
      'incoming',
      channels,
    );
  }

  ////////////////////////////////////////////////////////////////////////////
  // Link methods
  ////////////////////////////////////////////////////////////////////////////

  /**
   * Get the links of a node on the given channel(s) according to the direction.
   * @param node The starting node
   * @param direction The direction of the communication topic
   * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
   * @returns List of links
   */
  getLinksAccordingToDirection(
    node: string | CommunicationNode<NodeData>,
    direction: CommunicationDirection,
    channels?: CommunicationChannel[] | string[] | string,
    threshold?: number
  ): CommunicationLink[] {
    const links: CommunicationLink[] = [];

    const nodeID = CommunicationGraph.getNodeID(node);
    const commChannels = this.getChannels(channels);

    commChannels.forEach((channel) => {
      this.graphsByChannelType
        .get(channel.type)!
        .directions[direction].forEachLinkedNode(
          nodeID,
          (linkedNode, link) => {
            if (
              !this.hiddenTopics.some((regex) => {
                return link.data.topic.id.match(regex);
              })
            ) {

              const weight = this.getTopicWeight(channel.type, link.data.topic.id);
              // const w = link.data.topic.weight;

              if (threshold && weight < threshold) {
                return;
              }

              links.push(
                new CommunicationLink(
                  link.data.topic,
                  link.fromId as string,
                  link.toId as string,
                  channel,
                  direction,
                  this,
                  weight //link.data.topic.weight
                ),
              );
            }
          },
          true,
        );
    });

    return links;
  }

  /**
   * Get the links of a node on the given channel(s) (thus, links that receive data from the given node).
   * @param nodeID The starting node
   * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
   * @returns List of links
   */
  getOutgoingLinks(
    nodeID: string | CommunicationNode<NodeData>,
    channels?: CommunicationChannel[] | string[],
    threshold?: number
  ): CommunicationLink[] {
    return this.getLinksAccordingToDirection(nodeID, 'outgoing', channels, threshold);
  }

  /**
   * Get the links of a node on the given channel(s) (thus, links that send data to the given node).
   * @param nodeID The starting node
   * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
   * @returns List of links
   */
  getIncomingLinks(
    nodeID: string | CommunicationNode<NodeData>,
    channels?: CommunicationChannel[] | string[],
    threshold?: number
  ): CommunicationLink[] {
    return this.getLinksAccordingToDirection(nodeID, 'incoming', channels, threshold);
  }

  /**
   * Get all links on the given channel(s).
   * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
   * @returns List of links
   */
  getAllLinks(
    channels?: CommunicationChannel[] | string[], threshold?: number
  ): CommunicationLink[] {
    return this.getAllLinksOfNodes(this.nodes, channels, threshold);
  }

  /**
   * Get all links of a set of node on the given channel(s).
   * @param nodes The nodes to get the links of
   * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
   * @returns List of links
   */
  getAllLinksOfNodes(nodes: CommunicationNode[], channels?: CommunicationChannel[] | string[], threshold?: number): CommunicationLink[] {
    const links: CommunicationLink[] = [];

    const commChannels = this.getChannels(channels);

    nodes.forEach((node) => {
      links.push(...this.getOutgoingLinks(node.id, commChannels, threshold));
    });

    return links;
  }

  getAllInternalLinksOfNodes(nodes: CommunicationNode[], channels?: CommunicationChannel[] | string[], threshold?: number): CommunicationLink[] {
    const links: CommunicationLink[] = [];

    const commChannels = this.getChannels(channels);

    const allLinks = this.getAllLinks(commChannels, threshold);

    // Filter out all links that are not internal
    allLinks.forEach((link) => {
      if (nodes.some(node => node.id === link.fromId) && nodes.some(node => node.id === link.toId)) {
        links.push(link);
      }
    });

    return links;
  }

  getAllExternalLinksBetweenNodeGroups(nodeGroup1: CommunicationNode[], nodeGroup2: CommunicationNode[], channels?: CommunicationChannel[] | string[], threshold?: number): CommunicationLink[] {
    const links: CommunicationLink[] = [];

    const commChannels = this.getChannels(channels);

    const allLinks = this.getAllLinks(commChannels, threshold);

    const group1Ids = new Set(nodeGroup1.map(node => node.id));
    const group2Ids = new Set(nodeGroup2.map(node => node.id));

    const linksInGroup1 = allLinks.filter(link => group1Ids.has(link.fromId) && group1Ids.has(link.toId));
    const linksInGroup2 = allLinks.filter(link => group2Ids.has(link.fromId) && group2Ids.has(link.toId));

    const mapLinksInGroup1: Map<string, Map<string, CommunicationLink>> = new Map();
    const mapLinksInGroup2: Map<string, Map<string, CommunicationLink>> = new Map();

    linksInGroup1.forEach((link) => {
      if (!mapLinksInGroup1.has(link.fromId)) {
        mapLinksInGroup1.set(link.fromId, new Map());
      }
      mapLinksInGroup1.get(link.fromId)!.set(link.toId, link);
    });

    linksInGroup2.forEach((link) => {
      if (!mapLinksInGroup2.has(link.fromId)) {
        mapLinksInGroup2.set(link.fromId, new Map());
      }
      mapLinksInGroup2.get(link.fromId)!.set(link.toId, link);
    });

    const linkIsInsideGroup1 = (link: CommunicationLink) => {
      return mapLinksInGroup1.has(link.fromId) && mapLinksInGroup1.get(link.fromId)!.has(link.toId);
    }

    const linkIsInsideGroup2 = (link: CommunicationLink) => {
      return mapLinksInGroup2.has(link.fromId) && mapLinksInGroup2.get(link.fromId)!.has(link.toId);
    }

    const linkIsBetweenGroups = (link: CommunicationLink) => {
      return ((group1Ids.has(link.fromId) && group2Ids.has(link.toId)) || (group2Ids.has(link.fromId) && group1Ids.has(link.toId))) && !linkIsInsideGroup1(link) && !linkIsInsideGroup2(link);
    }

    // Only keep the links that are between the two node groups
    allLinks.forEach((link) => {
      if (linkIsBetweenGroups(link)) {
        links.push(link);
      }
      // if (group1Ids.has(link.fromId) && group2Ids.has(link.toId) && !group1Ids.has(link.toId)) {
      //   links.push(link);
      // } else if (group2Ids.has(link.fromId) && group1Ids.has(link.toId) && !group2Ids.has(link.toId)) {
      //   links.push(link);
      // }
    });

    return links;
  }


  getConnectionsBetweenNodes(startNodeId?: CommunicationNode | string, endNodeId?: CommunicationNode | string): NodeToNodeConnections | undefined {

    if (!startNodeId || !endNodeId) {
      return undefined;
    }

    const startNode = this.getNode(startNodeId);
    const endNode = this.getNode(endNodeId);

    if (!startNode || !endNode) {
      return undefined;
    }

    // Get the topics that are shared between the nodes
    const sharedTopics = startNode.topics
      .filter(startTopic => startTopic.direction === 'outgoing')
      .filter((startTopic) => {
        return endNode.topics.filter(endTopic => endTopic.direction == "incoming").some((endTopic) => {
          return startTopic.channel.type === endTopic.channel.type && startTopic.id === endTopic.id;
        });
      });

    // For each of the topic, now get the amount of nodes publishing to the this topic
    const connections: NodeToNodeConnection[] = []

    sharedTopics.forEach((topic) => {
      const channelType = topic.channel.type;
      const topicMap = this.getTopicToNodeMapByChannelType(channelType);
      const directedTopicToNodeMap = topicMap[topic.direction];
      const targetNodes = directedTopicToNodeMap.get(topic.id) || [];

      // const filteredNodes = targetNodes.filter((targetNode) => targetNode.id !== startNode.id);
      const filteredNodes = targetNodes;
      const count = filteredNodes.length
      connections.push(new NodeToNodeConnection(startNode.id, endNode.id, topic, count));
    });

    // return connections;
    return new NodeToNodeConnections(startNode.id, endNode.id, connections);
  }

  ////////////////////////////////////////////////////////////////////////////
  // Topic weight methods
  ////////////////////////////////////////////////////////////////////////////

  getTopicUsageCount(channel: string, topicId: string, ignoreSelfLoops = false): number {
    const topicMap = this.getTopicToNodeMapByChannelType(channel);
    const pubNodes = topicMap.outgoing.get(topicId)!;
    const subNodes = topicMap.incoming.get(topicId)!;
    const pubAndSubNodes = pubNodes.filter((pubNode) => subNodes.some((subNode) => subNode.id === pubNode.id));

    // The usage count is the count of publishers multiplied by the count of subscribers
    // to ignore self-loops, we subtract the count of nodes that are both publishers and subscribers
    const usageCount = pubNodes.length * subNodes.length;
    if (ignoreSelfLoops) {
      return usageCount - pubAndSubNodes.length;
    }
    return usageCount;
  }

  getTopicWeight(channel: string, topicId: string): number {
    const count = this.getTopicUsageCount(channel, topicId);
    return Math.sqrt(1 / Math.max(count, 1));
  }

  ////////////////////////////////////////////////////////////////////////////
  // Node scoring methods
  ////////////////////////////////////////////////////////////////////////////

  setNodeScoringByList(scoring: [string, number][]) {
    for (const [nodeId, score] of scoring) {
      const node = this.getNode(nodeId);
      if (node) {
        node.score = score;
      }
    }
  }

  getScoreExtent(): [number, number] {
    let minScore = Number.POSITIVE_INFINITY;
    let maxScore = Number.NEGATIVE_INFINITY;
    this.nodes.forEach((node) => {
      minScore = Math.min(minScore, node.score);
      maxScore = Math.max(maxScore, node.score);
    });
    return [minScore, maxScore];
  }

  ////////////////////////////////////////////////////////////////////////////
  // Graph Creation Methods
  ////////////////////////////////////////////////////////////////////////////

  // static createMergedHyperGraph({
  //   originalGraph,
  //   communities,
  // }: {
  //   originalGraph: CommunicationGraph;
  //   communities: NodeCommunities;
  // }): CommunicationGraph {

  //   /**
  //     The merged graph contains a hypernode for each community
  //     In the merging process, we do the following:
  //     - Create a hypernode for each community
  //     - Add the nodes of the community to the hypernode (sum up the scores)
  //     - Add the links between the hypernodes based on the links between the nodes in the communities
  //   */

  //   const hyperNodes: CommunicationNode[] = [];

  //   // Create a hypernode for each community
  //   communities.communities.forEach((community, i) => {
  //     const nodesInComm = community.nodeIds.map(id => originalGraph.getNode(id)!);
  //     const hyperNode = new HyperNode(`__hypernode_${i}`);
  //     hyperNode.topics = [];
  //     hyperNode.data = {
  //       communityId: i,
  //     };
  //   });


  //   const mergedGraph = new CommunicationGraph(
  //     hyperNodes,
  //     originalGraph.channels,
  //   );

  //   return mergedGraph;
  // }

}
