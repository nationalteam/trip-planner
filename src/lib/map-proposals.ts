type ProposalLike = {
  id: string;
  status: string;
};

type ItineraryItemLike = {
  activity?: {
    id: string;
  };
  proposal?: {
    id: string;
  };
};

export type MapProposal<T extends ProposalLike> = T & {
  isArranged: boolean;
};

export function buildMapProposals<T extends ProposalLike>(
  proposals: T[],
  itinerary: ItineraryItemLike[]
): Array<MapProposal<T>> {
  const arrangedProposalIds = new Set(
    itinerary
      .map((item) => item.activity?.id ?? item.proposal?.id)
      .filter((id): id is string => Boolean(id))
  );
  return proposals
    .filter((proposal) => proposal.status !== 'rejected')
    .map((proposal) => ({
      ...proposal,
      isArranged: arrangedProposalIds.has(proposal.id),
    }));
}
