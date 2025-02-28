import json

import networkx as nx


def graph_to_json(graph):
    """Converts a NetworkX graph to a JSON string."""
    nl_data = nx.node_link_data(graph, edges="links")
    return nl_data


def json_to_graph(json_str):
    """Converts a JSON string to a NetworkX graph."""
    nl_data = json.loads(json_str)
    return nx.node_link_graph(nl_data)
