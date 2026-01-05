
export interface GeneratedImage {
  url: string;
  prompt: string;
  timestamp: number;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface BrandConfig {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  vibe: string;
}
