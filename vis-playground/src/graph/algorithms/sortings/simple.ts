import { CommunicationGraph, CommunicationNode } from "src/graph/commGraph";
import { Sorter } from "./sorting";

export class RandomSorter extends Sorter {
    protected sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {
        return nodes.sort(() => Math.random() - 0.5);
    }
}

export class IdSorter extends Sorter {
    protected sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {        
        return nodes.sort((a, b) => a.id.localeCompare(b.id));        
    }
}


export class DegreeSorter extends Sorter {
    protected sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {        
        return nodes.sort((a, b) => a.degree - b.degree).reverse();      
    }
}

export class ChildrenCountSorter extends Sorter {
    protected sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {        
        return nodes.sort((a, b) => a.getSuccessors().length - b.getSuccessors().length).reverse();
    }
}



export class BreadthFirstSorter extends Sorter {
    protected sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {

        if (this.startNodeSelectionSorter) {
            nodes = this.startNodeSelectionSorter.getSorting(nodes);
        }
        const visited = new Set<CommunicationNode>();
        const sorted: CommunicationNode[] = [];

        while (nodes.length > 0) {
            const nextNode = nodes.shift()!;

            if (visited.has(nextNode)) {
                continue;
            }

            const queue = [nextNode];

            while (queue.length > 0) {
                const node = queue.shift()!;
                if (visited.has(node)) {
                    continue;
                }
                visited.add(node);
                sorted.push(node);
                queue.push(...node.getSuccessors());
            }
        }        
        return sorted;
    }
}

export class DepthFirstSorter extends Sorter {
    protected sortingImplementation(nodes: CommunicationNode[]): CommunicationNode[] {

        if (this.startNodeSelectionSorter) {
            nodes = this.startNodeSelectionSorter.getSorting(nodes);
        }
        const visited = new Set<CommunicationNode>();
        const sorted: CommunicationNode[] = [];

        const visit = (node: CommunicationNode) => {
            if (visited.has(node)) {
                return;
            }
            visited.add(node);
            sorted.push(node);
            node.getSuccessors().forEach(visit);
        };

        nodes.forEach(visit);

        return sorted;
    }
}

