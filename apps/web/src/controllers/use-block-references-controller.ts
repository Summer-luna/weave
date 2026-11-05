import { useQuery } from '@tanstack/react-query';
import { blockService } from '../services/block-service';
import { queryKeys } from './query-keys';

export function useBlockReferencesController(id: string) {
  return useQuery({ queryKey: queryKeys.blockReferences(id), queryFn: () => blockService.references(id) });
}
