import networkx as nx
import numpy as np
import math
import random

class Distribution:
    def __init__(
        self, expected_value: float | str, deviation: float | str, min_value: str | float
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

    def sample(self, total_node_count: int | None, only_positive = False) -> float:
        # If expected value / deviation is a float, just take it
        # Otherwise, evaluate the string with n = total_node_count

        expected_value = Distribution.get_value(self.expected_value, total_node_count)
        deviation = Distribution.get_value(self.deviation, total_node_count)

        val = np.random.normal(expected_value, deviation)

        if only_positive:
            val = abs(val)
        # val = max(val, self.min_value)
        val = max(val, Distribution.get_value(self.min_value, total_node_count))
        return val

    def sample_int(self, total_node_count: int | None, only_positive = False) -> int:
        return round(self.sample(total_node_count, only_positive))


class GenBase:
    def __init__(self):
        self.count_already_generated = 0

    def generate(self, graph: nx.DiGraph) -> nx.DiGraph:
        self.generate_implementation(graph)
        self.count_already_generated += 1

    def generate_implementation(self, graph: nx.DiGraph) -> nx.DiGraph:
        raise NotImplementedError

    def get_random_node_ids(
        self, graph: nx.DiGraph, node_count: int, exclude_ids: set[int] = None
    ) -> list[int]:
        exclude_ids = exclude_ids or set()

        # Node IDs of the graph
        node_ids = set(graph.nodes)

        # Remove exclude IDs
        node_ids -= exclude_ids

        count = min(node_count, len(node_ids))

        if count == 0 or len(node_ids) == 0:
            return []

        random_ids = np.random.choice(list(node_ids), count, replace=False).tolist()
        return random_ids

    def do_with_probability(self, probability: float) -> bool:
        return np.random.rand() < probability

    @staticmethod
    def get_random_selection_of_ids(ids: set[int], count: int) -> list[int]:
        count = min(count, len(ids))
        return np.random.choice(list(ids), count, replace=False).tolist()

    @staticmethod
    def get_unconnected_ids(graph: nx.DiGraph) -> set[int]:
        return set(
            [
                node_id
                for node_id in graph.nodes
                if (
                    len(list(graph.successors(node_id))) == 0
                    and len(list(graph.predecessors(node_id))) == 0
                )
            ]
        )

    @staticmethod
    def get_connected_ids(graph: nx.DiGraph) -> set[int]:
        return set(
            [
                node_id
                for node_id in graph.nodes
                if (
                    len(list(graph.successors(node_id))) > 0
                    or len(list(graph.predecessors(node_id))) > 0
                )
            ]
        )

    @staticmethod
    def connect_by_edge(graph: nx.DiGraph, source_id: int, target_ids: list[int] | int):
        if isinstance(target_ids, int):
            target_ids = [target_ids]

        for target_id in target_ids:
            graph.add_edge(source_id, target_id)

class GenPipeline(GenBase):
    """
    Generates pipelines in the graph.
    A pipeline is a sequence of n nodes connected by a path.
    This generator generatores pipelines until all nodes are part of a pipeline.

    Options:
    - prioritize connection of non-connected nodes
    - prioritize source and sink nodes to be already connected nodes
    """

    def __init__(self, pipeline_length: Distribution):
        super().__init__()
        # self.node_count_distribution = Distribution(4, 6, min_value=2)
        self.pipeline_length = pipeline_length
        self.generated_pipelines: list[list[int]] = []

    @property
    def generated_pipeline_count(self) -> int:
        return len(self.generated_pipelines)

    @staticmethod
    def connect_ids_with_a_pipeline(
        graph: nx.DiGraph, node_ids: list[int]
    ) -> nx.DiGraph:
        for i in range(1, len(node_ids)):
            graph.add_edge(node_ids[i - 1], node_ids[i])

        return graph

    def generate_implementation(
        self, graph: nx.DiGraph, node_count: int = -1
    ) -> nx.DiGraph:
        # Get node count of graph
        total_node_count = len(graph.nodes)

        # Get unconnected node IDs
        unconnected_ids = GenPipeline.get_unconnected_ids(graph)

        while len(unconnected_ids) > 0:
            # Get number of nodes to generate
            pipeline_length = self.pipeline_length.sample_int(total_node_count)

            # Get random IDs from unconnected nodes
            random_ids = self.get_random_selection_of_ids(unconnected_ids, pipeline_length)

            # Connect nodes in pipeline
            GenPipeline.connect_ids_with_a_pipeline(graph, random_ids)

            # Remove connected nodes from unconnected nodes
            unconnected_ids -= set(random_ids)

            # Add pipeline to generated pipelines
            self.generated_pipelines.append(random_ids)

            print(f"Generated pipeline: {random_ids}")

        return graph


class GenForwardEdge(GenBase):
    """
    Generates forward edges inside a pipeline.
    A forward edge is a connection from a source node to a sink node.

    This generator iterates over all pipelines and connects nodes inside a pipeline with random count of successor nodes by a forward edge with a given probability.
    """

    def __init__(self, pipeline_generator: GenPipeline, probability: float):
        super().__init__()
        self.probability = float(probability)
        self.pipeline_generator = pipeline_generator
        self.count_added_forward_edges = 0
        self.count_added_forward_edges_sources = 0

    def generate_implementation(
        self, graph: nx.DiGraph
    ) -> nx.DiGraph:
        
        pipelines = self.pipeline_generator.generated_pipelines

        # Go through each pipeline and each node in the pipeline
        for pipeline in pipelines:
            # pipeline_length = len(pipeline)
            for current_node_index, node_id in enumerate(pipeline):
                # Decide if a forward edge should be added
                if self.do_with_probability(self.probability):

                    # all_successor_ids = pipeline[current_node_index + 1 :]
                    # Avoid linking to the direct successor of current node
                    all_successor_ids_after_direct_successor = pipeline[current_node_index + 2 :]

                    if len(all_successor_ids_after_direct_successor) == 0:
                        continue

                    # The max count of forwart edges is the length of the pipeline minus the current node
                    max_forward_edges = len(all_successor_ids_after_direct_successor)

                    distribution = Distribution(0, math.sqrt(max_forward_edges), min_value=1)
                    forward_edge_count = distribution.sample_int(max_forward_edges, only_positive=True)
                    
                    # Get target nodes
                    target_ids = self.get_random_selection_of_ids(all_successor_ids_after_direct_successor, forward_edge_count)

                    # Connect source node with target nodes
                    print(f"Connecting {node_id} with {target_ids}")
                    GenForwardEdge.connect_by_edge(graph, node_id, target_ids)

                    self.count_added_forward_edges += forward_edge_count
                    self.count_added_forward_edges_sources += 1

        return graph


class GenBackwardEdge(GenBase):
    """
    Generates backward edges inside a pipeline.
    A backward edge is a connection from a sink node to a source node.

    This generator iterates over all pipelines and connects nodes inside a pipeline with random count of predecessor nodes by a backward edge with a given probability.
    """

    def __init__(self, pipeline_generator: GenPipeline, probability: float):
        super().__init__()
        self.probability = float(probability)
        self.pipeline_generator = pipeline_generator
        self.count_added_backward_edges = 0
        self.count_added_backward_edges_sources = 0

    def generate_implementation(
        self, graph: nx.DiGraph
    ) -> nx.DiGraph:
        
        pipelines = self.pipeline_generator.generated_pipelines

        # Go through each pipeline and each node in the pipeline
        for pipeline in pipelines:
            # pipeline_length = len(pipeline)
            for current_node_index, node_id in enumerate(pipeline):
                # Decide if a backward edge should be added
                if self.do_with_probability(self.probability):

                    # all_predecessor_ids = pipeline[:current_node_index]
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
                    target_ids = self.get_random_selection_of_ids(all_predecessor_ids_before_direct_predecessor, backward_edge_count)

                    # Connect source node with target nodes
                    print(f"Connecting {node_id} with {target_ids}")
                    GenBackwardEdge.connect_by_edge(graph, node_id, target_ids)

                    self.count_added_backward_edges += backward_edge_count


class GenCrossConnection(GenBase):
    """
    This generator adds random cross connections between pipelines with a given probability.
    """

    def __init__(self, pipeline_generator: GenPipeline, probability: float):
        super().__init__()
        self.probability = float(probability)
        self.pipeline_generator = pipeline_generator

    def generate_implementation(
        self, graph: nx.DiGraph
    ) -> nx.DiGraph:
        pipelines = self.pipeline_generator.generated_pipelines

        for pipeline in pipelines:
            for node in pipeline:
                if self.do_with_probability(self.probability):
                    # Get random pipeline
                    # other_pipeline_index = np.random.choice(range(len(pipelines)))
                    # other_pipeline = pipelines[other_pipeline_index]
                    other_pipeline = random.choice(pipelines)

                    # Get random node from other pipeline
                    other_node = random.choice(other_pipeline)

                    # Connect node with other node
                    graph.add_edge(node, other_node)
        return graph


class GenCrossIntegration(GenBase):
    """
    This generator integrates a random node from another pipeline into a pipeline with a given probability.
    """

    def __init__(self, pipeline_generator: GenPipeline, probability: float):
        super().__init__()
        self.probability = float(probability)
        self.pipeline_generator = pipeline_generator

    def generate_implementation(
        self, graph: nx.DiGraph
    ) -> nx.DiGraph:
        pipelines = self.pipeline_generator.generated_pipelines

        for pipeline in pipelines:
            # Don't mind the last node
            for node_index, node in enumerate(pipeline[:-1]):
                next_node = pipeline[node_index + 1]
                if self.do_with_probability(self.probability):
                    # Get random pipeline
                    other_pipeline = random.choice(pipelines)

                    # Get random node from other pipeline
                    other_node = random.choice(other_pipeline)

                    # Remove edge between node and next node
                    # Connect node with other node
                    # Connect other node with next node
                    graph.remove_edge(node, next_node)
                    graph.add_edge(node, other_node)
                    graph.add_edge(other_node, next_node)
                    
        return graph


class GenHub(GenBase):
    """
    Generates a hub:
    - h hub nodes
    - i incoming nodes
    - o outgoing nodes

    All incoming nodes are connected to all hub nodes.
    All hub nodes are connected to all outgoing nodes.
    """

    def __init__(self, total_node_count: int, gen_deviation: Distribution):
        super().__init__(total_node_count, gen_deviation)
        self.hub_count_distribution = Distribution(0, 2, min_value=1)
        self.incoming_count_distribution = Distribution(4, 3, min_value=2)
        self.outgoing_count_distribution = Distribution(4, 3, min_value=2)

    def generate_implementation(
        self, graph: nx.DiGraph, node_count: int = -1
    ) -> nx.DiGraph:
        # Get node count of graph
        total_node_count = len(graph.nodes)

        # Get number of nodes to generate
        hub_count = self.hub_count_distribution.sample_int(total_node_count)
        incoming_count = self.incoming_count_distribution.sample_int(total_node_count)
        outgoing_count = self.outgoing_count_distribution.sample_int(total_node_count)

        # Get random node IDs
        hub_ids = self.get_random_node_ids(graph, hub_count)
        incoming_ids = self.get_random_node_ids(graph, incoming_count, set(hub_ids))
        outgoing_ids = self.get_random_node_ids(graph, outgoing_count, set(hub_ids))

        # Connect incoming nodes to hub nodes
        for incoming_id in incoming_ids:
            for hub_id in hub_ids:
                graph.add_edge(incoming_id, hub_id)

        # Connect hub nodes to outgoing nodes
        for hub_id in hub_ids:
            for outgoing_id in outgoing_ids:
                graph.add_edge(hub_id, outgoing_id)

        return graph


class GenUnconnected(GenBase):
    """
    Connects unconnected nodes in the graph.
    These unnconnected nodes are connected in paths with a random length.
    """

    def __init__(self, total_node_count: int):
        super().__init__(total_node_count, 1)

    def generate_implementation(
        self, graph: nx.DiGraph, node_count: int = -1
    ) -> nx.DiGraph:
        # Get node count of graph
        total_node_count = len(graph.nodes)

        # Get all IDs that are unconnected
        unconnected_ids = GenUnconnected.get_unconnected_ids(graph)

        # If there are no unconnected nodes, return
        if len(unconnected_ids) == 0:
            return graph

        d = Distribution(3, 2, min_value=2)
        while len(unconnected_ids) > 0:
            count_to_connect = min(d.sample_int(total_node_count), len(unconnected_ids))

            # Avoid that a single node is left
            if len(unconnected_ids) - count_to_connect == 1:
                count_to_connect += 1

            # Get random node IDs and connect them as pipeline
            ids_to_connect = np.random.choice(
                list(unconnected_ids), count_to_connect, replace=False
            ).tolist()
            GenPipeline.connect_ids_with_a_pipeline(graph, ids_to_connect)

            # Remove connected nodes from unconnected nodes
            unconnected_ids -= set(ids_to_connect)

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
        # hub_count_mu="n / 20",
        # hub_count_deviation="2",
    ) -> nx.DiGraph:
        """
        Generates a communication graph with the given generator settings.
        """

        # Set seed
        if seed == 0:
            seed = None

        np.random.seed(seed)
        random.seed(seed)

        # graph = nx.DiGraph()
        graph = nx.MultiDiGraph()

        # Add nodes
        for i in range(node_count):
            graph.add_node(i)

        # Generate pipelines
        pipeline_gen = GenPipeline(
            Distribution(pipeline_length_mu, pipeline_length_deviation, pipeline_min_len)
        )
        pipeline_gen.generate(graph)
        print(f"Generated {pipeline_gen.generated_pipeline_count} pipelines.")

        # Generate forward edges
        forward_edge_gen = GenForwardEdge(pipeline_gen, probability=forward_edge_probability)
        forward_edge_gen.generate(graph)
        print(f"Generated {forward_edge_gen.count_added_forward_edges} forward edges ({forward_edge_gen.count_added_forward_edges_sources} sources).")
        
        # Generate backward edges
        backward_edge_gen = GenBackwardEdge(pipeline_gen, probability=backward_edge_probability)
        backward_edge_gen.generate(graph)
        print(f"Generated {backward_edge_gen.count_added_backward_edges} backward edges ({backward_edge_gen.count_added_backward_edges_sources} sources).")

        # Generate cross connections
        cross_connection_gen = GenCrossConnection(pipeline_gen, probability=cross_connection_probability)
        cross_connection_gen.generate(graph)
        print(f"Generated cross connections.")

        # Generate cross integrations
        cross_integration_gen = GenCrossIntegration(pipeline_gen, probability=cross_integration_probability)
        cross_integration_gen.generate(graph)
        print(f"Generated cross integrations.")


        # # Generate hubs
        # hub_gen = GenHub(node_count, Distribution(hub_count_mu, hub_count_deviation))
        # print(f"Generating {hub_gen.count_to_generate} hubs")
        # while not hub_gen.finished:
        #     hub_gen.generate(graph)

        # # Generate unconnected nodes
        # uc = GenUnconnected.get_unconnected_ids(graph)
        # print(f"Connecting {len(uc)} unconnected nodes {uc}")
        # unconnected_gen = GenUnconnected(node_count)
        # unconnected_gen.generate(graph)

        return graph

    @staticmethod
    def generate_graph(node_count: int, seed: int = 42) -> nx.DiGraph:
        return CommGraphGenerator().generate(node_count, seed)
