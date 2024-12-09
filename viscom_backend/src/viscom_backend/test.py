import networkx as nx

from viscom_backend.commgraph.converter import convert_normal_graph_to_commgraph, convert_to_weighted_graph
from viscom_backend.communities.community_detection import CommGraphCommunityDetector
from viscom_backend.data.reader import RosMetaSysGraphGenerator
from viscom_backend.noderank.commgraph_centrality import calculate_commgraph_centrality, get_commgraph_node_clusters

ds = RosMetaSysGraphGenerator.get_available_datasets(True)

self_driving_json = [d for d in ds if "0026nodes" in d][0]
# self_driving_json = [d for d in ds if "handcraftedBroadcastExample" in d][0]
# self_driving_json = [d for d in ds if "handcraftedBroadcastExample" in d][0]
# self_driving_json = [d for d in ds if "significanceTest" in d][0]
# self_driving_json = [d for d in ds if "0122" in d][0]
# self_driving_json = [d for d in ds if "handcraftedOverlappingCommunityExample.json" in d][0]

# print(ds)



graph = RosMetaSysGraphGenerator.read_graph_from_file(self_driving_json)
# graph = convert_normal_graph_to_commgraph(nx.karate_club_graph())
for link in convert_to_weighted_graph(graph).edges(data=True):
    print(link)

nodes_to_keep = [
    "asr_vosk",
    "flint_node",
    "robot_smalltalk",
    "facialexpressionmanager_node",
    "jokes_node",
    "system_information",
    "display_mouth",
    "display_eye_left",
    "display_eye_right",
    "stepper_node",
    "servo_node",
    "i2c_bridge_node",
]

nodes_to_keep = [
    "respeaker",
    "tts_pico",
    "kwd_precise",
    "status_visualizer_led",
    "loudness_analyser",
    "equalizer",
    "sound_sink_pulse",
    "dialog_session_manager",
    "/dialog/tts_guard",
    "sound_fx",
    "sample_player",
    "facialexpressionmanager_node",
]

nodes_to_keep = [
    "flint_node",
    "asr_vosk",
    "robot_smalltalk",
    "jokes_node",
    "system_information",
    "respeaker",
    "tts_pico",
    "equalizer",
    "sound_sink_pulse",
    "loudness_analyser",
    "dialog_session_manager",
    "status_visualizer_led",
    "kwd_precise",
    "sample_player",
    "sound_fx",
    "/dialog/tts_guard",
]

# # Remove all nodes that are not in the list
# nodes_to_remove = [node for node in graph.nodes() if node not in nodes_to_keep]
# # print(nodes_to_remove)
# graph.remove_nodes_from(nodes_to_remove)

# # print(len(graph.nodes()))

# # # Remove node with name "facialexpressionmanager_node"
# # graph.remove_node("facialexpressionmanager_node")
# graph.remove_node("dialog_session_manager")
# # graph.remove_node("flint_node")

# centrality, closeness = get_commgraph_centrality(graph)
centrality_significance = calculate_commgraph_centrality(graph, mode="significance")
centrality_reachability = calculate_commgraph_centrality(graph, mode="reachability")
centrality_closeness = calculate_commgraph_centrality(graph, mode="closeness")
centrality_degree = calculate_commgraph_centrality(graph, mode="degree", normalize=False)

# topic_graph = convert_node_connections_graph_to_topic_graph(graph)

# for link in topic_graph.edges(data=True):
#     print(link)

# centrality = nx.betweenness_centrality(topic_graph)
# for node, value in centrality.items():
#     rounded_value = round(value, 3)
#     print(rounded_value, node)

for node in centrality_degree:
    v0 = round(centrality_degree[node], 4)
    v1 = round(centrality_significance[node], 4)
    v2 = round(centrality_reachability[node], 4)
    v3 = round(centrality_closeness[node], 4)

    # Get also the places of node in the different lists
    value0 = list(centrality_degree.keys()).index(node)
    value1 = list(centrality_significance.keys()).index(node)
    value2 = list(centrality_reachability.keys()).index(node)
    value3 = list(centrality_closeness.keys()).index(node)

    print(f"{v0:<6} {v1:<6} {v2:<6} {v3:<6} {node} ({value1}, {value2}, {value3})")
    # print(node, value1, value2)

# print("\nCloseness:")

# for node, value in closeness.items():
#     rounded_value = round(value, 4)
#     print(rounded_value, node)
# print("\nClusters:")
# get_commgraph_node_clusters(graph)

detector = CommGraphCommunityDetector(graph)
comms = detector.calculate_commgraph_communities()
print(f"\nCommunities:")
for comm in comms:
    print(comm)

print("\nSplitted nodes:")
for splitted, node in detector.communities.splitted_nodes_to_original_nodes.items():
    print(splitted, "-->", node)
print(5)
# comm_graph =
