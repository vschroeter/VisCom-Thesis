import { CommunicationGraph } from "src/graph/commGraph";
import { VisGraph } from "src/graph/visGraph/visGraph";

export function commGraphToDOT(commGraph: CommunicationGraph): string {
    let dot = 'digraph G {\n';
    commGraph.getAllLinks().forEach((link) => {
        if (link.channel.type == "PubSub") {
            dot += `  "${link.fromId}" -> "${link.toId}" [label="${link.topic.id}"];\n`;
        } else {
            dot += `  "${link.fromId}" -> "${link.toId}" [label="${link.topic.id}"];\n`;
        }
    });
    dot += '}';
    return dot;
}


export function visGraphToDOT(visGraph: VisGraph, options?: {
    allConnections?: boolean;
    adaptSizeToScore?: boolean;
    includeEdgeLabels?: boolean;
    includeNodeLabels?: boolean;
    layoutEngine?: "dot" | "circo" | "fdp" | "neato" | "twopi" | "sfdp" | "osage" | "patchwork";
}): string {

    const allConnections = options?.allConnections ?? false;
    const adaptSizeToScore = options?.adaptSizeToScore ?? false;
    const includeEdgeLabels = options?.includeEdgeLabels ?? false;
    const includeNodeLabels = options?.includeNodeLabels ?? false;

    let dot = 'digraph G {\n';

    if (adaptSizeToScore) {
        dot += "{"

        visGraph.allLeafLayoutNodes.forEach((node) => {
            const w = node.radius / 10;
            const h = node.radius / 10;
            if (includeNodeLabels) {
                dot += `  "${node.id}" [label="${node.id}" shape=circle, width=${w}, height=${h} fixedsize=true];\n`;
            } else {
                dot += `  "${node.id}" [shape=circle, width=${w}, height=${h} fixedsize=true];\n`;
            }
        });

        dot += "}\n"
    }

    if (allConnections) {
        visGraph.getAllConnections().forEach((connection) => {

            connection.getLinks().forEach((link) => {
                const id = link.topic.id;
                if (includeEdgeLabels) {
                    dot += `  "${connection.fromId}" -> "${connection.toId}" [label="${id}"];\n`;
                } else {
                    dot += `  "${connection.fromId}" -> "${connection.toId}";\n`;
                }
            });
        });
    }
    else {
        visGraph.getAllConnections().forEach((connection) => {
            dot += `  "${connection.fromId}" -> "${connection.toId}";\n`;
        });
    }

    dot += '}';
    return dot;
}

export async function renderGraphViz(
    dotString: string,
    engine: "dot" | "circo" | "fdp" | "neato" | "twopi" | "sfdp" | "osage" | "patchwork" = "dot"
): Promise<string> {
    // The backend API URL
    const apiUrl = 'http://localhost:5000/render/graphViz';

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                dot: dotString,
                engine: engine
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        return data.svg;
    } catch (error) {
        console.error('Error rendering GraphViz:', error);
        throw error;
    }
}

