import { CommunicationGraph } from "../commGraph";
import { AbstractConnection2d, AbstractNode2d } from "../graphical";
import { Graph2d } from "../graphical/Graph2d";
import { UserInteractions } from "../visualizations/interactions";
import { CommonSettings } from "./settings/commonSettings";
import { GraphLayouterSettings } from "./settings/settings";

import * as d3 from 'd3';

export class GraphLayouter<T extends GraphLayouterSettings> {

    settings: T;
    commonSettings: CommonSettings;
    userInteractions: UserInteractions;
    commGraph: CommunicationGraph;
    graph2d: Graph2d;
    calculateMetrics: boolean = true;

    protected events: { [key: string]: ((this: GraphLayouter<any>) => void) } = {};

    constructor(graph2d: Graph2d, settings: T, commonSettings: CommonSettings, userInteractions: UserInteractions) {
        this.commGraph = graph2d.commGraph;
        this.settings = settings;
        this.graph2d = graph2d;
        this.commonSettings = commonSettings;
        this.userInteractions = userInteractions;
    }

    updateGraphByCommongSettings() {
        this.graph2d.nodes.forEach(node => {
            node.radius = this.commonSettings.nodeSize.getValue(node) ?? 10;
        });
    }

    updateLayout(isUpdate: boolean = false): void {
        this.updateGraphByCommongSettings();
        this.layout(isUpdate);
    }

    layout(isUpdate = false): void {
        throw new Error("Method not implemented.");
    }

    getFilteredLinks() {
        const filteredLinks = this.graph2d?.links.filter(l => {
            const weight = l.data?.weight ?? 1;
            // const distance = 1 / weight;

            return weight > (this.commonSettings.hideLinksThreshold.getValue() ?? 100);
        })
        // console.log("Filtered links", filteredLinks);
        return filteredLinks;
    }

    reset() {
        this.graph2d.nodes.forEach(node => {
            node.x = 0;
            node.y = 0;
            node.vx = 0;
            node.vy = 0;
            node.fx = null;
            node.fy = null;
        });

        this.layout();
    }

    protected emitEvent(type: "update" | "end") {
        if (this.events[type]) {
            this.events[type].call(this);
        }
    }

    on(typenames: "update" | "end", listener: null | ((this: GraphLayouter<any>) => void)) {
        if (listener == null) {
            delete this.events[typenames];
            return;
        } else {
            this.events[typenames] = listener;
        }
    }

