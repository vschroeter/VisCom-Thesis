from __future__ import annotations

import random

import networkx as nx
from flask import Flask, jsonify, request
from flask_cors import CORS

from commgraph_gen.comm_graph.generator import CommGraphGenerator
from commgraph_gen.generator_methods import generator_methods_config

app = Flask(__name__)
CORS(app)

MAX_NODES = 1000


# Configuration of available methods and their parameters
# methods_config = {



#     # "r-ary_tree": {
#     #     "params": {
#     #         "r": {"type": "int", "description": "Branching factor of the tree", "range": [1, 10], "default": 2},
#     #         "n": {"type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10}
#     #     },
#     #     "description": "Creates a full r-ary tree of n nodes.",
#     #     "method": nx.full_rary_tree
#     # },
#     # "watts_strogatz": {
#     #     "params": {
#     #         "n": {"type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10},
#     #         "k": {"type": "int", "description": "Each node is connected to k nearest neighbors in ring topology", "range": [1, 10], "default": 4},
#     #         "p": {"type": "float", "description": "Probability of rewiring each edge", "range": [0.0, 1.0], "default": 0.1},
#     #         "seed": {"type": "int", "description": "Seed for random number generator", "range": [0, 2**32 - 1], "default": None}
#     #     },
#     #     "description": "Generates a Watts-Strogatz small-world graph.",
#     #     "method": nx.watts_strogatz_graph
#     # },
#     # "barabasi_albert": {
#     #     "params": {
#     #         "n": {"type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10},
#     #         "m": {"type": "int", "description": "Number of edges to attach from a new node to existing nodes", "range": [1, 10], "default": 2},
#     #         "seed": {"type": "int", "description": "Seed for random number generator", "range": [0, 2**32 - 1], "default": None}
#     #     },
#     #     "description": "Generates a Barabási-Albert preferential attachment graph.",
#     #     "method": nx.barabasi_albert_graph
#     # },
#     # "random_graph": {
#     #     "params": {
#     #         "n": {"type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10},
#     #         "p": {"type": "float", "description": "Probability for edge creation", "range": [0.0, 1.0], "default": 0.1},
#     #     },
#     #     "description": "Generates a random graph using the Erdős-Rényi model.",
#     #     "method": nx.gnp_random_graph
#     # },
#     # "communication_graph": {
#     #     "params": {
#     #         "node_count": {"type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 15},
#     #         "seed": {"type": "int", "description": "Seed for random number generator", "range": [0, 2**32 - 1], "default": "55"},
#     #         "pipeline_length_mu": {"type": "str", "description": "Mean of the pipeline length distribution", "default": "4"},
#     #         "pipeline_length_deviation": {"type": "str", "description": "Standard deviation of the pipeline length distribution", "default": "4"},
#     #         "pipeline_min_len": {"type": "str", "description": "Minimum length of the pipeline", "default": "3"},
#     #         "forward_edge_probability": {"type": "str", "description": "Probability to generate a forward edge inside a pipeline", "default": "0.0"},
#     #         "backward_edge_probability": {"type": "str", "description": "Probability to generate a backward edge inside a pipeline", "default": "0.0"},
#     #         "cross_connection_probability": {"type": "str", "description": "Probability to generate a cross connection between pipelines", "default": "0.0"},
#     #         "cross_integration_probability": {"type": "str", "description": "Probability to generate a cross integration between pipelines", "default": "0.0"},
#     #         "diamond_probability": {"type": "str", "description": "Probability to generate a diamond connection in a pipeline", "default": "0.0"},
#     #         "node_rewiring_probability": {"type": "str", "description": "Probability to rewire the connections of a node to another node in the same pipeline", "default": "0.0"},
#     #     },
#     #     "description": "Generates a random graph using the Erdős-Rényi model.",
#     #     "method": CommGraphGenerator().generate
#     # },
#     "zacharys_karate_club": {
#         "params": {},
#         "description": "Generates the Zachary's Karate Club graph.",
#         "method": nx.karate_club_graph
#     }

