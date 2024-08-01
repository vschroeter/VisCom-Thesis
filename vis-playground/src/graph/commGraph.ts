import createGraph, { Graph } from "ngraph.graph";
import { LayoutGraph, LayoutGraphLink, LayoutGraphNode } from "./layoutGraph";


/**
 * Class representing a message type for messages sent over a topic in a communication channel.
 */
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

/**
 * The direction of a communication topic on a channel
 * The topic can communicate data on the channel either in outgoing direction (thus, publishing data), 
 * in incoming direction (thus, receiving data), or in both directions (thus, bidirectional communication).
 */
export type CommunicationDirection = "incoming" | "outgoing" | "bidirectional"
export const CommunicationDirectionPendant = {
    incoming: "outgoing" as CommunicationDirection,
    outgoing: "incoming" as CommunicationDirection,
    bidirectional: "bidirectional" as CommunicationDirection
}


/**
 * Class representing a communication topic on a communication channel.
 * Example:
 * - Node `n1` has a topic `t1` that communicates on channel `PubSub` in `outgoing` direction (so it publishes data)
 * - Node `n2` has a topic `t1` that communicates on channel `PubSub` in `incoming` direction (so it receives data)
 */
export class CommunicationTopic {
    /** The name of the topic */
    id: string;

    /** The node that the topic belongs to */
    nodeID: string;

    /** The channel of the topic */
    channel: CommunicationChannel;

    /** The type of the message */
    messageType: MessageType;

    /** The direction of the topic */
    direction: CommunicationDirection;

    /**
     * Create a new communication topic
     * @param nodeID The node that the topic belongs to
     * @param topicId The name of the topic
     * @param channel The channel of the topic
     * @param messageType The type of the message
     * @param direction The direction of the topic
     */
    constructor(nodeID: string, topicId: string, channel: CommunicationChannel, direction: CommunicationDirection, messageType: MessageType) {
        this.nodeID = nodeID;
        this.id = topicId;
        this.channel = channel;
        this.messageType = messageType;
        this.direction = direction;
    }
}


/**
 * Class representing a node in a communication graph.
 * A node can have multiple topics on different communication channels.
*/
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export class CommunicationNode<NodeData = any> {
    /** The id of the node */
    id: string;

    /** The topics of the node */
    topics: CommunicationTopic[] = [];

    /** Additional data of the node */
    data: NodeData | undefined;

    /** The graph that the node belongs to */
    graph?: CommunicationGraph<NodeData>;

    /**
     * Create a new communication node
     * @param id The id of the node
     * @param data Additional data of the node
     */
    constructor(id: string, data?: NodeData) {
        this.id = id;
        this.data = data;
    }

    /**
     * Get a list of connected nodes according to the direction and the channels.
     * @param direction 
     * @param channels 
     * @returns 
     */
    getConnectedNodes(direction: CommunicationDirection, channels?: string | string[] | CommunicationChannel[]): CommunicationNode<NodeData>[] {
        if (this.graph === undefined) {
            throw new Error("Graph not set")
        }
        return this.graph.getSuccesscorsAccordingToDirection(this, direction, channels)
    }
}

/**
 * Class representing a communication channel.
 * Your graph is defined by the channels, on which the nodes communicate via topics.
 * A channel can be of different types, e.g. PubSub, ServiceCall, ActionCall, etc.
 */
export class CommunicationChannel {
    type: string;

    /**
     * Create a new communication channel
     * @param type The type of the channel
     */
    constructor(type: string) {
        this.type = type;
    }

    toString() {
        return this.type
    }
}


/**
 * Helper class representing a mapping of topics to nodes on a specific communication channel.
 * The mapping is separated into incoming, outgoing, bidirectional, and all topics.
 */
export class TopicToNodeMap<NodeData> {
    /** The channel for all topics in this mapping */
    channel: CommunicationChannel;

    /** Mapping of topics to nodes in outgoing direction (thus, nodes publishing data on a topic on this channel) */
    outgoing: Map<string, CommunicationNode<NodeData>[]> = new Map<string, CommunicationNode<NodeData>[]>();

    /** Mapping of topics to nodes in incoming directio (thus, nodes receiving data on a topic on this channel) */
    incoming: Map<string, CommunicationNode<NodeData>[]> = new Map<string, CommunicationNode<NodeData>[]>();

    /** Mapping of topics to nodes in bidirectional direction (thus, nodes communicating data in both directions on a topic on this channel) */
    bidirectional: Map<string, CommunicationNode<NodeData>[]> = new Map<string, CommunicationNode<NodeData>[]>();

