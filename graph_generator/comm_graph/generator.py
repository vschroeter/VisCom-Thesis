import networkx as nx
import numpy as np

class Distribution:
    def __init__(self, expected_value: float | str, deviation: float | str):
        self.expected_value = expected_value
        self.deviation = deviation
    
    @staticmethod
    def get_value(value: float | str, total_node_count: int) -> float:
        if isinstance(value, float):
            return value
        else:
            return eval(str(value), {"n": total_node_count})
    
    def sample(self, total_node_count: int, clamp_at_zero = True) -> float:
        
        # If expected value / deviation is a float, just take it
        # Otherwise, evaluate the string with n = total_node_count
        
        expected_value = Distribution.get_value(self.expected_value, total_node_count)
        deviation = Distribution.get_value(self.deviation, total_node_count)
        
        val = np.random.normal(expected_value, deviation)
        if val < 0 and clamp_at_zero:
            return 0
        return val
        

class GenBase:
    def __init__(self, total_node_count: int, gen_deviation: Distribution):
        self.count_to_generate = gen_deviation.sample(total_node_count)
        self.count_already_generated = 0
    
    def generate(self, graph: nx.Graph, node_count: int = -1) -> nx.Graph:
        pass

class GenPipeline(GenBase):
    """
    Generates a pipeline:
    - n nodes connected by a path
    
    Options:
    - prioritize connection of non-connected nodes
    - prioritize source and sink nodes to be already connected nodes
    """
    def __init__(self):
        self.node_count_distribution = Distribution(6, 6)
        
    def get_random_node_ids(self, graph: nx.Graph, node_count: int) -> list[int]:
        random_ids = np.random.choice(list(graph), node_count, replace=False).tolist()
        return random_ids
    
    def generate(self, graph: nx.Graph, node_count: int = -1) -> nx.Graph:
        
        # Get node count of graph
        total_node_count = len(graph.nodes)
        
        # Get number of nodes to generate
        sample_count = self.node_count_distribution.sample(total_node_count)
        node_count = node_count if node_count != -1 else round(sample_count)
        
        
        
        
        
        return graph


class CommGraphGenerator:
    def __init__(self):
        
        pass
    
    
    
    def generate_graph(self, node_count: int) -> nx.Graph:
        """
        Generates a communication graph with the given generator settings.
        """
    
        graph = nx.DiGraph()
    
        # Add nodes
        for i in range(node_count):
            graph.add_node(i)
            
        

        
    
        return graph
        
        
    
    

