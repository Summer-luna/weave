import { useQuery } from '@tanstack/react-query';
import { blockService } from '../services/block-service';
import { queryKeys } from './query-keys';

export function useBlockRef(id: string) {
  return useQuery({
    queryKey: queryKeys.blockRef(id),
    queryFn: () => blockService.getOne(id),
    staleTime: 30_000,
  });
}
