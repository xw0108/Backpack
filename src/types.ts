export type DeviceType = 'honeypot' | 'camera' | 'audio';

export interface Device {
  id: string;
  type: DeviceType;
  gridX: number; // Percentage coordinate on canvas matching relative container (10 to 90)
  gridY: number; // Percentage coordinate on canvas matching relative container (10 to 90)
  rotation: number; // Direction the camera or sensor faces (in degrees)
  battery: number; // Current simulated charge level (0-100)
  status: 'online' | 'syncing' | 'offline';
  name: string;
  lastTriggered?: string;
}

export interface UserSession {
  username: string;
  backpacks: string[];
}

export interface WildcardAlert {
  id: string;
  type: 'sound' | 'vision' | 'lora';
  nodeId: string;
  message: string;
  timestamp: string;
}

export interface PhotoCapture {
  id: string;
  imageUrl: string;
  detectedLabel: string;
  confidence: number;
  time: string;
  nodeName: string;
  verified?: boolean;
  userCorrection?: string;
}