# }

@app.route('/generate/methods', methods=['GET'])
def get_methods():
    # Drop method references from config
    # Deep copy to avoid modifying the original config
    methods_config_copy = {k: v.copy() for k, v in generator_methods_config.items()}
    for method in methods_config_copy.values():
        method.pop("method", None)

    return jsonify(methods_config_copy)

@app.route('/generate/<generator>', methods=['GET'])
def generate_graph(generator):
    if generator not in generator_methods_config:
        return jsonify({"error": "Unknown generator"}), 400
    
    params = {}
    # for param_name, param_config in generator_methods_config[generator]['params'].items():
    for param_config in generator_methods_config[generator]['params']:
        param_name = param_config['key']
        param_value = request.args.get(param_name)
        if param_value is None:
            # Use default value if parameter is missing
            if 'default' in param_config:
                param_value = param_config['default']
            else:
                return jsonify({"error": f"Missing parameter: {param_name}"}), 400
        
        # Convert parameter value to correct type
        if param_value is not None and param_config['type'] != 'str':
            if param_config['type'] == 'int':
                param_value = int(param_value)
            elif param_config['type'] == 'float':
                param_value = float(param_value)
        
            # Check if parameter value is within valid range
            if 'range' in param_config and not (param_config['range'][0] <= param_value <= param_config['range'][1]):
                return jsonify({"error": f"Parameter {param_name} out of range"}), 400
        
        params[param_name] = param_value
    
    graph = generator_methods_config[generator]['method'](**params)
    data = nx.node_link_data(graph)
    return jsonify(data)


community_methods_config = {
    "edge_betweenness_partition": {
        "params": [
            {"key": "number_of_sets", "type": "int", "description": "Number of communities to detect", "range": [1, MAX_NODES], "default": 2}
        ],
        "description": "Partition created by iteratively removing the highest edge betweenness edge (basic Girvan-Newman algorithm).",
        "method": nx.community.edge_betweenness_partition
    },
    # "louvain": {
    #     "params": {},
    #     "description": "Detects communities in the graph using the Louvain method.",
    #     "method": nx.algorithms.community.modularity_max.greedy_modularity_communities
    # }
}

@app.route('/analyze/communities/methods', methods=['GET'])
def get_community_methods():
    # Drop method references from config
    # Deep copy to avoid modifying the original config
    community_methods_config_copy = {k: v.copy() for k, v in community_methods_config.items()}
    for method in community_methods_config_copy.values():
        method.pop("method", None)

    return jsonify(community_methods_config_copy)

@app.route('/analyze/communities/<method>', methods=['POST'])
def analyze_communities(method):

    # Get the body of the request
    data = request.get_json()
    # print(data)

    if method not in community_methods_config:
        return jsonify({"error": "Unknown method"}), 400
    
    params = {}
    for param in community_methods_config[method]['params']:
        param_value = request.args.get(param['key'])
        if param_value is None:
            # Use default value if parameter is missing
            if 'default' in param:
                param_value = param['default']
            else:
                return jsonify({"error": f"Missing parameter: {param['key']}"}), 400
        
        # Convert parameter value to correct type
        if param_value is not None and param['type'] != 'str':
            if param['type'] == 'int':
                param_value = int(param_value)
            elif param['type'] == 'float':
                param_value = float(param_value)
        
            # Check if parameter value is within valid range
            if 'range' in param and not (param['range'][0] <= param_value <= param['range'][1]):
                return jsonify({"error": f"Parameter {param['key']} out of range"}), 400
        
        params[param['key']] = param_value
    
    data = request.get_json()
    graph = nx.node_link_graph(data)
    result = community_methods_config[method]['method'](graph, **params)
    # print(result)

    # Convert sets in the result to lists
    result = [list(community) for community in result]

    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)