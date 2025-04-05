import json
import os
from typing import Any

import networkx as nx

from viscom_backend.commgraph.converter import convert_node_connections_graph_to_topic_graph


class RosMetaSysGraphGenerator:
    @staticmethod
    def get_available_datasets(return_full_path=False):
        datasets = []

        # Search for all jsons in the ./datasets folder
        # Get the path relative to this reader.py file
        path = os.path.join(os.path.dirname(__file__), "datasets")

        for file in os.listdir(path):
            if file.endswith(".json"):
                datasets.append(file)

        if return_full_path:
            return [os.path.join(path, dataset) for dataset in datasets]

        return datasets

    @staticmethod
    def extent_generator_methods(generator_methods_config: dict[str, Any]):
        datasets = RosMetaSysGraphGenerator.get_available_datasets()
        for dataset in datasets:

            def callback(dataset=dataset, **kwargs):
                print(f"Reading dataset {dataset} with kwargs {kwargs}")
                graph = RosMetaSysGraphGenerator.read_graph_from_file(os.path.join(os.path.dirname(__file__), "datasets", dataset), **kwargs)
                # return convert_to_weighted_graph(graph)
                return graph

            is_synthetic = True

            # "is_synthetic": false,
            # "nodes": [
            # Parse the json file to check, if it has the "is_synthetic" key

            with open(os.path.join(os.path.dirname(__file__), "datasets", dataset)) as file:
                data = json.load(file)
                is_synthetic = data.get("is_synthetic", True)

            generator_methods_config[dataset] = {
                "params": [
                    # {
                    #     "key": "return_topic_graph",
                    #     "type": "boolean",
                    #     "default": False,
                    #     "description": "Return a topic graph instead of a node graph.",
                    # }
                ],
                "description": "A communication graph generated from a ROS meta system description.",
                "is_saved_dataset": True,
                "is_synthetic": is_synthetic,
                # "method": create_lambda(),
                "method": callback,
            }

    @staticmethod
    def read_graph_from_file(file_path: str, return_topic_graph: bool = False) -> nx.MultiDiGraph:
        with open(file_path) as file:
            data = json.load(file)

        graph = nx.MultiDiGraph()

        # Meta information
        node_count = data.get("nodeCount", 0)
        author = data.get("author", "")
        description = data.get("description", "")

        # Add nodes
        # Also store topic information to be able to add edges later
        publisher_name_to_nodes: dict[str, list[str]] = {}
        subscriber_name_to_nodes: dict[str, list[str]] = {}
        service_name_to_nodes: dict[str, list[str]] = {}
        client_name_to_nodes: dict[str, list[str]] = {}

        topic_to_type: dict[str, str] = {}

        for node_data in data.get("nodes", []):
            node_name = node_data["name"]
            node_namespace: str = node_data["namespace"]
            if not node_namespace.endswith("/"):
                node_namespace += "/"
            node_name = f"{node_namespace}{node_name}" if node_namespace != "/" else node_name
            graph.add_node(node_name)

            # print(node_data)

            for topic in node_data["publishers"]:
                topic_name = topic["name"]
                topic_type = topic.get("type", "std_msgs/msg/Empty")
                topic_to_type[topic_name] = topic_type

                if topic_name not in publisher_name_to_nodes:
                    publisher_name_to_nodes[topic_name] = []
                publisher_name_to_nodes[topic_name].append(node_name)

            for topic in node_data["subscribers"]:
                topic_name = topic["name"]
                topic_type = topic.get("type", "std_msgs/msg/Empty")
                topic_to_type[topic_name] = topic_type

                if topic_name not in subscriber_name_to_nodes:
                    subscriber_name_to_nodes[topic_name] = []
                subscriber_name_to_nodes[topic_name].append(node_name)

            for topic in node_data["services"]:
                topic_name = topic["name"]
                topic_type = topic.get("type", "std_msgs/msg/Empty")
                topic_to_type[topic_name] = topic_type

                if topic_name not in service_name_to_nodes:
                    service_name_to_nodes[topic_name] = []
                service_name_to_nodes[topic_name].append(node_name)

            for topic in node_data["clients"]:
                topic_name = topic["name"]

                topic_type = topic.get("type", "std_msgs/msg/Empty")
                topic_to_type[topic_name] = topic_type

                if topic_name not in client_name_to_nodes:
                    client_name_to_nodes[topic_name] = []
                client_name_to_nodes[topic_name].append(node_name)

        # Add pub/sub edges
        for pub_topic, pub_nodes in publisher_name_to_nodes.items():
            sub_nodes = subscriber_name_to_nodes.get(pub_topic, [])
            for pub_node in pub_nodes:
                for sub_node in sub_nodes:
                    graph.add_edge(pub_node, sub_node, pub_topic=pub_topic, topic_type=topic_to_type.get(pub_topic, "std_msgs/msg/Empty"))

        # Add service edges
        for service_name, service_nodes in service_name_to_nodes.items():
            client_nodes = client_name_to_nodes.get(service_name, [])
            for service_node in service_nodes:
                for client_node in client_nodes:
                    graph.add_edge(client_node, service_node, service_name=service_name, topic_type=topic_to_type.get(service_name, "std_msgs/msg/Empty"))

        # graph = nx.node_link_graph(data)

        if return_topic_graph:
            return convert_node_connections_graph_to_topic_graph(graph)

        return graph
