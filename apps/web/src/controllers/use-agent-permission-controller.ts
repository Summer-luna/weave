import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentPermissionRepository } from '../repositories/agent-permission-repository';
import type { AgentPermissionLevel } from '../types/models';

const PERMISSION_KEY = ['agentPermission'] as const;

export function useAgentPermissionController() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: PERMISSION_KEY, queryFn: () => agentPermissionRepository.get() });
  const mutation = useMutation({
    mutationFn: (level: AgentPermissionLevel) => agentPermissionRepository.set(level),
    onSuccess: (level) => queryClient.setQueryData(PERMISSION_KEY, level),
  });

  return {
    level: query.data,
    loading: query.isPending,
    failed: query.isError || mutation.isError,
    saving: mutation.isPending,
    change: (level: AgentPermissionLevel) => mutation.mutate(level),
  };
}
