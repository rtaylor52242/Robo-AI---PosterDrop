
export enum VideoGenerationStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface GeneratedVideo {
  id: string;
  prompt: string;
  url: string | null;
  status: VideoGenerationStatus;
}

export interface PosterGenerationState {
  productImage: string | null;
  posterAspectRatio: string;
  posterSlogan: string;
  generatedPoster: string | null;
  locationPrompts: string[];
  generatedVideos: GeneratedVideo[];
  isLoadingPoster: boolean;
  error: string | null;
}