    /** Mapping of all topics to nodes on this channel */
    all: Map<string, CommunicationNode<NodeData>[]> = new Map<string, CommunicationNode<NodeData>[]>();

    directions: {
        [key in CommunicationDirection]: Map<string, CommunicationNode<NodeData>[]>;
    } = {
            incoming: this.incoming,
            outgoing: this.outgoing,
            bidirectional: this.bidirectional,
        }


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

    directions: { [key in CommunicationDirection]: Graph<any, ChannelGraphLinkData>; }

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
        }
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

export class CommunicationLink {

    /** The id of the source node */
    fromId: string
    /** The id of the target node */
    toId: string

    /** The channel of the communication */
    channel: CommunicationChannel

    /** The direction of the communication */
    direction: CommunicationDirection

    /** Reference to the communication graph to get the nodes */
    private graph: CommunicationGraph

    /**
     * Create a new communication link
     * @param fromId The id of the source node
     * @param toId The id of the target node
     * @param channel The channel of the communication
     * @param direction The direction of the communication
     * @param graph Reference to the communication graph
     */
    constructor(
        fromId: string,
        toId: string,
        channel: CommunicationChannel,
        direction: CommunicationDirection,
        graph: CommunicationGraph
    ) {
        this.fromId = fromId
        this.toId = toId
        this.channel = channel
        this.direction = direction
        this.graph = graph
    }

    /** The source node of the link */
    get fromNode(): CommunicationNode {
        return this.graph.nodesById.get(this.fromId)!
    }

    /** The target node of the link */
    get toNode(): CommunicationNode {
        return this.graph.nodesById.get(this.toId)!
    }


}

