from __future__ import annotations

import math

import networkx as nx


def get_topic_name(topic_type: str, topic_name: str) -> str:
    return f"{topic_type}/{topic_name}"


def convert_normal_graph_to_commgraph(graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
    """This convert method adds topics to the connections of a normal graph."""

    new_graph = nx.MultiDiGraph()
    new_graph.add_nodes_from(graph.nodes(data=True))

    # print("Converting normal graph to commgraph...")
    # print("Nodes in the graph:", len(graph.nodes), graph.nodes)
    # print("Edges in the graph:", len(graph.edges), graph.edges)

    # # Print all nodes and their data
    # for node in graph.nodes:
    #     print(f"Node {node}:")
    #     for key, data in graph.nodes[node].items():
    #         print("\t", key, data)
    # print("--------------------------------------------------")

    # # Print all node pairs and their edges (also multiple edges)
    # # Also print the data of the edges
    # for node in graph.nodes:
    #     print(f"Node {node}:")
    #     for edge in graph.edges(node, data=True):
    #         print("\t", edge)
    # print("--------------------------------------------------")

    # For each connection, add a pub_topic if none exists
    for start_node, connections in graph.adjacency():
        for target_node, edge_dict in connections.items():
            # If the graph is a multigraph, we need to handle multiple edges
            if graph.is_multigraph():
                edge_dict_items = list(edge_dict.items())
            else:
                edge_dict_items = [(0, edge_dict)]

            for key, data in edge_dict_items:
                if "topic" in data:
                    # Use the existing topic if available
                    new_graph.add_edge(
                        start_node,
                        target_node,
                        key=key,  # Preserve the edge key
                        pub_topic=data["topic"],
                        **{k: v for k, v in data.items() if k != "topic"},
                    )
                    # print(f"Adding edge from {start_node} to {target_node} with topic {data['topic']} and key {key}")
                else:
                    # Generate a default topic name if none exists
                    new_graph.add_edge(
                        start_node,
                        target_node,
                        key=key,  # Preserve the edge key
                        pub_topic=f"{start_node}->{target_node}-{key}",  # Include key in the topic
                        **data,
                    )
                    # print(f"Adding edge from {start_node} to {target_node} with default topic {start_node}->{target_node}-{key}")

    return new_graph


def convert_node_connections_graph_to_topic_graph(graph: nx.MultiDiGraph, directed=True, reversed=False) -> nx.DiGraph:
    """
    Convert a node connections graph to a topic graph.
    """
    topic_graph = nx.DiGraph()

    node_set = set(graph.nodes())
    map_topic_to_use_count: dict[str, int] = dict()

    # print("\n\n[CONVERT TO TOPIC GRAPH] ####################################")
    # print("Original graph:")
    # for node in graph.nodes:
    #     print("\t", node)
    #     for edge in graph.edges(node, data=True):
    #         print("\t\t", edge)

    # Iter over all nodes and their connections
    for node, connections in graph.adjacency():
        for connection, topic_data in connections.items():
            # print(node, connection, topic_data)

            node_set.add(node)

            for topic_map in topic_data.values():
                for topic_type, topic in topic_map.items():
                    if topic_type == "distance" or topic_type == "weight":
                        continue

                    topic_name = get_topic_name(topic_type, topic)
                    map_topic_to_use_count[topic_name] = map_topic_to_use_count.get(topic_name, 0) + 1

    for node in node_set:
        topic_graph.add_node(node, type="node")

    for topic in map_topic_to_use_count:
        topic_graph.add_node(topic, type="topic")

    # for topic in map_topic_to_use_count:
    #     print(f"Topic {topic} has {map_topic_to_use_count[topic]} uses")

    for start_node, connections in graph.adjacency():
        for target_node, topic_data in connections.items():
            for topic_map in topic_data.values():
                for topic_type, topic in topic_map.items():
                    topic_name = get_topic_name(topic_type, topic)

                    if topic_name not in topic_graph.nodes:
                        continue

                    count = float(map_topic_to_use_count[topic_name])

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

    # print("\n\n[TOPIC GRAPH] ####################################")
    # for node in topic_graph.nodes:
    #     print("\t", node)
    #     for edge in topic_graph.edges(node):
    #         print("\t\t", edge, topic_graph.get_edge_data(*edge))

    return topic_graph


def convert_to_weighted_graph(node_graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
    topic_graph = convert_node_connections_graph_to_topic_graph(node_graph)
    weighted_graph = nx.MultiDiGraph()

    # For each connection of a node, get the distance in the topic graph and add it as weight
    for start_node, connections in node_graph.adjacency():
        for target_node, topic_data in connections.items():
            for topic_map in topic_data.values():
                # If there is weight and distance present, use it
                if "weight" in topic_map and "distance" in topic_map:
                    distance = topic_map["distance"]
                    weight = topic_map["weight"]
                    data = {key: value for key, value in topic_map.items() if key not in ["weight", "distance"]}
                    weighted_graph.add_edge(start_node, target_node, distance=distance, weight=weight, **data)
                    continue

                for topic_type, topic in topic_map.items():
                    topic_name = get_topic_name(topic_type, topic)

                    # Get the distance in the topic graph
                    distance = topic_graph[start_node][topic_name]["distance"]

                    # weighted_graph.add_edge(start_node, target_node, distance=distance, weight=math.sqrt(1 / distance), topic=topic)
                    # weighted_graph.add_edge(start_node, target_node, distance=distance, weight=math.sqrt(1 / distance), **{topic_type: topic})
                    weight = math.sqrt(1 / distance)
                    weighted_graph.add_edge(start_node, target_node, distance=distance, weight=weight, **{topic_type: topic})
                    # weighted_graph.add_edge(start_node, target_node, distance=distance, weight=1)

    # print("\n\n[CONV] WEIGHTED GRAPH ####################################")

    # for node in weighted_graph.nodes:
    #     print(node)
    #     for edge in weighted_graph.edges(node):
    #         print("\t", edge, edge)

    return weighted_graph


def convert_multigraph_to_normal_graph(graph: nx.MultiDiGraph) -> nx.DiGraph:
    """This convert method removes the topics from the connections of a commgraph and creates a normal graph."""

    weighted_graph = convert_to_weighted_graph(graph)

    H = nx.DiGraph()
    H.add_nodes_from(weighted_graph)
    for u, v, wt in weighted_graph.edges(data="weight", default=1):
        if H.has_edge(u, v):
            H[u][v]["weight"] += wt
        else:
            H.add_edge(u, v, weight=wt)

    # Also recalculating the distance
    for edge in H.edges(data=True):
        H[edge[0]][edge[1]]["distance"] = 1 / (edge[2]["weight"] ** 2)

    return H
