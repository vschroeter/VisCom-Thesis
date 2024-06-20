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

export type CommunicationDirection = "incoming" | "outgoing" | "bidirectional"
export const CommunicationDirectionPendant = {
    incoming: "outgoing" as CommunicationDirection,
    outgoing: "incoming" as CommunicationDirection,
    bidirectional: "bidirectional" as CommunicationDirection
}

export class CommunicationTopic {
    /** The name of the topic */
    id: string;

    /** The channel of the topic */
    channel: CommunicationChannel;

    /** The type of the message */
    messageType: MessageType;

    /** The direction of the topic */
    direction: CommunicationDirection;

    constructor(id: string, channel: CommunicationChannel, messageType: MessageType, direction: CommunicationDirection) {
        this.id = id;
        this.channel = channel;
        this.messageType = messageType;
        this.direction = direction;
    }
}

export class CommunicationNode {
    id: string;
    topics: CommunicationTopic[] = [];

    constructor(id: string) {
        this.id = id;
    }
}

export class CommunicationChannel {
    type: string;
    // directed: boolean;
    constructor(type: string) {
        this.type = type;
    }
}

export class TopicToNodeMap {
    channel: CommunicationChannel;
    outgoing: Map<string, CommunicationNode[]> = new Map<string, CommunicationNode[]>();
    incoming: Map<string, CommunicationNode[]> = new Map<string, CommunicationNode[]>();
    bidirectional: Map<string, CommunicationNode[]> = new Map<string, CommunicationNode[]>();
    all: Map<string, CommunicationNode[]> = new Map<string, CommunicationNode[]>();

    constructor(channel: CommunicationChannel) {
        this.channel = channel;
    }
}

export class CommunicationChannelGraphs {
    channel: CommunicationChannel;
    outgoing: Graph;
    incoming: Graph;
    bidirectional: Graph;
    all: Graph;

    constructor(channel: CommunicationChannel) {
        this.channel = channel;
        this.outgoing = createGraph({ multigraph: true });
        this.incoming = createGraph({ multigraph: true });
        this.bidirectional = createGraph({ multigraph: true });
        this.all = createGraph({ multigraph: true });
    }

    addNode(nodeId: string, node: CommunicationNode) {
        this.outgoing.addNode(nodeId, node);
        this.incoming.addNode(nodeId, node);
        this.bidirectional.addNode(nodeId, node);
        this.all.addNode(nodeId, node);
    }
}

export class ChannelGraphLinkData {
    constructor(public topic: CommunicationTopic, public channel: CommunicationChannel) { }
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
    // channelMapsByType: Map<string, Map<string, CommunicationNode[]>>;
    topicToNodeMapsByChannelType: Map<string, TopicToNodeMap>;

    /**
     * Map for <channelType, Graph>
     */
    graphsByChannelType: Map<string, CommunicationChannelGraphs>

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
        this.topicToNodeMapsByChannelType = new Map<string, TopicToNodeMap>();
        this.graphsByChannelType = new Map<string, CommunicationChannelGraphs>();

        // Init the channels
        channels.forEach((channel) => {
            this.channelsByType.set(channel.type, channel);
            // this.channelMapsByType.set(channel.type, new Map<string, CommunicationNode[]>());
            this.topicToNodeMapsByChannelType.set(channel.type, new TopicToNodeMap(channel));
        });

        // Init the channel type maps
        this.nodes.forEach((node) => {

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

        // Init the graphs
        this.channels.forEach((channel) => {
            this.graphsByChannelType.set(channel.type, new CommunicationChannelGraphs(channel));
        });

        // Add the nodes to the graphs
        this.nodes.forEach((node) => {
            // Each node is part of each graph
            this.graphsByChannelType.forEach((graph) => {
                graph.addNode(node.id, node);
            });

            node.topics.forEach((topic) => {
                const channelType = topic.channel.type;
                const graphs = this.graphsByChannelType.get(channelType)!;
                const topicMap = this.getTopicToNodeMapByChannelType(channelType);


                // Adding links to the graph representing the direction of the topic
                const graph = graphs[topic.direction];

                // To add the links from the current node to destination nodes,
                // we get all nodes that have the pendant direction of the same topic
                const directionTopicMap = topicMap[CommunicationDirectionPendant[topic.direction]].get(topic.id) || [];

                // For each destination node, add a link
                directionTopicMap.forEach((destinationNode) => {
                    graph.addLink(node.id, destinationNode.id);
                });

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

    getTopicToNodeMapByChannelType(channelType: string): TopicToNodeMap {
        this._checkIfChannelTypeExists(channelType);
        return this.topicToNodeMapsByChannelType.get(channelType)!;
    }

}




