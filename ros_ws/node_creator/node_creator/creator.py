import json
import rclpy
from rclpy.node import Node
from rclpy.publisher import Publisher
from rclpy.subscription import Subscription
from rclpy.client import Client
from rclpy.service import Service
from std_msgs.msg import Empty
from typing import Any, Dict, List

class DynamicNode(Node):
    def __init__(self, name: str, node_config: Dict[str, Any]):
        super().__init__(name)
        
        self._publishers: List[Publisher] = []
        self._subscribers: List[Subscription] = []
        self._clients: List[Client] = []
        self._services: List[Service] = []
        
        print(f"Creating node {name} with config: {node_config}")
        
        self._setup_publishers(node_config.get("publishers", []))
        self._setup_subscribers(node_config.get("subscribers", []))
        self._setup_clients(node_config.get("clients", []))
        self._setup_services(node_config.get("services", []))

        self.get_logger().info(f"Node {name} created with publishers, subscribers, clients, and services.")

    def _setup_publishers(self, publishers: List[Dict[str, str]]) -> None:
        for pub in publishers:
            topic_name = pub.get("name")
            if topic_name:
                try:
                    publisher = self.create_publisher(Empty, topic_name, 10)
                    self._publishers.append(publisher)
                    self.get_logger().info(f"Publisher created on topic: {topic_name}")
                except Exception as e:
                    pass

    def _setup_subscribers(self, subscribers: List[Dict[str, str]]) -> None:
        for sub in subscribers:
            topic_name = sub.get("name")
            if topic_name:
                try:
                    subscriber = self.create_subscription(Empty, topic_name, self._dummy_callback, 10)
                    self._subscribers.append(subscriber)
                    self.get_logger().info(f"Subscriber created on topic: {topic_name}")
                except Exception as e:
                    pass

    def _setup_clients(self, clients: List[Dict[str, str]]) -> None:
        for client in clients:
            service_name = client.get("name")
            if service_name:
                try:
                    client_obj = self.create_client(Empty, service_name)
                    self._clients.append(client_obj)
                    self.get_logger().info(f"Client created for service: {service_name}")
                except Exception as e:
                    pass

    def _setup_services(self, services: List[Dict[str, str]]) -> None:
        for service in services:
            service_name = service.get("name")
            if service_name:
                try:
                    service_obj = self.create_service(Empty, service_name, self._dummy_service_callback)
                    self._services.append(service_obj)
                    self.get_logger().info(f"Service created: {service_name}")
                except Exception as e:
                    pass

    def _dummy_callback(self, msg: Empty) -> None:
        self.get_logger().info("Dummy callback triggered.")

    def _dummy_service_callback(self, request: Empty, response: Empty) -> Empty:
        self.get_logger().info("Dummy service callback triggered.")
        return response


def create_nodes_from_json(json_file: str) -> None:
    with open(json_file, 'r') as file:
        data = json.load(file)

    if "nodes" not in data:
        raise ValueError("Invalid JSON: 'nodes' key is missing.")

    rclpy.init()
    nodes: List[DynamicNode] = []

    try:
        for node_data in data["nodes"]:
            node_name = node_data.get("name")
            if not node_name:
                raise ValueError(f"Invalid node definition: {node_data}")

            # Create the node and add it to the list
            node = DynamicNode(node_name, node_data)
            nodes.append(node)

        # Keep the nodes running until KeyboardInterrupt
        try:
            while rclpy.ok():
                for node in nodes:
                    rclpy.spin_once(node, timeout_sec=0.1)
        except KeyboardInterrupt:
            print("KeyboardInterrupt received. Shutting down.")
    finally:
        # Cleanup and destroy all nodes
        for node in nodes:
            node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python create_ros2_nodes.py <path_to_json_file>")
        sys.exit(1)

    json_file = sys.argv[1]
    try:
        create_nodes_from_json(json_file)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)