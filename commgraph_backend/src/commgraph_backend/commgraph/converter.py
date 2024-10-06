from __future__ import annotations

import math

import networkx as nx


def get_topic_name(topic_type: str, topic_name: str) -> str:
    return f"{topic_type}/{topic_name}"


def convert_normal_graph_to_commgraph(graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
    """This convert method adds topics to the connections of a normal graph."""

    new_graph = nx.MultiDiGraph()

    # For each connection, add a pub_topic 
    for start_node, connections in graph.adjacency():
        for target_node, data in connections.items():
            new_graph.add_edge(start_node, target_node, pub_topic=f"{start_node}->{target_node}")

    return new_graph

def convert_node_connections_graph_to_topic_graph(graph: nx.MultiDiGraph, directed=True, reversed=False) -> nx.DiGraph:
    """
    Convert a node connections graph to a topic graph.
    """
    topic_graph = nx.DiGraph()

    node_set = set(graph.nodes())
    map_topic_to_use_count: dict[str, int] = dict()

    # Iter over all nodes and their connections
    for node, connections in graph.adjacency():
        for connection, topic_data in connections.items():
            # print(node, connection, topic_data)

            node_set.add(node)

            for topic_map in topic_data.values():
                for topic_type, topic in topic_map.items():
                    topic_name = get_topic_name(topic_type, topic)
                    map_topic_to_use_count[topic_name] = map_topic_to_use_count.get(topic_name, 0) + 1

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

                    # Half the count
                    count = count / 2

                    if not reversed:
                        topic_graph.add_edge(start_node, topic_name, distance=count)
                        topic_graph.add_edge(topic_name, target_node, distance=count)

                        if not directed:
                            topic_graph.add_edge(target_node, topic_name, distance=count)
                            topic_graph.add_edge(topic_name, start_node, distance=count)
                    else:
                        topic_graph.add_edge(target_node, topic_name, distance=count)
                        topic_graph.add_edge(topic_name, start_node, distance=count)

                        if not directed:
                            topic_graph.add_edge(start_node, topic_name, distance=count)
                            topic_graph.add_edge(topic_name, target_node, distance=count)
    return topic_graph


def convert_to_weighted_graph(node_graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
    topic_graph = convert_node_connections_graph_to_topic_graph(node_graph)
    weighted_graph = nx.MultiDiGraph()

    # For each connection of a node, get the distance in the topic graph and add it as weight
    for start_node, connections in node_graph.adjacency():
        for target_node, topic_data in connections.items():
            for topic_map in topic_data.values():
                for topic_type, topic in topic_map.items():
                    topic_name = get_topic_name(topic_type, topic)

                    # Get the distance in the topic graph
                    distance = topic_graph[start_node][topic_name]["distance"] * 2
                    # weighted_graph.add_edge(start_node, target_node, distance=distance, weight=math.sqrt(1 / distance), topic=topic)
                    # weighted_graph.add_edge(start_node, target_node, distance=distance, weight=math.sqrt(1 / distance), **{topic_type: topic})
                    weighted_graph.add_edge(start_node, target_node, distance=distance, weight=math.sqrt(1 / distance), **{topic_type: topic})
                    # weighted_graph.add_edge(start_node, target_node, distance=distance, weight=1)

    return weighted_graph
