from __future__ import annotations

import random

import networkx as nx
from flask import Flask, jsonify, request
from flask_cors import CORS

from commgraph_backend.communities.community_detection_methods import community_methods_config
from commgraph_backend.generator.generator import CommGraphGenerator
from commgraph_backend.generator.generator_methods import generator_methods_config
from commgraph_backend.noderank.node_rank_methods import node_rank_methods_config

app = Flask(__name__)
CORS(app)

MAX_NODES = 1000


@app.route("/generate/methods", methods=["GET"])
def get_methods():
    # Drop method references from config
    # Deep copy to avoid modifying the original config
    methods_config_copy = {k: v.copy() for k, v in generator_methods_config.items()}
    for method in methods_config_copy.values():
        method.pop("method", None)

    return jsonify(methods_config_copy)


@app.route("/generate/<generator>", methods=["GET"])
def generate_graph(generator):
    if generator not in generator_methods_config:
        return jsonify({"error": "Unknown generator"}), 400

    params = {}
    # for param_name, param_config in generator_methods_config[generator]['params'].items():
    for param_config in generator_methods_config[generator]["params"]:
        param_name = param_config["key"]
        param_value = request.args.get(param_name)
        if param_value is None:
            # Use default value if parameter is missing
            if "default" in param_config:
                param_value = param_config["default"]
            else:
                return jsonify({"error": f"Missing parameter: {param_name}"}), 400

        # Convert parameter value to correct type
        if param_value is not None and param_config["type"] != "str":
            if param_config["type"] == "int":
                param_value = int(param_value)
            elif param_config["type"] == "float":
                param_value = float(param_value)

            # Check if parameter value is within valid range
            if "range" in param_config and not (param_config["range"][0] <= param_value <= param_config["range"][1]):
                return jsonify({"error": f"Parameter {param_name} out of range"}), 400

        params[param_name] = param_value

    graph = generator_methods_config[generator]["method"](**params)
    data = nx.node_link_data(graph)
    return jsonify(data)


@app.route("/analyze/communities/methods", methods=["GET"])
def get_community_methods():
    # Drop method references from config
    # Deep copy to avoid modifying the original config
    community_methods_config_copy = {k: v.copy() for k, v in community_methods_config.items()}
    for method in community_methods_config_copy.values():
        method.pop("method", None)

    return jsonify(community_methods_config_copy)


@app.route("/analyze/communities/<method>", methods=["POST"])
def analyze_communities(method):
    # Get the body of the request
    data = request.get_json()
    # print(data)

    if method not in community_methods_config:
        return jsonify({"error": "Unknown method"}), 400

    params = {}
    for param in community_methods_config[method]["params"]:
        param_value = request.args.get(param["key"])
        if param_value is None:
            # Use default value if parameter is missing
            if "default" in param:
                param_value = param["default"]
            else:
                return jsonify({"error": f"Missing parameter: {param['key']}"}), 400

        # Convert parameter value to correct type
        if param_value is not None and param["type"] != "str":
            if param["type"] == "int":
                param_value = int(param_value)
            elif param["type"] == "float":
                param_value = float(param_value)

            # Check if parameter value is within valid range
            if "range" in param and not (param["range"][0] <= param_value <= param["range"][1]):
                return jsonify({"error": f"Parameter {param['key']} out of range"}), 400

        params[param["key"]] = param_value

    data = request.get_json()
    graph = nx.node_link_graph(data)
    result = community_methods_config[method]["method"](graph, **params)
    # print(result)

    # Convert sets in the result to lists
    result = [list(community) for community in result]

    return jsonify(result)


@app.route("/analyze/noderank/methods", methods=["GET"])
def get_noderank_methods():
    # Drop method references from config
    # Deep copy to avoid modifying the original config
    noderank_methods_config_copy = {k: v.copy() for k, v in node_rank_methods_config.items()}
    for method in noderank_methods_config_copy.values():
        method.pop("method", None)

    return jsonify(noderank_methods_config_copy)


@app.route("/analyze/noderank/<method>", methods=["POST"])
def analyze_noderank(method):
    # Get the body of the request
    data = request.get_json()
    # print(data)

    if method not in node_rank_methods_config:
        return jsonify({"error": "Unknown method"}), 400

    params = {}
    for param in node_rank_methods_config[method]["params"]:
        param_value = request.args.get(param["key"])
        if param_value is None:
            # Use default value if parameter is missing
            if "default" in param:
                param_value = param["default"]
            else:
                return jsonify({"error": f"Missing parameter: {param['key']}"}), 400

        # Convert parameter value to correct type
        if param_value is not None and param["type"] != "str":
            if param["type"] == "int":
                param_value = int(param_value)
            elif param["type"] == "float":
                param_value = float(param_value)

            # Check if parameter value is within valid range
            if "range" in param and not (param["range"][0] <= param_value <= param["range"][1]):
                return jsonify({"error": f"Parameter {param['key']} out of range"}), 400

        params[param["key"]] = param_value

    data = request.get_json()
    graph = nx.node_link_graph(data)
    result = node_rank_methods_config[method]["method"](graph, **params)
    # print(result)

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)
