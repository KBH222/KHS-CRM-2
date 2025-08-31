/**
 * Job type definitions for KHS CRM
 */

export type JobStatus = 'pending' | 'in-progress' | 'completed';

export interface Photo {
  id: string;
  url: string;
  name: string;
  size?: number;
  type?: string;
}

export interface Document {
  id: string;
  url: string;
  name: string;
  size?: number;
  type?: string;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface Job {
  id: string;
  customerId: string;
  title: string;
  description: string;
  status: JobStatus;
  photos: Photo[];
  plans: Document[];
  lists?: string;
  notes?: string;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobDTO {
  customerId: string;
  title: string;
  description?: string;
  lists?: string;
  notes?: string;
}

export interface UpdateJobDTO extends Partial<CreateJobDTO> {
  id: string;
  photos?: Photo[];
  plans?: Document[];
  comments?: Comment[];
}