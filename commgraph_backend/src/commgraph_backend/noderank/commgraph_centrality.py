import networkx as nx

from commgraph_backend.commgraph.converter import convert_node_connections_graph_to_topic_graph


def get_commgraph_centrality(graph: nx.MultiDiGraph) -> dict[str, float]:
    """
    Compute the commgraph centrality for nodes.
    """

    topic_graph = convert_node_connections_graph_to_topic_graph(graph)
    # for link in topic_graph.edges(data=True):
    #     print(link)
    centrality = nx.betweenness_centrality(topic_graph)
    
    # Sort the centrality values
    centrality = dict(sorted(centrality.items(), key=lambda item: item[1], reverse=True))

    for node, value in centrality.items():
        print(node, value)
    
    return centrality
