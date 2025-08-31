/**
 * useJobs Hook
 * 
 * Manages job data fetching, caching, and CRUD operations.
 * Uses React Query for server state management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { jobsApi } from '../services/api';
import { Job, CreateJobDTO, UpdateJobDTO, Photo, Document } from '../types';

// Query keys
export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (customerId?: string) => [...jobKeys.lists(), { customerId }] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
  customerJobs: (customerId: string) => [...jobKeys.all, 'customer', customerId] as const,
};

/**
 * Hook for fetching all jobs or jobs for a specific customer
 */
export function useJobs(customerId?: string) {
  return useQuery({
    queryKey: jobKeys.list(customerId),
    queryFn: async () => {
      try {
        if (customerId) {
          const response = await jobsApi.getByCustomerId(customerId);
          return response.data || [];
        } else {
          const response = await jobsApi.getAll();
          return response.data || [];
        }
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for fetching a single job by ID
 */
export function useJob(jobId: string) {
  return useQuery({
    queryKey: jobKeys.detail(jobId),
    queryFn: async () => {
      const response = await jobsApi.getById(jobId);
      return response.data;
    },
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for creating a new job
 */
export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobData: CreateJobDTO) => {
      const response = await jobsApi.create(jobData);
      return response.data;
    },
    onSuccess: (newJob) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.customerJobs(newJob.customerId) });
      
      toast.success('Job created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create job');
    },
  });
}

/**
 * Hook for updating an existing job
 */
export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateJobDTO) => {
      const { id, ...updateData } = data;
      const response = await jobsApi.update(id, updateData);
      return response.data;
    },
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: jobKeys.detail(data.id) });

      // Snapshot previous value
      const previousJob = queryClient.getQueryData(jobKeys.detail(data.id));

      // Optimistically update
      queryClient.setQueryData(jobKeys.detail(data.id), (old: any) => ({
        ...old,
        ...data,
      }));

      return { previousJob };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousJob) {
        queryClient.setQueryData(
          jobKeys.detail(variables.id),
          context.previousJob
        );
      }
      toast.error(error.response?.data?.message || 'Failed to update job');
    },
    onSuccess: (data, variables) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      if (data.customerId) {
        queryClient.invalidateQueries({ queryKey: jobKeys.customerJobs(data.customerId) });
      }
      toast.success('Job updated successfully');
    },
  });
}

/**
 * Hook for deleting a job
 */
export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, customerId }: { jobId: string; customerId: string }) => {
      await jobsApi.delete(jobId);
      return { jobId, customerId };
    },
    onMutate: async ({ jobId, customerId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: jobKeys.lists() });
      await queryClient.cancelQueries({ queryKey: jobKeys.customerJobs(customerId) });

      // Snapshot previous values
      const previousJobs = queryClient.getQueryData<Job[]>(jobKeys.lists());
      const previousCustomerJobs = queryClient.getQueryData<Job[]>(jobKeys.customerJobs(customerId));

      // Optimistically remove from lists
      queryClient.setQueryData<Job[]>(
        jobKeys.lists(),
        (old = []) => old.filter(j => j.id !== jobId)
      );
      queryClient.setQueryData<Job[]>(
        jobKeys.customerJobs(customerId),
        (old = []) => old.filter(j => j.id !== jobId)
      );

      return { previousJobs, previousCustomerJobs };
    },
    onError: (error: any, { jobId, customerId }, context) => {
      // Rollback on error
      if (context?.previousJobs) {
        queryClient.setQueryData(jobKeys.lists(), context.previousJobs);
      }
      if (context?.previousCustomerJobs) {
        queryClient.setQueryData(jobKeys.customerJobs(customerId), context.previousCustomerJobs);
      }
      toast.error(error.response?.data?.message || 'Failed to delete job');
    },
    onSuccess: ({ jobId, customerId }) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.customerJobs(customerId) });
      queryClient.removeQueries({ queryKey: jobKeys.detail(jobId) });
      
      toast.success('Job deleted successfully');
    },
  });
}

/**
 * Hook for managing job photos
 */
export function useJobPhotos(jobId: string) {
  const queryClient = useQueryClient();

  const addPhotos = useMutation({
    mutationFn: async (photos: Photo[]) => {
      const job = queryClient.getQueryData<Job>(jobKeys.detail(jobId));
      if (!job) throw new Error('Job not found');

      const updatedJob = {
        ...job,
        photos: [...(job.photos || []), ...photos],
      };

      const response = await jobsApi.update(jobId, updatedJob);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(jobKeys.detail(jobId), data);
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      toast.success(`${data.photos.length} photo(s) added`);
    },
    onError: () => {
      toast.error('Failed to add photos');
    },
  });

  const removePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      const job = queryClient.getQueryData<Job>(jobKeys.detail(jobId));
      if (!job) throw new Error('Job not found');

      const updatedJob = {
        ...job,
        photos: job.photos.filter(p => p.id !== photoId),
      };

      const response = await jobsApi.update(jobId, updatedJob);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(jobKeys.detail(jobId), data);
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      toast.success('Photo removed');
    },
    onError: () => {
      toast.error('Failed to remove photo');
    },
  });

  return { addPhotos, removePhoto };
}

/**
 * Hook for managing job documents/plans
 */
export function useJobDocuments(jobId: string) {
  const queryClient = useQueryClient();

  const addDocuments = useMutation({
    mutationFn: async (documents: Document[]) => {
      const job = queryClient.getQueryData<Job>(jobKeys.detail(jobId));
      if (!job) throw new Error('Job not found');

      const updatedJob = {
        ...job,
        plans: [...(job.plans || []), ...documents],
      };

      const response = await jobsApi.update(jobId, updatedJob);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(jobKeys.detail(jobId), data);
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      toast.success(`${data.plans.length} document(s) added`);
    },
    onError: () => {
      toast.error('Failed to add documents');
    },
  });

  const removeDocument = useMutation({
    mutationFn: async (documentId: string) => {
      const job = queryClient.getQueryData<Job>(jobKeys.detail(jobId));
      if (!job) throw new Error('Job not found');

      const updatedJob = {
        ...job,
        plans: job.plans.filter(d => d.id !== documentId),
      };

      const response = await jobsApi.update(jobId, updatedJob);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(jobKeys.detail(jobId), data);
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      toast.success('Document removed');
    },
    onError: () => {
      toast.error('Failed to remove document');
    },
  });

  return { addDocuments, removeDocument };
}

/**
 * Hook for job statistics and aggregations
 */
export function useJobStats(customerId?: string) {
  return useQuery({
    queryKey: ['jobStats', customerId],
    queryFn: async () => {
      const jobs = customerId 
        ? await jobsApi.getByCustomerId(customerId).then(res => res.data)
        : await jobsApi.getAll().then(res => res.data);

      const stats = {
        total: jobs.length,
        pending: jobs.filter(j => j.status === 'pending').length,
        inProgress: jobs.filter(j => j.status === 'in-progress').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        totalPhotos: jobs.reduce((sum, job) => sum + (job.photos?.length || 0), 0),
        totalDocuments: jobs.reduce((sum, job) => sum + (job.plans?.length || 0), 0),
      };

      return stats;
    },
    staleTime: 5 * 60 * 1000,
  });
}