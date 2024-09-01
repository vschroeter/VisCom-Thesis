from __future__ import annotations

from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx
import random

from commgraph_gen.comm_graph.generator import CommGraphGenerator

app = Flask(__name__)
CORS(app)

MAX_NODES = 1000



# Configuration of available methods and their parameters
methods_config = {
    "r-ary_tree": {
        "params": {
            "r": {"type": "int", "description": "Branching factor of the tree", "range": [1, 10], "default": 2},
            "n": {"type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10}
        },
        "description": "Creates a full r-ary tree of n nodes.",
        "method": nx.full_rary_tree
    },
    "watts_strogatz": {
        "params": {
            "n": {"type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10},
            "k": {"type": "int", "description": "Each node is connected to k nearest neighbors in ring topology", "range": [1, 10], "default": 4},
            "p": {"type": "float", "description": "Probability of rewiring each edge", "range": [0.0, 1.0], "default": 0.1},
            "seed": {"type": "int", "description": "Seed for random number generator", "range": [0, 2**32 - 1], "default": None}
        },
        "description": "Generates a Watts-Strogatz small-world graph.",
        "method": nx.watts_strogatz_graph
    },
    "barabasi_albert": {
        "params": {
            "n": {"type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10},
            "m": {"type": "int", "description": "Number of edges to attach from a new node to existing nodes", "range": [1, 10], "default": 2},
            "seed": {"type": "int", "description": "Seed for random number generator", "range": [0, 2**32 - 1], "default": None}
        },
        "description": "Generates a Barabási-Albert preferential attachment graph.",
        "method": nx.barabasi_albert_graph
    },
    "random_graph": {
        "params": {
            "n": {"type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 10},
            "p": {"type": "float", "description": "Probability for edge creation", "range": [0.0, 1.0], "default": 0.1},
        },
        "description": "Generates a random graph using the Erdős-Rényi model.",
        "method": nx.gnp_random_graph
    },
    "communication_graph": {
        "params": {
            "node_count": {"type": "int", "description": "Number of nodes", "range": [1, MAX_NODES], "default": 5},
            "seed": {"type": "int", "description": "Seed for random number generator", "range": [0, 2**32 - 1], "default": "55"},
            "pipeline_length_mu": {"type": "str", "description": "Mean of the pipeline length distribution", "default": "4"},
            "pipeline_length_deviation": {"type": "str", "description": "Standard deviation of the pipeline length distribution", "default": "4"},
            "pipeline_min_len": {"type": "str", "description": "Minimum length of the pipeline", "default": "3"},
            "forward_edge_probability": {"type": "str", "description": "Probability to generate a forward edge inside a pipeline", "default": "0.5"},
        },
        "description": "Generates a random graph using the Erdős-Rényi model.",
        "method": CommGraphGenerator().generate
    },
}

@app.route('/generate/methods', methods=['GET'])
def get_methods():
    # Drop method references from config
    # Deep copy to avoid modifying the original config
    methods_config_copy = {k: v.copy() for k, v in methods_config.items()}
    for method in methods_config_copy.values():
        method.pop("method", None)

    return jsonify(methods_config_copy)

@app.route('/generate/<generator>', methods=['GET'])
def generate_graph(generator):
    if generator not in methods_config:
        return jsonify({"error": "Unknown generator"}), 400
    
    params = {}
    for param_name, param_config in methods_config[generator]['params'].items():
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
            if 'range' in param_config:
                if not (param_config['range'][0] <= param_value <= param_config['range'][1]):
                    return jsonify({"error": f"Parameter {param_name} out of range"}), 400
        
        params[param_name] = param_value
    
    graph = methods_config[generator]['method'](**params)
    data = nx.node_link_data(graph)
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)