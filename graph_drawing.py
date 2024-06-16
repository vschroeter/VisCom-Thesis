
import networkx as nx
import matplotlib.pyplot as plt

# G = nx.complete_graph(8)
G = nx.extended_barabasi_albert_graph(100, 1, 0.1, 0.5, 42)
G.to_directed()

# Adapt window size of the plot
plt.gcf().set_size_inches(15, 15)

pos = nx.kamada_kawai_layout(G)
nx.draw(G, pos)



plt.show()

