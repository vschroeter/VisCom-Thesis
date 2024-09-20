import networkx as nx

from commgraph_backend.commgraph.converter import convert_node_connections_graph_to_topic_graph
from commgraph_backend.data.reader import RosMetaSysGraphGenerator

ds = RosMetaSysGraphGenerator.get_available_datasets(True)

self_driving_json = [d for d in ds if "selfdriving" in d][0]

# print(ds)

graph = RosMetaSysGraphGenerator.read_graph_from_file(self_driving_json)

# for link in graph.edges(data=True):
#     print(link)

topic_graph = convert_node_connections_graph_to_topic_graph(graph)

for link in topic_graph.edges(data=True):
    print(link)

centrality = nx.betweenness_centrality(topic_graph)
for node, value in centrality.items():
    print(node, value)

print(5)
# comm_graph =
