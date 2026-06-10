import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ControlCenter from './pages/ControlCenter';
import CampSimulator from './pages/CampSimulator';
import CampInsight from './pages/CampInsight';
import { Device, UserSession, PhotoCapture } from './types';

export type Page = 'home' | 'control' | 'simulator' | 'insights';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('backpack_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved user', e);
      }
    }
    return {
      username: 'advisor_spruce',
      backpacks: ['BP-2026-X8', 'BP-2026-M4']
    };
  });

  // Global register of backpack serial numbers to their active virtual sensors
  const [backpackDevices, setBackpackDevices] = useState<Record<string, Device[]>>(() => {
    const saved = localStorage.getItem('backpack_devices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved devices', e);
      }
    }
    return {
      'BP-2026-X8': [
        { id: 'hp-1', type: 'honeypot', gridX: 50, gridY: 50, rotation: 0, battery: 100, status: 'online', name: 'Altar Bait' },
        { id: 'cam-1', type: 'camera', gridX: 42, gridY: 42, rotation: 135, battery: 84, status: 'online', name: 'Creek-Facing Cam' },
        { id: 'cam-2', type: 'camera', gridX: 58, gridY: 58, rotation: 315, battery: 92, status: 'online', name: 'Glade-Facing Cam' },
        { id: 'aud-1', type: 'audio', gridX: 50, gridY: 30, rotation: 180, battery: 78, status: 'online', name: 'Birch Grove Mic' }
      ],
      'BP-2026-M4': [
        { id: 'hp-2', type: 'honeypot', gridX: 50, gridY: 50, rotation: 0, battery: 100, status: 'offline', name: 'Marsh Target' }
      ]
    };
  });

  const [selectedBackpack, setSelectedBackpack] = useState<string>(() => {
    return localStorage.getItem('backpack_selected') || 'BP-2026-X8';
  });

  // Sync to localStorage
  React.useEffect(() => {
    if (currentUser) {
      localStorage.setItem('backpack_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('backpack_user');
    }
  }, [currentUser]);

  React.useEffect(() => {
    localStorage.setItem('backpack_devices', JSON.stringify(backpackDevices));
  }, [backpackDevices]);

  React.useEffect(() => {
    localStorage.setItem('backpack_selected', selectedBackpack);
  }, [selectedBackpack]);

  // Simulated Species Verification (Citizen Science Deck)
  const [photoCaptures, setPhotoCaptures] = useState<PhotoCapture[]>([
    {
      id: 'photo-1',
      imageUrl: 'https://images.unsplash.com/photo-1484406566174-9da000fda645?q=80&w=600&auto=format&fit=crop',
      detectedLabel: 'White-tailed Deer',
      confidence: 85,
      time: '11:42 PM',
      nodeName: 'Creek-Facing Cam',
      verified: false
    },
    {
      id: 'photo-2',
      imageUrl: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=600&auto=format&fit=crop',
      detectedLabel: 'Red Fox',
      confidence: 91,
      time: '02:15 AM',
      nodeName: 'Glade-Facing Cam',
      verified: false
    },
    {
      id: 'photo-3',
      imageUrl: 'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?q=80&w=600&auto=format&fit=crop',
      detectedLabel: 'North American Raccoon',
      confidence: 78,
      time: '04:08 AM',
      nodeName: 'Creek-Facing Cam',
      verified: false
    },
    {
      id: 'photo-4',
      imageUrl: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?q=80&w=600&auto=format&fit=crop',
      detectedLabel: 'Black Bear',
      confidence: 62,
      time: '05:30 AM',
      nodeName: 'Glade-Facing Cam',
      verified: false
    },
    {
      id: 'photo-5',
      imageUrl: 'https://images.unsplash.com/photo-1591824438708-ce405f36bc32?q=80&w=600&auto=format&fit=crop',
      detectedLabel: 'Coyote',
      confidence: 55,
      time: '06:12 AM',
      nodeName: 'Creek-Facing Cam',
      verified: false
    }
  ]);

  const [simulatedScore, setSimulatedScore] = useState<number>(0);

  // Global user management simulated helpers
  const handleLogin = (username: string, serialInput?: string, initDevices?: Device[]) => {
    if (serialInput) {
      // Direct serial code entry bypass
      const serial = serialInput.trim().toUpperCase();
      setCurrentUser({
        username: `Guest_${serial}`,
        backpacks: [serial]
      });
      setBackpackDevices(prev => ({
        ...prev,
        [serial]: initDevices || prev[serial] || []
      }));
      setSelectedBackpack(serial);
    } else {
      // standard login
      setCurrentUser({
        username: username,
        backpacks: ['BP-2026-X8', 'BP-2026-M4']
      });
      setSelectedBackpack('BP-2026-X8');
    }
    setCurrentPage('control');
  };

  const handleRegisterBackpack = (serial: string, parsedDevices?: Device[]) => {
    const rawSerial = serial.trim().toUpperCase() || `BP-2026-NEW`;
    setBackpackDevices(prev => ({
      ...prev,
      [rawSerial]: parsedDevices || prev[rawSerial] || []
    }));

    if (currentUser) {
      if (!currentUser.backpacks.includes(rawSerial)) {
        setCurrentUser({
          ...currentUser,
          backpacks: [...currentUser.backpacks, rawSerial]
        });
      }
    } else {
      setCurrentUser({
        username: 'independent_scout',
        backpacks: [rawSerial]
      });
    }
    setSelectedBackpack(rawSerial);
    setCurrentPage('control');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentPage('home');
  };

  const renderActivePage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <Home 
            currentUser={currentUser} 
            onNavigate={setCurrentPage} 
            onLogin={handleLogin}
            onRegister={handleRegisterBackpack}
            onLogout={handleLogout}
          />
        );
      case 'control':
        return (
          <ControlCenter 
            devices={backpackDevices[selectedBackpack] || []} 
            setDevices={(updater) => {
              setBackpackDevices(prev => {
                const current = prev[selectedBackpack] || [];
                const nextDevices = typeof updater === 'function' ? updater(current) : updater;
                return {
                  ...prev,
                  [selectedBackpack]: nextDevices
                };
              });
            }}
            selectedBackpack={selectedBackpack}
            currentUser={currentUser}
            setSelectedBackpack={setSelectedBackpack}
            onRegister={handleRegisterBackpack}
          />
        );
      case 'simulator':
        return (
          <CampSimulator
            devices={backpackDevices[selectedBackpack] || []}
            photoCaptures={photoCaptures}
            setPhotoCaptures={setPhotoCaptures}
            simulatedScore={simulatedScore}
            setSimulatedScore={setSimulatedScore}
          />
        );
      case 'insights':
        return (
          <CampInsight 
            photoCaptures={photoCaptures}
            setPhotoCaptures={setPhotoCaptures}
            simulatedScore={simulatedScore} 
            setSimulatedScore={setSimulatedScore}
            selectedBackpack={selectedBackpack}
          />
        );
      default:
        return <Home currentUser={currentUser} onNavigate={setCurrentPage} onLogin={handleLogin} onRegister={handleRegisterBackpack} onLogout={handleLogout} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-stone-100 selection:bg-emerald-200">
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} currentUser={currentUser} onLogout={handleLogout} />
      <main className="flex-grow">
        {renderActivePage()}
      </main>
    </div>
  );
}