    updateNodes(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>, events?: {
        mouseenter?: (d: AbstractNode2d, e: MouseEvent) => void,
        mouseleave?: (d: AbstractNode2d, e: MouseEvent) => void,
        click?: (d: AbstractNode2d, e: MouseEvent) => void
    }) {
        const communitiesColorScheme = d3.interpolateSinebow;
        const nodeRankingColorScheme = d3.interpolateRdYlGn;

        const nodes = selection.selectAll('circle')
            .data(this.graph2d?.nodes)
            .join('circle')
            .attr('cx', (d: AbstractNode2d) => d.x)
            .attr('cy', (d: AbstractNode2d) => d.y)
            .attr('r', d => d.radius)
            // .attr('fill', d => this.commonSettings.nodeColor.getValue(d) ?? "red")
            .attr('fill', d => {
                const rankExtent = this.commGraph.ranking.getRankExtent();                
                const nodeRanking = this.commGraph.ranking.getRankOfNode(d.data);
                if (nodeRanking === undefined || rankExtent[0] == Infinity || rankExtent[1] == -Infinity) {
                    return this.commonSettings.nodeColor.getValue(d) ?? "red";
                }

                const scale = d3.scaleLinear().domain(rankExtent).range([0, 1]);

                return nodeRankingColorScheme(scale(nodeRanking));

            })
            // .attr('stroke', 'white')
            .attr('stroke', d => {
                const communities = this.commGraph.communities.getCommunitiesOfNode(d.data);

                if (communities.length === 0) {
                    return 'white';
                }

                const totalCommunityCount = this.commGraph.communities.communities.length;
                if (totalCommunityCount === 0) {
                    return 'white';
                }

                const colors = communities.map(community => {
                    const positionOfNodeCommunity = community / totalCommunityCount;
                    return d3.hsl(communitiesColorScheme(positionOfNodeCommunity));
                });
                
                // console.log(colors);
                // Get the average color of all communities
                const averageColor = d3.hsl(d3.mean(colors, c => c.h)!, d3.mean(colors, c => c.s)!, d3.mean(colors, c => c.l)!);
                return averageColor.formatRgb();

                // // Position on color scheme between 0 and 1
                // const positionOfNodeCommunity = communities[0] / totalCommunityCount;

                // return communitiesColorScheme(positionOfNodeCommunity);
            })
            .attr('stroke-width', 2)
            .attr('opacity', d => {

                if (this.userInteractions.somethinIsSelectedOrFocusedOrHovered) {

                    // if (this.userInteractions.)) {
                    //     return 1;
                    // }

                    if (this.userInteractions.isHovered(d)) {
                        return 1;
                    }

                    return 0.2;
                }

                return 1;

            })
        // .on('mouseenter', (e, d) => {
        //     console.log("Mouse enter", d, e);
        // })

        if (events?.click) nodes.on("click", (e, d) => events.click?.(d, e))
        if (events?.mouseleave) nodes.on("mouseleave", (e, d) => events.mouseleave?.(d, e))
        if (events?.mouseenter) nodes.on("mouseenter", (e, d) => events.mouseenter?.(d, e))
    }

    updateLinks(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>) {

        const opacityGetter = (d: AbstractConnection2d) => {
            const weight = d.data?.weight ?? 1;
            // const adaptedWeight = Math.max(0.2, Math.sqrt(weight));
            const adaptedWeight = Math.max(0.05, weight);
            if (this.userInteractions.somethinIsSelectedOrFocusedOrHovered) {

                const startNode = d.source;
                const endNode = d.target;
                // if (this.userInteractions.)) {
                //     return 1;
                // }
        
                if (this.userInteractions.isHovered(startNode) || this.userInteractions.isHovered(endNode)) {
                    return 1;
                }

                return 0.4 * adaptedWeight;
            }

            return adaptedWeight;
        }

        const wMultiplier = 2;
        const minW = 0.1;

        selection.selectAll('path.arrow')
            // .data(this.graph2d?.links)
            .data(this.getFilteredLinks())
            .join('path')
            .classed('arrow', true)
            .attr('d', (d: AbstractConnection2d) => d.getArrowPath())
            .attr('stroke', (l) => this.commonSettings.linkColor.getValue(l) ?? "black")
            .attr('stroke-width', (l) => {
                const weight = l.data?.weight ?? 1;
                return Math.max(minW, weight * wMultiplier);
            })
            .attr('fill', 'none')
            .attr('opacity', opacityGetter)

        selection.selectAll('path.link')
            // .data(this.graph2d?.links)
            .data(this.getFilteredLinks())
            .join('path')
            .classed('link', true)
            .attr('d', (d: AbstractConnection2d) => d.getSvgPath())
            .attr('stroke', (l) => this.commonSettings.linkColor.getValue(l) ?? "black")
            .attr('stroke-width', (l) => {
                const weight = l.data?.weight ?? 1;
                return Math.max(minW, weight * wMultiplier);
            })
            .attr('fill', 'none')
            .attr('opacity', opacityGetter)


    }

    updateLabels(selection: d3.Selection<SVGGElement | null, unknown, null, undefined>) {
        selection.selectAll('text')
            .data(this.graph2d?.nodes)
            .join('text')
            .attr('x', (d: AbstractNode2d) => d.x + 10)
            .attr('y', (d: AbstractNode2d) => d.y)
            .text((d: AbstractNode2d) => d.data?.id ?? "")
    }

}