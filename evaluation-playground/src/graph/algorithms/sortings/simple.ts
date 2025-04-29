import { CommunicationGraph, CommunicationNode } from "src/graph/commGraph";
import { Sorter } from "./sorting";
import { LayoutNode } from "src/graph/visGraph/layoutNode";

export class RandomSorter extends Sorter {
    protected override sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {
        return nodes.sort(() => Math.random() - 0.5);
    }
}

export class IdSorter extends Sorter {
    protected override sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {
        return nodes.sort((a, b) => a.id.localeCompare(b.id));
    }
}


export class DegreeSorter extends Sorter {
    protected override sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {
        // return nodes.sort((a, b) => a.degree - b.degree).reverse();
        return nodes.sort((a, b) => {
            if (a.degree === b.degree) {
                return a.id.localeCompare(b.id);
            }
            return a.degree - b.degree;
        }).reverse();
    }
}

export class ChildrenCountSorter extends Sorter {
    protected override sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {
        return nodes.sort((a, b) => {
            if (a.getSuccessors().length === b.getSuccessors().length) {
                return a.id.localeCompare(b.id);
            }
            return a.getSuccessors().length - b.getSuccessors().length;
        }).reverse();
    }
}


export class NodeScoreSorter extends Sorter {
    protected override sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {
        return nodes.sort((a, b) => {
            if (Math.abs(a.scoreIncludingChildren - b.scoreIncludingChildren) < 0.01) {
                return b.id.localeCompare(a.id);
            }
            return a.scoreIncludingChildren - b.scoreIncludingChildren;
        }).reverse();
    }
}


export class BreadthFirstSorter extends Sorter {
    protected override sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {

        if (this.startNodeSelectionSorter) {
            nodes = this.startNodeSelectionSorter.getSorting(nodes);
        }
        const visited = new Set<LayoutNode>();
        const sorted: LayoutNode[] = [];

        const allowedNodes = new Set(nodes.map(n => n.id));

        while (nodes.length > 0) {
            const nextNode = nodes.shift()!;

            if (visited.has(nextNode)) {
                continue;
            }

            const queue = [nextNode];

            while (queue.length > 0) {
                const node = queue.shift()!;
                if (visited.has(node) || !allowedNodes.has(node.id)) {
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
    protected override sortingImplementation(nodes: LayoutNode[]): LayoutNode[] {

        if (this.startNodeSelectionSorter) {
            nodes = this.startNodeSelectionSorter.getSorting(nodes);
        }
        const visited = new Set<LayoutNode>();
        const sorted: LayoutNode[] = [];

        const allowedNodes = new Set(nodes.map(n => n.id));

        const visit = (node: LayoutNode) => {
            if (visited.has(node) || !allowedNodes.has(node.id)) {
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

