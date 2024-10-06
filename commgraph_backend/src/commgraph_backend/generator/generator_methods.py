from __future__ import annotations

import networkx as nx

from commgraph_backend.commgraph.converter import convert_normal_graph_to_commgraph, convert_to_weighted_graph
from commgraph_backend.data.reader import RosMetaSysGraphGenerator
from commgraph_backend.generator.generator import CommGraphGenerator

MAX_NODES = 1000


def get_nx_to_commgraph_method(nx_method):
    def nx_to_commgraph_method(*args, **kwargs):
        graph = nx_method(*args, **kwargs)
        comm_graph = convert_normal_graph_to_commgraph(graph)
        return convert_to_weighted_graph(comm_graph)
        # return comm_graph

    return nx_to_commgraph_method


def get_generator_output(graph_generator):
    def generator_output(*args, **kwargs):
        graph = graph_generator(*args, **kwargs)
        return graph
        # return convert_to_weighted_graph(graph)

    return generator_output


generator_methods_config = {
    "r-ary_tree": {
        "params": [
            {"key": "r", "type": "int", "description": "Branching factor of the tree", "range": [1, 10], "default": 2},
            {"key": "n", "type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10},
        ],
        "description": "Creates a full r-ary tree of n nodes.",
        "method": get_generator_output(get_nx_to_commgraph_method(nx.full_rary_tree)),
    },
    "watts_strogatz": {
        "params": [
            {"key": "n", "type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10},
            {"key": "k", "type": "int", "description": "Each node is connected to k nearest neighbors in ring topology", "range": [1, 10], "default": 4},
            {"key": "p", "type": "float", "description": "Probability of rewiring each edge", "range": [0.0, 1.0], "default": 0.1},
            {"key": "seed", "type": "int", "description": "Seed for random number generator", "range": [0, 2**32 - 1], "default": None},
        ],
        "description": "Generates a Watts-Strogatz small-world graph.",
        "method": get_generator_output(get_nx_to_commgraph_method(nx.watts_strogatz_graph)),
    },
    "barabasi_albert": {
        "params": [
            {"key": "n", "type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10},
            {"key": "m", "type": "int", "description": "Number of edges to attach from a new node to existing nodes", "range": [1, 10], "default": 2},
            {"key": "seed", "type": "int", "description": "Seed for random number generator", "range": [0, 2**32 - 1], "default": None},
        ],
        "description": "Generates a Barabási-Albert preferential attachment graph.",
        "method": get_generator_output(get_nx_to_commgraph_method(nx.barabasi_albert_graph)),
    },
    "random_graph": {
        "params": [
            {"key": "n", "type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10},
            {"key": "p", "type": "float", "description": "Probability for edge creation", "range": [0.0, 1.0], "default": 0.1},
        ],
        "description": "Generates a random graph using the Erdős-Rényi model.",
        "method": get_generator_output(get_nx_to_commgraph_method(nx.gnp_random_graph)),
    },
    "communication_graph": {
        "params": [
            {"key": "node_count", "type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 15},
            {"key": "seed", "type": "int", "description": "Seed for random number generator", "range": [0, 2**32 - 1], "default": "55"},
            {"key": "pipeline_length_mu", "type": "str", "description": "Mean of the pipeline length distribution", "default": "4"},
            {"key": "pipeline_length_deviation", "type": "str", "description": "Standard deviation of the pipeline length distribution", "default": "4"},
            {"key": "pipeline_min_len", "type": "str", "description": "Minimum length of the pipeline", "default": "3"},
            {"key": "forward_edge_probability", "type": "str", "description": "Probability to generate a forward edge inside a pipeline", "default": "0.0"},
            {"key": "backward_edge_probability", "type": "str", "description": "Probability to generate a backward edge inside a pipeline", "default": "0.0"},
            {"key": "cross_connection_probability", "type": "str", "description": "Probability to generate a cross connection between pipelines", "default": "0.0"},
            {"key": "cross_integration_probability", "type": "str", "description": "Probability to generate a cross integration between pipelines", "default": "0.0"},
            {"key": "diamond_probability", "type": "str", "description": "Probability to generate a diamond connection in a pipeline", "default": "0.0"},
            {
                "key": "node_rewiring_probability",
                "type": "str",
                "description": "Probability to rewire the connections of a node to another node in the same pipeline",
                "default": "0.0",
            },
        ],
        "description": "Generates a random graph using the Erdős-Rényi model.",
        "method": get_generator_output(CommGraphGenerator().generate),
    },
    "zacharys_karate_club": {
        "params": [],
        "description": "Generates the Zachary's Karate Club graph.",
        "method": get_generator_output(get_nx_to_commgraph_method(nx.karate_club_graph)),
    },
}

RosMetaSysGraphGenerator.extent_generator_methods(generator_methods_config)
