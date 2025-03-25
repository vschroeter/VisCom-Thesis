from __future__ import annotations

import networkx as nx
from flask import Flask, jsonify, request
from flask_cors import CORS
from typing import Dict, List, Any, Tuple, Optional, Callable

from viscom_backend.commgraph.converter import convert_multigraph_to_normal_graph, convert_to_weighted_graph
from viscom_backend.communities.community_detection_methods import community_methods_config
from viscom_backend.data.reader import RosMetaSysGraphGenerator
from viscom_backend.generator.generator_methods import generator_methods_config
from viscom_backend.noderank.commgraph_centrality import calculate_commgraph_centrality
from viscom_backend.noderank.node_rank_methods import node_rank_methods_config
from viscom_backend.metrics.metrics_calculator import calculate_metrics, convert_dict_to_laid_out_data, MetricResult, AVAILABLE_METRICS

app = Flask(__name__)
CORS(app)

MAX_NODES: int = 1000

import inspect

def has_param(func: Callable, param_name: str) -> bool:
    sig = inspect.signature(func)
    return param_name in sig.parameters


def convert_param(param_config: Dict[str, Any], param_value: Any) -> Any:
    if param_config["type"] == "int":
        return int(param_value)
    elif param_config["type"] == "float":
        return float(param_value)
    elif param_config["type"] == "boolean":
        return param_value.lower() == "true" or param_value == "1" or param_value.lower() == "yes"
    else:
        return param_value


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
        param_value = convert_param(param_config, param_value)

        # Check if parameter value is within valid range
        if "range" in param_config and not (param_config["range"][0] <= param_value <= param_config["range"][1]):
            return jsonify({"error": f"Parameter {param_name} out of range"}), 400

        params[param_name] = param_value

    graph = generator_methods_config[generator]["method"](**params)

    # Get also the commgraph node rank for each node in the generated graph
    # print("[GEN] Calculating commgraph centrality ####################################")
    # weighted_graph = convert_to_weighted_graph(graph)
    centrality = calculate_commgraph_centrality(graph, mode="significance")
    # centrality = calculate_commgraph_centrality(weighted_graph, mode="significance")
    # centrality = calculate_commgraph_centrality(graph, mode="closeness")
    # centrality = calculate_commgraph_centrality(graph, mode="reachability")
    nx.set_node_attributes(graph, centrality, "commgraph_centrality")

    data = nx.node_link_data(graph, edges="links")



    return jsonify(data)


@app.route("/analyze/communities/methods", methods=["GET"])
def get_community_methods():
    RosMetaSysGraphGenerator.extent_generator_methods(generator_methods_config)

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
        param_value = convert_param(param, param_value)

        # Check if parameter value is within valid range
        if "range" in param and not (param["range"][0] <= param_value <= param["range"][1]):
            return jsonify({"error": f"Parameter {param['key']} out of range"}), 400

        params[param["key"]] = param_value

    data = request.get_json()
    graph = nx.node_link_graph(data, edges="links")
    # graph = nx.node_link_graph(data)
    weighted_graph = convert_to_weighted_graph(graph)
    # for node in weighted_graph.nodes:
    #     print(node)
    #     for edge in weighted_graph.edges(node):
    #         print("\t", edge, weighted_graph.get_edge_data(*edge)[0]["weight"])
    result = community_methods_config[method]["method"](weighted_graph, **params)
    print(result)

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
        param_value = convert_param(param, param_value)

        # Check if parameter value is within valid range
        if "range" in param and not (param["range"][0] <= param_value <= param["range"][1]):
            return jsonify({"error": f"Parameter {param['key']} out of range"}), 400

        params[param["key"]] = param_value



    data = request.get_json()
    graph = nx.node_link_graph(data, directed=True, multigraph=True)
    graph = convert_to_weighted_graph(graph)

    if node_rank_methods_config[method].get("reverse_graph", False):
        graph = graph.reverse()

    # graph = graph.reverse()

    # Print the graph
    for node in graph.nodes:
        print(node)
        for edge in graph.edges(node):
            print("\t", edge, [e["distance"] for e in graph.get_edge_data(*edge).values()])

    if node_rank_methods_config[method].get("convert_to_simple_graph", False):
        graph = convert_multigraph_to_normal_graph(graph)

    # Check if the method has a distance parameter
    method_cb = node_rank_methods_config[method]["method"]

    if (d := node_rank_methods_config[method].get("distance", None)) is not None and has_param(method_cb, "distance"):
        params["distance"] = d

    if (w := node_rank_methods_config[method].get("weight", None)) is not None and has_param(method_cb, "weight"):
        params["weight"] = w

    print(params)
    result = method_cb(graph, **params)
    # print(result)

    # Normalize the result
    max_value = max(result.values())
    result = {node: value / max_value for node, value in result.items()}

    for node, value in result.items():
        print(node, value)

    return jsonify(result)


@app.route("/metrics/calculate", methods=["POST"])
def calculate_metrics_endpoint():
    """Calculate all metrics for a graph layout."""
    try:
        data_dict: Dict[str, Any] = request.get_json()
        if not data_dict or "nodes" not in data_dict or "links" not in data_dict:
            return jsonify({"error": "Invalid data format"}), 400

        # Convert dictionary to proper data class
        laid_out_data = convert_dict_to_laid_out_data(data_dict)

        # Calculate all metrics
        metrics_results: List[MetricResult] = calculate_metrics(laid_out_data)
        return jsonify([metric.__dict__ for metric in metrics_results])
    except Exception as e:
        return jsonify({"error": f"Error calculating metrics: {str(e)}"}), 500


@app.route("/metrics/calculate/<method>", methods=["POST"])
def calculate_specific_metric_endpoint(method: str):
    """Calculate a specific metric for a graph layout."""
    try:
        data_dict: Dict[str, Any] = request.get_json()
        if not data_dict or "nodes" not in data_dict or "links" not in data_dict:
            return jsonify({"error": "Invalid data format"}), 400

        # Check if the requested metric exists
        if method not in AVAILABLE_METRICS:
            return jsonify({"error": f"Unknown metric method: {method}"}), 400

        # Convert dictionary to proper data class
        laid_out_data = convert_dict_to_laid_out_data(data_dict)

        # Calculate the specific metric
        metrics_results: List[MetricResult] = calculate_metrics(laid_out_data, method=method)

        # Return the first (and only) result
        if metrics_results:
            return jsonify(metrics_results[0].__dict__)
        else:
            return jsonify({"error": "No metric result was generated"}), 500
    except Exception as e:
        return jsonify({"error": f"Error calculating metric {method}: {str(e)}"}), 500


@app.route("/metrics/methods", methods=["GET"])
def get_available_metrics():
    """Get a list of all available metrics."""
    metric_info = {}

    for method_name, calculator_class in AVAILABLE_METRICS.items():
        metric_info[method_name] = {
            "name": method_name,
            "description": calculator_class.__doc__
        }

    return jsonify(metric_info)


if __name__ == "__main__":
    app.run(debug=True)
