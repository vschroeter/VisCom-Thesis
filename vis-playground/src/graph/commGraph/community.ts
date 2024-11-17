export class NodeCommunity {
    nodeIds: string[] = [];

    nodeIsInCommunity(nodeId: string): boolean {
        return this.nodeIds.includes(nodeId);
    }
}

export class NodeCommunities {
    communities: NodeCommunity[] = [];

    /**
     * Set all nodes to a community
     * @param nodeIds 
     * @returns 
     */
    initDefaultCommunities(nodeIds: string[]) {
        this.communities = [new NodeCommunity()];
        this.communities[0].nodeIds = nodeIds;
    }


    getCommunitiesOfNode(nodeId?: string): number[] {
        if (!nodeId) {
            return [];
        }
        
        return this.communities
            .map((community, index) => {
                return community.nodeIsInCommunity(nodeId) ? index : -1;
            })
            .filter((index) => index >= 0);
    }

    setCommunitiesByList(communitiesIds: string[][]) {
        this.communities = communitiesIds.map((communityIds) => {
            const community = new NodeCommunity();
            community.nodeIds = communityIds;
            return community;
        });
    }

    getAsIdLists(): string[][] {
        return this.communities.map(community => community.nodeIds);
    }

    get countOfCommunities(): number {
        return this.communities.length;
    }
}
