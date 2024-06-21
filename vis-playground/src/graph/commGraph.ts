import createGraph, { Graph } from "ngraph.graph";
import { LayoutGraph, LayoutGraphLink, LayoutGraphNode } from "./layoutGraph";


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

// export class ConnectedCommunicationNodes<NodeData> {
//     channel: CommunicationChannel;
//     outgoing: CommunicationNode<NodeData>[];
//     incoming: CommunicationNode<NodeData>[];
//     bidirectional: CommunicationNode<NodeData>[];
//     all: CommunicationNode<NodeData>[];



/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export class CommunicationNode<NodeData = any> {
    id: string;
    topics: CommunicationTopic[] = [];

    data: NodeData | undefined;

    graph?: CommunicationGraph<NodeData>;

    constructor(id: string, data?: NodeData) {
        this.id = id;
        this.data = data;
    }

    getConnectedNodes(direction: CommunicationDirection, channels?: string | string[] | CommunicationChannel[]): CommunicationNode<NodeData>[] {
        if (this.graph === undefined) {
            throw new Error("Graph not set")
        }
        return this.graph.getSuccesscorsAccordingToDirection(this, direction, channels)
    }


}

export class CommunicationChannel {
    type: string;

    // directed: boolean;
    constructor(type: string) {
        this.type = type;

    }

    toString() {
        return this.type
    }
}

export class TopicToNodeMap<NodeData> {
    channel: CommunicationChannel;
    outgoing: Map<string, CommunicationNode<NodeData>[]> = new Map<string, CommunicationNode<NodeData>[]>();
    incoming: Map<string, CommunicationNode<NodeData>[]> = new Map<string, CommunicationNode<NodeData>[]>();
    bidirectional: Map<string, CommunicationNode<NodeData>[]> = new Map<string, CommunicationNode<NodeData>[]>();
    all: Map<string, CommunicationNode<NodeData>[]> = new Map<string, CommunicationNode<NodeData>[]>();

    directions: {
        [key in CommunicationDirection]: Map<string, CommunicationNode<NodeData>[]>;
    } = {
            incoming: this.incoming,
            outgoing: this.outgoing,
            bidirectional: this.bidirectional,
        }


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

    directions: { [key in CommunicationDirection]: Graph; }


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

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export class CommunicationGraph<NodeData = any> {
    /** Nodes of the graph*/
    nodes: CommunicationNode<NodeData>[] = [];

    /** Mapping node ids to nodes */
    nodesById: Map<string, CommunicationNode<NodeData>>;

    /** Channels mapping type id to the object  */
    channelsByType: Map<string, CommunicationChannel>;

    /**
     * Map for <channelType, <topic, CommunicationNode[]>>
     * e.g. <'Publisher', <'topic1', [node1, node2]>>
     */
    // channelMapsByType: Map<string, Map<string, CommunicationNode[]>>;
    topicToNodeMapsByChannelType: Map<string, TopicToNodeMap<NodeData>>;

    /**
     * Map for <channelType, Graph>
     */
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
        this.addNode(nodes);
    }

    addNode(nodes: CommunicationNode<NodeData> | CommunicationNode<NodeData>[]) {
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
                        link.data
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

    _checkIfChannelTypeExists(channelType: string) {
        if (!this.channelsByType.has(channelType)) {
            throw new Error(`Channel type ${channelType} not found`);
        }
    }

    getTopicToNodeMapByChannelType(channelType: string): TopicToNodeMap<NodeData> {
        this._checkIfChannelTypeExists(channelType);
        return this.topicToNodeMapsByChannelType.get(channelType)!;
    }

    _updateLinks() {

        // Init the graphs
        this.channels.forEach((channel) => {
            this.graphsByChannelType.set(channel.type, new CommunicationChannelGraphs(channel));
        });

        this.nodes.forEach((node) => {

            // Add the nodes to the graphs
            // Each node is part of each graph
            this.graphsByChannelType.forEach((graph) => {
                graph.addNode(node.id, node);
            });

            // Add the links between the nodes
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
    // Successor and predeccessor methods
    ////////////////////////////////////////////////////////////////////////////

    getSuccesscorsAccordingToDirection(node: string | CommunicationNode<NodeData>, direction: CommunicationDirection, channels?: CommunicationChannel[] | string[] | string): CommunicationNode[] {
        const successors: CommunicationNode<NodeData>[] = []
        const addedNodes = new Set<string>()

        let nodeID: string;
        if (typeof node !== "string") {
            nodeID = node.id
        } else {
            nodeID = node
        }

        let commChannels = new Array<CommunicationChannel>()

        if (channels === undefined) {
            commChannels = this.channels
        } else if (typeof channels === "string") {
            commChannels = [this.channelsByType.get(channels)!]
        } else if (Array.isArray(channels)) {
            commChannels = channels.map((channel) => {
                if (typeof channel === "string") {
                    return this.channelsByType.get(channel)!
                } else {
                    return channel
                }
            })
        }

        commChannels.forEach((channel) => {
            this.graphsByChannelType.get(channel.type)!.directions[direction].forEachLinkedNode(nodeID, (linkedNode, link) => {
                if (!this.hiddenTopics.some((regex) => { return link.data.topic.match(regex) })) {
                    if (!addedNodes.has(linkedNode.id as string)) {
                        addedNodes.add(linkedNode.id as string)
                        successors.push(this.nodesById.get(linkedNode.id as string)!)
                    }
                }
            }, true)
        })

        return successors
    }

    getSuccessors(nodeID: string | CommunicationNode<NodeData>, channels?: CommunicationChannel[] | string[]): CommunicationNode<NodeData>[] {
        return this.getSuccesscorsAccordingToDirection(nodeID, "outgoing", channels)
    }

    getPredecessors(nodeID: string | CommunicationNode<NodeData>, channels?: CommunicationChannel[] | string[]): CommunicationNode<NodeData>[] {
        return this.getSuccesscorsAccordingToDirection(nodeID, "incoming", channels)
    }

}




