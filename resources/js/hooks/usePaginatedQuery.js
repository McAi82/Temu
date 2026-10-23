import { useQuery } from '@tanstack/react-query';

export const usePaginatedQuery = (queryKey, fetchFn, page = 1, perPage = 20) => {
  return useQuery({
    queryKey: [...queryKey, page, perPage],
    queryFn: () => fetchFn(page, perPage),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};