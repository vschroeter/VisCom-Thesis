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

    def sample_int(self, total_node_count: int) -> int:
        return round(self.sample(total_node_count))


class GenBase:
    def __init__(
        self, total_node_count: int, count_to_generate: Distribution | int = 1
    ):
        self.count_to_generate = (
            count_to_generate
            if isinstance(count_to_generate, int)
            else count_to_generate.sample_int(total_node_count)
        )
        self.count_already_generated = 0

    @property
    def finished(self):
        return self.count_already_generated >= self.count_to_generate

    def generate(self, graph: nx.DiGraph, node_count: int = -1) -> nx.DiGraph:
        self.generate_implementation(graph, node_count)
        self.count_already_generated += 1

    def generate_implementation(
        self, graph: nx.DiGraph, node_count: int = -1
    ) -> nx.DiGraph:
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

    @staticmethod
    def connect_pipeline(graph: nx.DiGraph, node_ids: list[int]) -> nx.DiGraph:
        for i in range(1, len(node_ids)):
            graph.add_edge(node_ids[i - 1], node_ids[i])

        return graph

    def generate_implementation(
        self, graph: nx.DiGraph, node_count: int = -1
    ) -> nx.DiGraph:
        # Get node count of graph
        total_node_count = len(graph.nodes)

        # Get number of nodes to generate
        sample_count = self.node_count_distribution.sample_int(total_node_count)
        node_count = node_count if node_count != -1 else round(sample_count)

        # Get random node IDs
        random_ids = self.get_random_node_ids(graph, node_count)

        # Add links between each node
        for i in range(1, len(random_ids)):
            graph.add_edge(random_ids[i - 1], random_ids[i])

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

    @staticmethod
    def get_unconnected_ids(graph: nx.DiGraph) -> set[int]:
        # # Get outgoing neighbors
        # outgoing_neighbors = set()
        # for node_id in graph.nodes:
        #     outgoing_neighbors |= set(graph.successors(node_id))

        # # Get incoming neighbors
        # incoming_neighbors = set()
        # for node_id in graph.nodes:
        #     incoming_neighbors |= set(graph.predecessors(node_id))

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
            GenPipeline.connect_pipeline(graph, ids_to_connect)

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
        pipeline_count_mu="n/8",
        pipeline_count_deviation="n/6",
        hub_count_mu="n / 20",
        hub_count_deviation="2",
    ) -> nx.DiGraph:
        """
        Generates a communication graph with the given generator settings.
        """

        # Set seed
        if seed == 0:
            seed = None

        np.random.seed(seed)

        # graph = nx.DiGraph()
        graph = nx.MultiDiGraph()

        # Add nodes
        for i in range(node_count):
            graph.add_node(i)

        # Generate pipeline
        pipeline_gen = GenPipeline(
            node_count,
            Distribution(pipeline_count_mu, pipeline_count_deviation, min_value=1),
        )
        print(f"Generating pipeline with {pipeline_gen.count_to_generate} pipelines")

        while not pipeline_gen.finished:
            pipeline_gen.generate(graph)

        # Generate hubs
        hub_gen = GenHub(node_count, Distribution(hub_count_mu, hub_count_deviation))
        print(f"Generating {hub_gen.count_to_generate} hubs")
        while not hub_gen.finished:
            hub_gen.generate(graph)

        # Generate unconnected nodes
        uc = GenUnconnected.get_unconnected_ids(graph)
        print(f"Connecting {len(uc)} unconnected nodes {uc}")
        unconnected_gen = GenUnconnected(node_count)
        unconnected_gen.generate(graph)

        return graph

    @staticmethod
    def generate_graph(node_count: int, seed: int = 42) -> nx.DiGraph:
        return CommGraphGenerator().generate(node_count, seed)
