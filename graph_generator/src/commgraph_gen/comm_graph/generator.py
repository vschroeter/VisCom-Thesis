import networkx as nx
import numpy as np


class Distribution:
    def __init__(
        self, expected_value: float | str, deviation: float | str, min_value=0
    ):
        self.expected_value = expected_value
        self.deviation = deviation
        self.min_value = min_value

    @staticmethod
    def get_value(value: float | str, total_node_count: int) -> float:
        if isinstance(value, float):
            return value
        else:
            return eval(str(value), {"n": total_node_count})

    def sample(self, total_node_count: int) -> float:
        # If expected value / deviation is a float, just take it
        # Otherwise, evaluate the string with n = total_node_count

        expected_value = Distribution.get_value(self.expected_value, total_node_count)
        deviation = Distribution.get_value(self.deviation, total_node_count)

        val = np.random.normal(expected_value, deviation)
        val = max(val, self.min_value)
        return val


class GenBase:
    def __init__(self, total_node_count: int, gen_deviation: Distribution):
        self.count_to_generate = round(gen_deviation.sample(total_node_count))
        self.count_already_generated = 0

    @property
    def finished(self):
        return self.count_already_generated >= self.count_to_generate

    def generate(self, graph: nx.Graph, node_count: int = -1) -> nx.Graph:
        self.generate_implementation(graph, node_count)
        self.count_already_generated += 1

    def generate_implementation(
        self, graph: nx.Graph, node_count: int = -1
    ) -> nx.Graph:
        raise NotImplementedError

    def get_random_node_ids(self, graph: nx.Graph, node_count: int) -> list[int]:
        count = min(node_count, len(graph))
        random_ids = np.random.choice(list(graph), count, replace=False).tolist()
        return random_ids


class GenPipeline(GenBase):
    """
    Generates a pipeline:
    - n nodes connected by a path

    Options:
    - prioritize connection of non-connected nodes
    - prioritize source and sink nodes to be already connected nodes
    """

    def __init__(self, total_node_count: int, gen_deviation: Distribution):
        super().__init__(total_node_count, gen_deviation)
        self.node_count_distribution = Distribution(4, 6, min_value=2)

    def generate_implementation(
        self, graph: nx.Graph, node_count: int = -1
    ) -> nx.Graph:
        # Get node count of graph
        total_node_count = len(graph.nodes)

        # Get number of nodes to generate
        sample_count = self.node_count_distribution.sample(total_node_count)
        node_count = node_count if node_count != -1 else round(sample_count)

        # Get random node IDs
        random_ids = self.get_random_node_ids(graph, node_count)

        # Add links between each node
        for i in range(1, len(random_ids)):
            graph.add_edge(random_ids[i - 1], random_ids[i])

        return graph


class CommGraphGenerator:
    def __init__(self):
        pass

    def generate(
        self,
        node_count: int,
        seed: int = 42,
        pipeline_count_mu="n/8",
        pipeline_count_deviation="n/6",
    ) -> nx.Graph:
        """
        Generates a communication graph with the given generator settings.
        """

        # Set seed
        if seed == 0:
            seed = None

        np.random.seed(seed)

        graph = nx.DiGraph()

        # Add nodes
        for i in range(node_count):
            graph.add_node(i)

        # Generate pipeline
        pipeline_gen = GenPipeline(node_count, Distribution(pipeline_count_mu, pipeline_count_deviation, min_value=1))
        print(f"Generating pipeline with {pipeline_gen.count_to_generate} pipelines")

        while not pipeline_gen.finished:
            pipeline_gen.generate(graph)

        return graph

    @staticmethod
    def generate_graph(node_count: int, seed: int = 42) -> nx.Graph:
        return CommGraphGenerator().generate(node_count, seed)
