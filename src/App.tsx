import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import DroneManager from './pages/DroneManager';
import DroneControlPanel from './pages/DroneControlPanel';
import InsightPreview from './pages/InsightPreview';
import { DroneUnit, UserSession } from './types';

export type Page = 'home' | 'manage' | 'control' | 'insights';

const DEFAULT_DRONE: DroneUnit = {
  serial: 'ANAFI-H083200',
  name: 'Field Unit 01',
  model: 'Parrot ANAFI',
  battery: 100,
  status: 'offline',
  camera: {
    id: 'cam-onboard',
    name: 'Onboard Gimbal Camera',
    tilt: 0,
    streamWired: false,
  },
};

/**
 * Read persisted state, falling back when it does not match the current shape.
 * Browsers that used the multi-sensor backpack build still hold records with a
 * `backpacks` array and no `droneSerial`; `isValid` rejects those instead of
 * letting `undefined` reach the UI.
 */
function load<T>(key: string, fallback: T, isValid: (value: any) => boolean): T {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved);
    return isValid(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() =>
    load<UserSession | null>(
      'backpack_user',
      { username: 'advisor_spruce', droneSerial: DEFAULT_DRONE.serial },
      v => v && typeof v.username === 'string' && typeof v.droneSerial === 'string'
    )
  );
  const [drone, setDrone] = useState<DroneUnit>(() =>
    load('backpack_drone', DEFAULT_DRONE, v => v && typeof v.serial === 'string' && v.camera)
  );

  useEffect(() => {
    if (currentUser) localStorage.setItem('backpack_user', JSON.stringify(currentUser));
    else localStorage.removeItem('backpack_user');
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('backpack_drone', JSON.stringify(drone));
  }, [drone]);

  const handlePair = (serial: string, name?: string) => {
    const cleaned = serial.trim().toUpperCase() || DEFAULT_DRONE.serial;
    setDrone(prev => ({ ...prev, serial: cleaned, name: name?.trim() || prev.name }));
    setCurrentUser({ username: name?.trim() || 'field_operator', droneSerial: cleaned });
    setCurrentPage('manage');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentPage('home');
  };

  const renderActivePage = () => {
    switch (currentPage) {
      case 'manage':
        return <DroneManager drone={drone} setDrone={setDrone} onNavigate={setCurrentPage} />;
      case 'control':
        return <DroneControlPanel />;
      case 'insights':
        return <InsightPreview onNavigate={setCurrentPage} />;
      case 'home':
      default:
        return (
          <Home
            currentUser={currentUser}
            drone={drone}
            onNavigate={setCurrentPage}
            onPair={handlePair}
            onLogout={handleLogout}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-stone-100 selection:bg-emerald-200">
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main className="flex-grow">{renderActivePage()}</main>
    </div>
  );
}
