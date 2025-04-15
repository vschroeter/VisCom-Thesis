import math
import random

import networkx as nx
import numpy as np


class Distribution:
    def __init__(
        self,
        expected_value: float | str,
        deviation: float | str,
        min_value: str | float,
    ):
        self.expected_value = expected_value
        self.deviation = deviation
        self.min_value = min_value

    @staticmethod
    def get_value(value: float | str, total_node_count: int | None) -> float:
        if isinstance(value, float):
            return value
        else:
            return eval(str(value), {"n": total_node_count} if total_node_count else {})

    def sample(self, total_node_count: int | None, only_positive=False) -> float:
        expected_value = Distribution.get_value(self.expected_value, total_node_count)
        deviation = Distribution.get_value(self.deviation, total_node_count)

        val = np.random.normal(expected_value, deviation)

        if only_positive:
            val = abs(val)
        val = max(val, Distribution.get_value(self.min_value, total_node_count))
        return val

    def sample_int(self, total_node_count: int | None, only_positive=False) -> int:
        return round(self.sample(total_node_count, only_positive))


class GenBase:
    topic_counter: int = 0

    def __init__(self):
        self.count_already_generated = 0

    def generate(self, graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
        self.generate_implementation(graph)
        self.count_already_generated += 1
        return graph

    def generate_implementation(self, graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
        raise NotImplementedError

    def get_random_node_ids(self, graph: nx.DiGraph, node_count: int, exclude_ids: set[int] | None = None) -> list[int]:
        exclude_ids = exclude_ids or set()
        node_ids = set(graph.nodes)
        node_ids -= exclude_ids
        count = min(node_count, len(node_ids))
        if count == 0 or len(node_ids) == 0:
            return []
        random_ids: list = np.random.choice(list(node_ids), count, replace=False).tolist()
        return random_ids

    def do_with_probability(self, probability: float) -> bool:
        return np.random.rand() < probability

    @staticmethod
    def get_random_selection_of_ids(ids: set[int], count: int) -> list[int]:
        count = min(count, len(ids))
        return np.random.choice(list(ids), count, replace=False).tolist()  # type: ignore

    @staticmethod
    def get_unconnected_ids(graph: nx.MultiDiGraph) -> set[int]:
        return set([node_id for node_id in graph.nodes if (len(list(graph.successors(node_id))) == 0 and len(list(graph.predecessors(node_id))) == 0)])

    @staticmethod
    def get_connected_ids(graph: nx.MultiDiGraph) -> set[int]:
        return set([node_id for node_id in graph.nodes if (len(list(graph.successors(node_id))) > 0 or len(list(graph.predecessors(node_id))) > 0)])

    @staticmethod
    def connect_by_edge(graph: nx.MultiDiGraph, source_id: int, target_ids: list[int] | int, topic_name: str = None):
        if isinstance(target_ids, int):
            target_ids = [target_ids]
        for target_id in target_ids:
            graph.add_edge(source_id, target_id, topic=topic_name, type="std_msgs/msg/Empty")

    def get_new_topic_name(self):
        topic_name = f"/topic_{GenBase.topic_counter}"
        GenBase.topic_counter += 1
        return topic_name

    def get_node_pub_topics(self, graph: nx.MultiDiGraph, node_id: int) -> list[str]:
        topics = []
        for _, _, edge_data in graph.out_edges(node_id, data=True):
            if "topic" in edge_data and edge_data["topic"] is not None:
                topics.append(edge_data["topic"])
        return list(set(topics))

    def get_node_sub_topics(self, graph: nx.MultiDiGraph, node_id: int) -> list[str]:
        topics = []
        for _, _, edge_data in graph.in_edges(node_id, data=True):
            if "topic" in edge_data and edge_data["topic"] is not None:
                topics.append(edge_data["topic"])
        return list(set(topics))


class GenPipeline(GenBase):
    """
    Generates pipelines in the graph.
    A pipeline is a sequence of n nodes connected by a path.
    This generator generates pipelines until all nodes are part of a pipeline.

    Options:
    - prioritize connection of non-connected nodes
    - prioritize source and sink nodes to be already connected nodes
    """

    def __init__(self, pipeline_length: Distribution, reuse_topic_probability: float = 0.1):
        super().__init__()
        self.pipeline_length = pipeline_length
        self.generated_pipelines: list[list[int]] = []
        self.reuse_topic_probability = float(reuse_topic_probability)

    @property
    def generated_pipeline_count(self) -> int:
        return len(self.generated_pipelines)

    def connect_ids_with_a_pipeline(self, graph: nx.MultiDiGraph, node_ids: list[int]) -> nx.MultiDiGraph:
        for i in range(1, len(node_ids)):
            if self.do_with_probability(self.reuse_topic_probability):
                source_topics = self.get_node_pub_topics(graph, node_ids[i - 1])
                if source_topics:
                    topic = random.choice(source_topics)
                else:
                    topic = self.get_new_topic_name()
            else:
                topic = self.get_new_topic_name()
            graph.add_edge(node_ids[i - 1], node_ids[i], topic=topic, type="std_msgs/msg/Empty")
        return graph

    def generate_implementation(self, graph: nx.MultiDiGraph, node_count: int = -1) -> nx.MultiDiGraph:
        total_node_count = len(graph.nodes)
        unconnected_ids = self.get_unconnected_ids(graph)
        while len(unconnected_ids) > 0:
            # Get number of nodes to generate
            pipeline_length = self.pipeline_length.sample_int(total_node_count)
            # Get random IDs from unconnected nodes
            random_ids = self.get_random_selection_of_ids(unconnected_ids, pipeline_length)
            # Connect nodes in pipeline
            self.connect_ids_with_a_pipeline(graph, random_ids)
            # Remove connected nodes from unconnected nodes
            unconnected_ids -= set(random_ids)
            # Add pipeline to generated pipelines
            self.generated_pipelines.append(random_ids)
            print(f"[PIPELINE] Generated pipeline: {random_ids}")
        return graph


class GenForwardEdge(GenBase):
    """
    Generates forward edges inside a pipeline.
    A forward edge is a connection from a source node to a sink node.

    This generator iterates over all pipelines and connects nodes inside a pipeline with random count of successor nodes by a forward edge with a given probability.
    """

    def __init__(self, pipeline_generator: GenPipeline, probability: float, reuse_topic_probability: float = 0.1):
        super().__init__()
        self.probability = float(probability)
        self.pipeline_generator = pipeline_generator
        self.count_added_forward_edges = 0
        self.count_added_forward_edges_sources = 0
        self.reuse_topic_probability = float(reuse_topic_probability)

    def generate_implementation(self, graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
        pipelines = self.pipeline_generator.generated_pipelines
        for pipeline in pipelines:
            for current_node_index, node_id in enumerate(pipeline):
                if self.do_with_probability(self.probability):
                    # Avoid linking to the direct successor of current node
                    all_successor_ids_after_direct_successor = pipeline[current_node_index + 2 :]
                    if len(all_successor_ids_after_direct_successor) == 0:
                        continue
                    # The max count of forwart edges is the length of the pipeline minus the current node
                    max_forward_edges = len(all_successor_ids_after_direct_successor)
                    distribution = Distribution(0, math.sqrt(max_forward_edges), min_value=1)
                    forward_edge_count = distribution.sample_int(max_forward_edges, only_positive=True)
                    target_ids = self.get_random_selection_of_ids(set(all_successor_ids_after_direct_successor), forward_edge_count)
                    if self.do_with_probability(self.reuse_topic_probability):
                        source_topics = self.get_node_pub_topics(graph, node_id)
                        if source_topics:
                            topic = random.choice(source_topics)
                        else:
                            topic = self.get_new_topic_name()
                    else:
                        topic = self.get_new_topic_name()
                    print(f"[FORWARD] Connecting {node_id} with {target_ids} on topic {topic}")
                    for target_id in target_ids:
                        graph.add_edge(node_id, target_id, topic=topic, type="std_msgs/msg/Empty")
                    self.count_added_forward_edges += forward_edge_count
                    self.count_added_forward_edges_sources += 1
        return graph


class GenBackwardEdge(GenBase):
    """
    Generates backward edges inside a pipeline.
    A backward edge is a connection from a sink node to a source node.

    This generator iterates over all pipelines and connects nodes inside a pipeline with random count of predecessor nodes by a backward edge with a given probability.
    """

    def __init__(self, pipeline_generator: GenPipeline, probability: float, reuse_topic_probability: float = 0.1):
        super().__init__()
        self.probability = float(probability)
        self.pipeline_generator = pipeline_generator
        self.count_added_backward_edges = 0
        self.count_added_backward_edges_sources = 0
        self.reuse_topic_probability = float(reuse_topic_probability)

    def generate_implementation(self, graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
        pipelines = self.pipeline_generator.generated_pipelines
        # Go through each pipeline and each node in the pipeline
        for pipeline in pipelines:
            for current_node_index, node_id in enumerate(pipeline):
                # Decide if a backward edge should be added
                if self.do_with_probability(self.probability):
                    # Avoid linking to the direct predecessor of current node
                    first_predecessor_index = max(0, current_node_index - 1)
                    all_predecessor_ids_before_direct_predecessor = pipeline[:first_predecessor_index]
                    if len(all_predecessor_ids_before_direct_predecessor) == 0:
                        continue
                    # The max count of backward edges is the length of the pipeline minus the current node
                    max_backward_edges = len(all_predecessor_ids_before_direct_predecessor)
                    distribution = Distribution(0, math.sqrt(max_backward_edges), min_value=1)
                    backward_edge_count = distribution.sample_int(max_backward_edges, only_positive=True)
                    # Get target nodes
                    target_ids = self.get_random_selection_of_ids(
                        set(all_predecessor_ids_before_direct_predecessor),
                        backward_edge_count,
                    )
                    if self.do_with_probability(self.reuse_topic_probability):
                        source_topics = self.get_node_pub_topics(graph, node_id)
                        if source_topics:
                            topic = random.choice(source_topics)
                        else:
                            topic = self.get_new_topic_name()
                    else:
                        topic = self.get_new_topic_name()
                    # Connect source node with target nodes
                    print(f"[BACKWARD] Connecting {node_id} with {target_ids} on topic {topic}")
                    for target_id in target_ids:
                        graph.add_edge(node_id, target_id, topic=topic, type="std_msgs/msg/Empty")
                    self.count_added_backward_edges += backward_edge_count
        return graph


class GenCrossConnection(GenBase):
    """
    This generator adds random cross connections between pipelines with a given probability.
    """

    def __init__(self, pipeline_generator: GenPipeline, probability: float, reuse_topic_probability: float = 0.1):
        super().__init__()
        self.probability = float(probability)
        self.pipeline_generator = pipeline_generator
        self.reuse_topic_probability = float(reuse_topic_probability)

    def generate_implementation(self, graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
        pipelines = self.pipeline_generator.generated_pipelines
        for pipeline in pipelines:
            for node in pipeline:
                if self.do_with_probability(self.probability):
                    # Get random pipeline
                    other_pipeline = random.choice(pipelines)
                    other_node = random.choice(other_pipeline)
                    if self.do_with_probability(self.reuse_topic_probability):
                        source_topics = self.get_node_pub_topics(graph, node)
                        if source_topics:
                            topic = random.choice(source_topics)
                        else:
                            topic = self.get_new_topic_name()
                    else:
                        topic = self.get_new_topic_name()
                    # Connect node with other node
                    print(f"[CROSS] Connecting {node} with {other_node} on topic {topic}")
                    graph.add_edge(node, other_node, topic=topic, type="std_msgs/msg/Empty")
        return graph


class GenCrossIntegration(GenBase):
    """
    This generator integrates a random node from another pipeline into a pipeline with a given probability.
    """

    def __init__(self, pipeline_generator: GenPipeline, probability: float, reuse_topic_probability: float = 0.1):
        super().__init__()
        self.probability = float(probability)
        self.pipeline_generator = pipeline_generator
        self.reuse_topic_probability = float(reuse_topic_probability)

    def generate_implementation(self, graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
        pipelines = self.pipeline_generator.generated_pipelines
        for pipeline in pipelines:
            # Don't mind the last node
            for node_index, node in enumerate(pipeline[:-1]):
                next_node = pipeline[node_index + 1]
                if self.do_with_probability(self.probability):
                    # Get random pipeline
                    other_pipeline = random.choice(pipelines)
                    other_node = random.choice(other_pipeline)

                    # Remove edge between node and next node
                    # Connect node with other node
                    # Connect other node with next node

                    edge_data = graph.get_edge_data(node, next_node)

                    if edge_data:
                        edge_key = list(edge_data.keys())[0]
                        orig_topic = edge_data[edge_key].get("topic")
                    else:
                        orig_topic = None

                    if self.do_with_probability(self.reuse_topic_probability) and orig_topic:
                        topic1 = orig_topic
                    else:
                        topic1 = self.get_new_topic_name()

                    if self.do_with_probability(self.reuse_topic_probability) and orig_topic:
                        topic2 = orig_topic
                    else:
                        topic2 = self.get_new_topic_name()

                    print(f"[CROSS] Integrating {other_node} between {node} and {next_node} on topics {topic1} and {topic2}")

                    # # Print edges between node and next node with data
                    # print(f"\t[CROSS] Edges of {node} BEFORE:")
                    # for edge in graph.edges(node, data=True):
                    #     print(f"\t\t{edge}")

                    # print(f"\t[CROSS] Edges of {next_node} BEFORE:")
                    # for edge in graph.edges(next_node, data=True):
                    #     print(f"\t\t{edge}")

                    graph.remove_edge(node, next_node)

                    # print(f"\t[CROSS] Edges of {node} AFTER:")
                    # for edge in graph.edges(node, data=True):
                    #     print(f"\t\t{edge}")

                    # print(f"\t[CROSS] Edges of {next_node} AFTER:")
                    # for edge in graph.edges(next_node, data=True):
                    #     print(f"\t\t{edge}")

                    graph.add_edge(node, other_node, topic=topic1, type="std_msgs/msg/Empty")
                    graph.add_edge(other_node, next_node, topic=topic2, type="std_msgs/msg/Empty")
        return graph


class GenDiamond(GenBase):
    """
    This generator takes nodes of a pipeline and connects them in a diamond shape:
    - select n nodes from the pipeline
    - direct connections between the nodes are removed
    - the predecessor of the first node is connected to all selected nodes
    - all selected nodes are connected to the predecessor of the last node
    """

    def __init__(self, pipeline_generator: GenPipeline, probability: float, reuse_topic_probability: float = 0.1):
        super().__init__()
        self.pipeline_generator = pipeline_generator
        self.probability = float(probability)
        self.reuse_topic_probability = float(reuse_topic_probability)

    def generate_implementation(self, graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
        pipelines = self.pipeline_generator.generated_pipelines
        for pipeline in pipelines:
            pipeline_length = len(pipeline)
            if self.do_with_probability(self.probability):
                max_diamond_count = pipeline_length - 2
                if max_diamond_count < 2:
                    continue
                diamond_count = np.random.randint(2, max_diamond_count) if max_diamond_count > 2 else 2
                start_index = np.random.randint(0, pipeline_length - diamond_count)
                diamond_nodes = pipeline[start_index : start_index + diamond_count]
                if self.do_with_probability(self.reuse_topic_probability):
                    all_topics = []
                    for node in diamond_nodes:
                        all_topics.extend(self.get_node_pub_topics(graph, node))
                    if all_topics:
                        diamond_topic = random.choice(all_topics)
                    else:
                        diamond_topic = self.get_new_topic_name()
                else:
                    diamond_topic = self.get_new_topic_name()
                # Connect the predecessors of the first node with all diamond nodes
                predecessors = list(graph.predecessors(diamond_nodes[0]))
                print(f"[DIAMOND] Connecting {predecessors} with {diamond_nodes} on topic {diamond_topic}")
                for predecessor in predecessors:
                    for diamond_node in diamond_nodes:
                        graph.add_edge(predecessor, diamond_node, topic=diamond_topic, type="std_msgs/msg/Empty")
                # Connect the diamond nodes with the successors of the last node
                successors = list(graph.successors(diamond_nodes[-1]))
                print(f"[DIAMOND] Connecting {diamond_nodes} with {successors} on topic {diamond_topic}")
                for successor in successors:
                    for diamond_node in diamond_nodes:
                        graph.add_edge(diamond_node, successor, topic=diamond_topic, type="std_msgs/msg/Empty")
                # Remove direct connections between diamond nodes
                for i in range(1, len(diamond_nodes)):
                    if graph.has_edge(diamond_nodes[i - 1], diamond_nodes[i]):
                        graph.remove_edge(diamond_nodes[i - 1], diamond_nodes[i])
        return graph


class GenNodeRewiring(GenBase):
    """
    This generator selects two random nodes of the graph:
    - source node s
    - target node t
    The target node gets new edges:
    - all predecessors of s are connected to t
    - t is connected to all successors of s
    """

    def __init__(self, pipeline_generator: GenPipeline, probability: float, reuse_topic_probability: float = 0.1):
        super().__init__()
        self.pipeline_generator = pipeline_generator
        self.probability = float(probability)
        self.reuse_topic_probability = float(reuse_topic_probability)

    def generate_implementation(self, graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
        pipelines = self.pipeline_generator.generated_pipelines
        for pipeline in pipelines:
            pipeline_length = len(pipeline)
            for node_index, node in enumerate(pipeline):
                if self.do_with_probability(self.probability):
                    max_tries = 10
                    while (source_node := random.choice(pipeline)) == node:
                        max_tries -= 1
                        if max_tries == 0:
                            break
                    if source_node == node:
                        continue
                    reuse_topics = self.do_with_probability(self.reuse_topic_probability)
                    for predecessor in graph.predecessors(source_node):
                        pred_edges = graph.get_edge_data(predecessor, source_node)
                        if pred_edges:
                            if reuse_topics:
                                edge_key = list(pred_edges.keys())[0]
                                topic = pred_edges[edge_key].get("topic", self.get_new_topic_name())
                            else:
                                topic = self.get_new_topic_name()
                            graph.add_edge(predecessor, node, topic=topic, type="std_msgs/msg/Empty")
                    for successor in graph.successors(source_node):
                        if successor != node:
                            succ_edges = graph.get_edge_data(source_node, successor)
                            if succ_edges:
                                if reuse_topics:
                                    edge_key = list(succ_edges.keys())[0]
                                    topic = succ_edges[edge_key].get("topic", self.get_new_topic_name())
                                else:
                                    topic = self.get_new_topic_name()
                                graph.add_edge(node, successor, topic=topic, type="std_msgs/msg/Empty")
                    print(f"[REWIRING] Rewired node {node} with source node {source_node}")
        return graph


# class GenHub(GenBase):
#     """
#     Generates a hub:
#     - h hub nodes
#     - i incoming nodes
#     - o outgoing nodes

#     All incoming nodes are connected to all hub nodes.
#     All hub nodes are connected to all outgoing nodes.
#     """

#     def __init__(self, total_node_count: int, gen_deviation: Distribution):
#         super().__init__(total_node_count, gen_deviation)
#         self.hub_count_distribution = Distribution(0, 2, min_value=1)
#         self.incoming_count_distribution = Distribution(4, 3, min_value=2)
#         self.outgoing_count_distribution = Distribution(4, 3, min_value=2)

#     def generate_implementation(self, graph: nx.DiGraph, node_count: int = -1) -> nx.DiGraph:
#         # Get node count of graph
#         total_node_count = len(graph.nodes)

#         # Get number of nodes to generate
#         hub_count = self.hub_count_distribution.sample_int(total_node_count)
#         incoming_count = self.incoming_count_distribution.sample_int(total_node_count)
#         outgoing_count = self.outgoing_count_distribution.sample_int(total_node_count)

#         # Get random node IDs
#         hub_ids = self.get_random_node_ids(graph, hub_count)
#         incoming_ids = self.get_random_node_ids(graph, incoming_count, set(hub_ids))
#         outgoing_ids = self.get_random_node_ids(graph, outgoing_count, set(hub_ids))

#         # Connect incoming nodes to hub nodes
#         for incoming_id in incoming_ids:
#             for hub_id in hub_ids:
#                 graph.add_edge(incoming_id, hub_id)

#         # Connect hub nodes to outgoing nodes
#         for hub_id in hub_ids:
#             for outgoing_id in outgoing_ids:
#                 graph.add_edge(hub_id, outgoing_id)

#         return graph


# class GenUnconnected(GenBase):
#     """
#     Connects unconnected nodes in the graph.
#     These unnconnected nodes are connected in paths with a random length.
#     """

#     def __init__(self, total_node_count: int):
#         super().__init__(total_node_count, 1)

#     def generate_implementation(self, graph: nx.DiGraph, node_count: int = -1) -> nx.DiGraph:
#         # Get node count of graph
#         total_node_count = len(graph.nodes)

#         # Get all IDs that are unconnected
#         unconnected_ids = GenUnconnected.get_unconnected_ids(graph)

#         # If there are no unconnected nodes, return
#         if len(unconnected_ids) == 0:
#             return graph

#         d = Distribution(3, 2, min_value=2)
#         while len(unconnected_ids) > 0:
#             count_to_connect = min(d.sample_int(total_node_count), len(unconnected_ids))

#             # Avoid that a single node is left
#             if len(unconnected_ids) - count_to_connect == 1:
#                 count_to_connect += 1

#             # Get random node IDs and connect them as pipeline
#             ids_to_connect = np.random.choice(list(unconnected_ids), count_to_connect, replace=False).tolist()
#             GenPipeline.connect_ids_with_a_pipeline(graph, ids_to_connect)

#             # Remove connected nodes from unconnected nodes
#             unconnected_ids -= set(ids_to_connect)


class GenBroadcast(GenBase):
    def __init__(self, probability: float, max_connection_fraction: float):
        super().__init__()
        self.probability = float(probability)
        self.connection_fraction = float(max_connection_fraction)

    def generate_implementation(self, graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
        nodes = list(graph.nodes())
        for node in nodes:
            if self.do_with_probability(self.probability):
                # target_count = max(1, int(len(nodes) * self.connection_fraction))
                target_count = max(1, int(len(nodes) * self.connection_fraction))
                target_count = random.randint(1, target_count)
                potential_targets = [n for n in nodes if n != node]
                if not potential_targets:
                    continue
                target_nodes = random.sample(potential_targets, min(target_count, len(potential_targets)))
                connection_type = random.random()
                if connection_type < 0.5:
                    direction = "in" if random.random() < 0.5 else "out"
                    broadcast_topic = self.get_new_topic_name()
                    if direction == "in":
                        for target in target_nodes:
                            graph.add_edge(target, node, topic=broadcast_topic, type="std_msgs/msg/Empty")
                        print(f"[BROADCAST] Created broadcast node {node} with {len(target_nodes)} incoming connections on topic {broadcast_topic}")
                    else:
                        for target in target_nodes:
                            graph.add_edge(node, target, topic=broadcast_topic, type="std_msgs/msg/Empty")
                        print(f"[BROADCAST] Created broadcast node {node} with {len(target_nodes)} outgoing connections on topic {broadcast_topic}")
                else:
                    in_topic = self.get_new_topic_name()
                    out_topic = self.get_new_topic_name()
                    split_point = len(target_nodes) // 2
                    in_targets = target_nodes[:split_point]
                    out_targets = target_nodes[split_point:]
                    for target in in_targets:
                        graph.add_edge(target, node, topic=in_topic, type="std_msgs/msg/Empty")
                    for target in out_targets:
                        graph.add_edge(node, target, topic=out_topic, type="std_msgs/msg/Empty")
                    print(
                        f"Created broadcast node {node} with {len(in_targets)} incoming connections on topic {in_topic} "
                        f"and {len(out_targets)} outgoing connections on topic {out_topic}"
                    )
        return graph


class CommGraphGenerator:
    def __init__(self):
        pass

    def generate(
        self,
        node_count: int,
        seed: int = 42,
        pipeline_length_mu="4",
        pipeline_length_deviation="4",
        pipeline_min_len="3",
        forward_edge_probability=0.1,
        backward_edge_probability=0.1,
        cross_connection_probability=0.1,
        cross_integration_probability=0.1,
        diamond_probability=0.1,
        node_rewiring_probability=0.1,
        reuse_topic_probability=0.1,
        broadcast_probability=0.05,
        broadcast_connection_fraction=0.2,
    ) -> nx.MultiDiGraph:
        if seed == 0:
            seed = None
        np.random.seed(seed)
        random.seed(seed)
        graph = nx.MultiDiGraph()
        GenBase.topic_counter = 0
        # Add nodes
        for i in range(node_count):
            graph.add_node(i)
        # Generate pipelines
        pipeline_gen = GenPipeline(Distribution(pipeline_length_mu, pipeline_length_deviation, pipeline_min_len), reuse_topic_probability)
        pipeline_gen.generate(graph)
        print(f"Generated {pipeline_gen.generated_pipeline_count} pipelines.")
        # Generate forward edges
        forward_edge_gen = GenForwardEdge(pipeline_gen, probability=forward_edge_probability, reuse_topic_probability=reuse_topic_probability)
        forward_edge_gen.generate(graph)
        print(f"Generated {forward_edge_gen.count_added_forward_edges} forward edges ({forward_edge_gen.count_added_forward_edges_sources} sources).")
        # Generate backward edges
        backward_edge_gen = GenBackwardEdge(pipeline_gen, probability=backward_edge_probability, reuse_topic_probability=reuse_topic_probability)
        backward_edge_gen.generate(graph)
        print(f"Generated {backward_edge_gen.count_added_backward_edges} backward edges ({backward_edge_gen.count_added_backward_edges_sources} sources).")
        # Generate cross connections
        cross_connection_gen = GenCrossConnection(pipeline_gen, probability=cross_connection_probability, reuse_topic_probability=reuse_topic_probability)
        cross_connection_gen.generate(graph)
        print("Generated cross connections.")
        # Generate cross integrations
        cross_integration_gen = GenCrossIntegration(pipeline_gen, probability=cross_integration_probability, reuse_topic_probability=reuse_topic_probability)
        cross_integration_gen.generate(graph)
        print("Generated cross integrations.")
        # Generate diamonds
        diamond_gen = GenDiamond(pipeline_gen, probability=diamond_probability, reuse_topic_probability=reuse_topic_probability)
        diamond_gen.generate(graph)
        print("Generated diamonds.")
        # Generate node rewiring
        node_rewiring_gen = GenNodeRewiring(pipeline_gen, probability=node_rewiring_probability, reuse_topic_probability=reuse_topic_probability)
        node_rewiring_gen.generate(graph)
        print("Generated node rewirings.")

        # Generate broadcast nodes
        broadcast_gen = GenBroadcast(probability=broadcast_probability, max_connection_fraction=broadcast_connection_fraction)
        broadcast_gen.generate(graph)
        print("Generated broadcast nodes.")

        for node in graph.nodes():
            graph.nodes[node]["name"] = f"node_{node}"
            graph.nodes[node]["namespace"] = "/"
            graph.nodes[node]["localhost_only"] = False
            publishers = []
            subscribers = []

            added_publishers = set()
            added_subscribers = set()

            for _, target, edge_data in graph.out_edges(node, data=True):
                topic_name = edge_data.get("topic", f"/topic_{len(publishers)}")
                topic_type = edge_data.get("type", "std_msgs/msg/Empty")

                if topic_name not in added_publishers:
                    publishers.append({"name": topic_name, "type": topic_type, "topic_type": topic_type})
                    added_publishers.add(topic_name)
            for source, _, edge_data in graph.in_edges(node, data=True):
                topic_name = edge_data.get("topic", f"/topic_{len(subscribers)}")
                topic_type = edge_data.get("type", "std_msgs/msg/Empty")
                if topic_name not in added_subscribers:
                    subscribers.append({"name": topic_name, "type": topic_type, "topic_type": topic_type})
                    added_subscribers.add(topic_name)

            graph.nodes[node]["publishers"] = publishers
            graph.nodes[node]["subscribers"] = subscribers
            graph.nodes[node]["services"] = []
            graph.nodes[node]["clients"] = []
        return graph

    @staticmethod
    def generate_graph(node_count: int, seed: int = 42) -> nx.DiGraph:
        return CommGraphGenerator().generate(node_count, seed)
