import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSquad as createSquadApi,
  getSquads,
  inviteToSquad as inviteToSquadApi,
  deleteSquad as deleteSquadApi,
} from "../api/social";
import { SquadDetail } from "../types/social";

export const useSquads = () => {
  const queryClient = useQueryClient();
  const squadsQuery = useQuery<SquadDetail[]>({
    queryKey: ["social", "squads"],
    queryFn: getSquads,
    retry: false,
  });

  const createSquadMutation = useMutation({
    mutationFn: (params: { name: string; description?: string; isPublic?: boolean }) =>
      createSquadApi(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social", "squads"] }),
  });

  const inviteToSquadMutation = useMutation({
    mutationFn: ({ squadId, handle }: { squadId: string; handle: string }) =>
      inviteToSquadApi(squadId, handle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social", "squads"] }),
  });

  const deleteSquadMutation = useMutation({
    mutationFn: (squadId: string) => deleteSquadApi(squadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social", "squads"] });
      queryClient.invalidateQueries({ queryKey: ["social", "squad-feed"] });
    },
  });

  return {
    ...squadsQuery,
    createSquad: createSquadMutation.mutateAsync,
    isCreatingSquad: createSquadMutation.isPending,
    inviteToSquad: inviteToSquadMutation.mutateAsync,
    isInvitingToSquad: inviteToSquadMutation.isPending,
    deleteSquad: deleteSquadMutation.mutateAsync,
    isDeletingSquad: deleteSquadMutation.isPending,
  };
};
