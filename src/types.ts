/**
 * MVP data model.
 *
 * The portal used to describe a backpack holding several ground sensors. For
 * this release the deployable unit is a single drone, and the only sub-unit is
 * the camera it carries.
 */

export type LinkStatus = 'online' | 'connecting' | 'offline';

export interface DroneCameraUnit {
  id: string;
  name: string;
  /** Gimbal tilt in degrees; negative looks down. */
  tilt: number;
  /**
   * The onboard camera is reachable from the backend already
   * (server/drone.py → DroneController.camera: photo, recording, RTSP stream,
   * gimbal and zoom), but nothing in the UI drives it yet. Kept in the model so
   * the manager page can show the unit honestly as present-but-not-wired.
   */
  streamWired: boolean;
}

export interface DroneUnit {
  serial: string;
  name: string;
  model: string;
  /** Local record only — the aircraft's real battery is not polled yet. */
  battery: number;
  status: LinkStatus;
  camera: DroneCameraUnit;
}

export interface UserSession {
  username: string;
  droneSerial: string;
}
