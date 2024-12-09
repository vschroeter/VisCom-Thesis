from __future__ import annotations

from viscom_backend.communities.community_detection import CommGraphCommunityDetector
import networkx as nx

MAX_NODES = 1000

default_params = [
    {"key": "ignore_threshold", "type": "float", "description": "Threshold for ignoring edges", "range": [0.0, 1.0], "default": 0.125},
]

community_methods_config = {
    "edge_betweenness_partition": {
        "params": [{"key": "number_of_sets", "type": "int", "description": "Number of communities to detect", "range": [1, MAX_NODES], "default": 2}],
        "description": "Partition created by iteratively removing the highest edge betweenness edge (basic Girvan-Newman algorithm).",
        "method": nx.community.edge_betweenness_partition,
    },
    "louvain": {
        "params": [{"key": "resolution", "type": "float", "description": "Value of the resolution parameter", "range": [0.0, 1.0], "default": 1.0}],
        "description": "Detects communities in the graph using the Louvain method.",
        # "method": nx.algorithms.community.modularity_max.greedy_modularity_communities
        "method": nx.community.louvain_communities,
    },
    "comm_splitter": {
        "params": [{"key": "split_penalty", "type": "float", "description": "Value of the split penalty", "range": [1.1, 100], "default": 1.5}],
        "description": "Detects communities in the graph using the comm_splitter method.",
        "method": CommGraphCommunityDetector.detect_communities
    }
}
