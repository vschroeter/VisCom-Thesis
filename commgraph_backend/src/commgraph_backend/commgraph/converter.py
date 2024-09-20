from __future__ import annotations

import networkx as nx

# def convert_nxgraph_to_commgraph(graph):
#     """
#     Convert a networkx graph to a commgraph graph.
#     """
#     comm_graph = CommGraph()


#     comm_graph.add_nodes_from(graph.nodes(data=True))
#     comm_graph.add_edges_from(graph.edges(data=True))
#     return comm_graph


def convert_node_connections_graph_to_topic_graph(graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
    """
    Convert a node connections graph to a topic graph.
    """
    topic_graph = nx.MultiDiGraph()

    node_set = set(graph.nodes())
    map_topic_to_use_count: dict[str, int] = dict()

    def get_topic_name(topic_type: str, topic_name: str) -> str:
        return f"{topic_type}/{topic_name}"

    # Iter over all nodes and their connections
    for node, connections in graph.adjacency():
        for connection, topic_data in connections.items():
            # print(node, connection, topic_data)

            node_set.add(node)

            for topic_map in topic_data.values():
                for topic_type, topic in topic_map.items():
                    topic_name = get_topic_name(topic_type, topic)
                    map_topic_to_use_count[topic_name] = map_topic_to_use_count.get(topic_name, 0) + 1

    print(node_set)
    print(map_topic_to_use_count)

    for node in node_set:
        topic_graph.add_node(node, type="node")

    for topic in map_topic_to_use_count:
        topic_graph.add_node(topic, type="topic")

    for start_node, connections in graph.adjacency():
        for target_node, topic_data in connections.items():
            for topic_map in topic_data.values():
                for topic_type, topic in topic_map.items():
                    topic_name = get_topic_name(topic_type, topic)

                    count = map_topic_to_use_count[topic_name]

                    topic_graph.add_edge(start_node, topic_name, distance=count)
                    topic_graph.add_edge(topic_name, target_node, distance=count)

    return topic_graph