export class ChannelGraphLinkData {
    constructor(public topic: CommunicationTopic, public channel: CommunicationChannel) { }
}

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
    graphsByChannelType: Map<string, CommunicationChannelGraphs>

    /**
     * List of topics that should be hidden
     */
    hiddenTopics: RegExp[] = [];


    constructor(nodes: CommunicationNode<NodeData>[], channels: CommunicationChannel[]) {
        // Init the nodes
        // this.nodes = nodes;
        this.nodesById = new Map<string, CommunicationNode<NodeData>>();
        this.channelsByType = new Map<string, CommunicationChannel>();
        this.topicToNodeMapsByChannelType = new Map<string, TopicToNodeMap<NodeData>>();
        this.graphsByChannelType = new Map<string, CommunicationChannelGraphs>();

        // Init the channels
        channels.forEach((channel) => {
            this.channelsByType.set(channel.type, channel);
            this.topicToNodeMapsByChannelType.set(channel.type, new TopicToNodeMap(channel));
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

                directedTopicMap.get(topicId)!.push(node);
            });
        });

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

    getLayoutGraph(): LayoutGraph {

        const nodes: Map<string, LayoutGraphNode> = new Map<string, LayoutGraphNode>()
        for (const node of this.nodes) {
            nodes.set(node.id, new LayoutGraphNode(node.id, node))
        }

        const links: LayoutGraphLink[] = []
        console.log(this.channels, this.graphsByChannelType)
        this.channels.forEach((channel) => {
            this.graphsByChannelType.get(channel.type)!.outgoing.forEachLink((link) => {

                links.push(
                    new LayoutGraphLink(
                        nodes.get(link.fromId.valueOf() as string)!,
                        nodes.get(link.toId.valueOf() as string)!,
                    )
                )
            });
        });

        const layout = new LayoutGraph(Array.from(nodes.values()), links)
        return layout

    }

    ////////////////////////////////////////////////////////////////////////////
    // Internal helper methods
    ////////////////////////////////////////////////////////////////////////////

    private _checkIfChannelTypeExists(channelType: string) {
        if (!this.channelsByType.has(channelType)) {
            throw new Error(`Channel type ${channelType} not found`);
        }
    }

    getTopicToNodeMapByChannelType(channelType: string): TopicToNodeMap<NodeData> {
        this._checkIfChannelTypeExists(channelType);
        return this.topicToNodeMapsByChannelType.get(channelType)!;
    }

    private _updateLinks() {

        // Init the graphs
        this.channels.forEach((channel) => {
            this.graphsByChannelType.set(channel.type, new CommunicationChannelGraphs(channel));
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
                const directionTopicMap = topicMap[CommunicationDirectionPendant[topic.direction]].get(topic.id) || [];

                // For each destination node, add a link
                directionTopicMap.forEach((destinationNode) => {
                    graph.addLink(node.id, destinationNode.id, new ChannelGraphLinkData(topic, topic.channel));
                });
            });

        });
    }

    getNodeID(node: string | CommunicationNode<NodeData>) {
        if (typeof node === "string") {
            return node
        } else {
            return node.id
        }
    }

    getNode(nodeID: string | CommunicationNode<NodeData>) {
        if (typeof nodeID === "string") {
            return this.nodesById.get(nodeID)
        } else {
            return nodeID
        }
    }

    getChannels(channels?: CommunicationChannel[] | string[] | string): CommunicationChannel[] {
        // If no channels are set, consider all channels
        if (channels === undefined) {
            return this.channels
        } else if (typeof channels === "string") {
            return [this.channelsByType.get(channels)!]
        } else if (Array.isArray(channels)) {
            return channels.map((channel) => {
                if (typeof channel === "string") {
                    return this.channelsByType.get(channel)!
                } else {
                    return channel
                }
            })
        }
        return []
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
    getSuccesscorsAccordingToDirection(node: string | CommunicationNode<NodeData>, direction: CommunicationDirection, channels?: CommunicationChannel[] | string[] | string): CommunicationNode[] {
        const successors: CommunicationNode<NodeData>[] = []
        const addedNodes = new Set<string>()

        const nodeID = this.getNodeID(node);
        let commChannels = this.getChannels(channels);

        commChannels.forEach((channel) => {
            this.graphsByChannelType.get(channel.type)!.directions[direction].forEachLinkedNode(nodeID, (linkedNode, link) => {
                if (!this.hiddenTopics.some((regex) => { return link.data.topic.id.match(regex) })) {
                    if (!addedNodes.has(linkedNode.id as string)) {
                        addedNodes.add(linkedNode.id as string)
                        successors.push(this.nodesById.get(linkedNode.id as string)!)
                    }
                }
            }, true)
        })

        return successors
    }


    /**
     * Get the successors of a node on the given channel(s) (thus, successor nodes that receive data from the given node).
     * @param nodeID The starting node
     * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
     * @returns List of successor nodes
     */
    getSuccessors(nodeID: string | CommunicationNode<NodeData>, channels?: CommunicationChannel[] | string[]): CommunicationNode<NodeData>[] {
        return this.getSuccesscorsAccordingToDirection(nodeID, "outgoing", channels)
    }

    /**
     * Get the predecessors of a node on the given channel(s) (thus, predecessor nodes that send data to the given node).
     * @param nodeID The starting node
     * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
     * @returns List of predecessor nodes
     */
    getPredecessors(nodeID: string | CommunicationNode<NodeData>, channels?: CommunicationChannel[] | string[]): CommunicationNode<NodeData>[] {
        return this.getSuccesscorsAccordingToDirection(nodeID, "incoming", channels)
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
    getLinksAccordingToDirection(node: string | CommunicationNode<NodeData>, direction: CommunicationDirection, channels?: CommunicationChannel[] | string[] | string): CommunicationLink[] {
        const links: CommunicationLink[] = []

        const nodeID = this.getNodeID(node);
        let commChannels = this.getChannels(channels);

        commChannels.forEach((channel) => {
            this.graphsByChannelType.get(channel.type)!.directions[direction].forEachLinkedNode(nodeID, (linkedNode, link) => {
                if (!this.hiddenTopics.some((regex) => { return link.data.topic.id.match(regex) })) {
                    links.push(new CommunicationLink(link.fromId as string, link.toId as string, channel, direction, this))
                }
            }, true)
        })

        return links
    }

    /**
     * Get the links of a node on the given channel(s) (thus, links that receive data from the given node).
     * @param nodeID The starting node
     * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
     * @returns List of links
     */
    getOutgoingLinks(nodeID: string | CommunicationNode<NodeData>, channels?: CommunicationChannel[] | string[]): CommunicationLink[] {
        return this.getLinksAccordingToDirection(nodeID, "outgoing", channels)
    }

    /**
     * Get the links of a node on the given channel(s) (thus, links that send data to the given node).
     * @param nodeID The starting node
     * @param channels The communicaiton channel(s) to consider. If not set, all channels are considered.
     * @returns List of links
     */
    getIncomingLinks(nodeID: string | CommunicationNode<NodeData>, channels?: CommunicationChannel[] | string[]): CommunicationLink[] {
        return this.getLinksAccordingToDirection(nodeID, "incoming", channels)
    }


}




