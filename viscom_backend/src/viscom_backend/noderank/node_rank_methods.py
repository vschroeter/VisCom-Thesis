from viscom_backend.noderank.commgraph_centrality import calculate_commgraph_centrality
import networkx as nx

def mirrored_harmonic_centrality(G, distance="distance"):
    """
    Compute the harmonic centrality for nodes.
    """
    centrality = nx.harmonic_centrality(G, distance=distance)
    reversed_centrality = nx.harmonic_centrality(G.reverse(), distance=distance)
    for node in centrality:
        centrality[node] = (centrality[node] + reversed_centrality[node]) / 2

    return centrality

node_rank_methods_config = {
    "pagerank": {
        "params": [{"key": "alpha", "type": "float", "description": "Damping parameter for PageRank", "range": [0.0, 1.0], "default": 0.85}],
        "description": "PageRank computes a ranking of the nodes in the graph G based on the structure of the incoming links.",
        "method": nx.pagerank,
    },
    "degree_centrality": {
        "params": [],
        "description": "Compute the degree centrality for nodes.",
        "method": nx.degree_centrality,
    },
    "eigenvector_centrality": {
        "params": [{"key": "max_iter", "type": "int", "description": "Maximum number of iterations in power method eigenvalue solver", "range": [1, 1000], "default": 100}],
        "description": "Compute the eigenvector centrality for the graph G.",
        "method": nx.eigenvector_centrality,
        "convert_to_simple_graph": True,
        "weight": "weight",
    },
    "closeness_centrality": {
        "params": [{"key": "wf_improved", "type": "bool", "description": "Use Wasserman and Faust's formula for closeness", "default": False}],
        "description": "Compute closeness centrality for nodes.",
        "distance": "distance",
        "reverse_graph": True,
        "convert_to_simple_graph": True,
        "method": nx.closeness_centrality,
    },
    "closeness_centrality_reversed": {
        "params": [{"key": "wf_improved", "type": "bool", "description": "Use Wasserman and Faust's formula for closeness", "default": False}],
        "description": "Compute reversed closeness centrality for nodes.",
        "distance": "distance",
        "convert_to_simple_graph": True,
        "reverse_graph": False,
        "method": nx.closeness_centrality,
    },
    "betweenness_centrality": {
        "params": [
            {
                "key": "normalized",
                "type": "bool",
                "description": "If True the betweenness values are normalized by 2/((n-1)(n-2)) for graphs, and 1/((n-1)(n-2)) for directed graphs where n is the number of nodes in G.",
                "default": True,
            }
        ],
        # "distance": "weight",
        "weight": "distance",
        "description": "Compute the shortest-path betweenness centrality for nodes.",
        "method": nx.betweenness_centrality,
    },
    "commgraph_centrality": {
        "params": [
            {
                "key": "mode",
                "type": "choice",
                "choices": ["reachability", "closeness", "significance", "degree", "harmonic"],
                "description": "The mode to calculate the commgraph centrality",
                "default": "significance",
            }
        ],
        "description": "Compute the commgraph centrality for nodes.",
        "method": calculate_commgraph_centrality,
    },
    # "local_reaching_centrality": {
    #     "params": [],
    #     "description": "Compute the local reaching centrality for nodes.",
    #     "method": nx.local_reaching_centrality,
    # },
    "harmonic_centrality": {
        "params": [],
        "description": "Compute harmonic centrality for nodes.",
        "method": nx.harmonic_centrality,
        "distance": "distance",
    },
    "mirrored_harmonic_centrality": {
        "params": [],
        "description": "Compute harmonic centrality for nodes.",
        "method": mirrored_harmonic_centrality,
        "distance": "distance",
    },
    "katz_centrality": {
        "params": [{"key": "alpha", "type": "float", "description": "Katz centrality parameter", "range": [0.0, 1.0], "default": 0.1}],
        "description": "Compute the Katz centrality for the nodes of the graph G.",
        "weight": "weight",
        "convert_to_simple_graph": True,
        "method": nx.katz_centrality,
    },
    "global_reaching_centrality": {
        "params": [],
        "description": "Compute the global reaching centrality for nodes.",
        "method": nx.global_reaching_centrality,
    },
    "voterank": {
        "params": [],
        "description": "Compute the vote ranking for nodes.",
        "method": nx.voterank,
    },
    "percolation_centrality": {
        "params": [],
        "description": "Compute the percolation centrality for nodes.",
        "method": nx.percolation_centrality,
        "weight": "distance",
    },
    "laplacian_centrality": {
        "params": [],
        "description": "Compute the Laplacian centrality for nodes.",
        "convert_to_simple_graph": True,
        "method": nx.laplacian_centrality,
    }
}
