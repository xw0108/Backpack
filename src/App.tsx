import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Sandbox from './pages/Sandbox';

export type Page = 'home' | 'sandbox' | 'feed' | 'insights';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onStart={() => setCurrentPage('sandbox')} />;
      case 'sandbox':
        return <Sandbox />;
      default:
        return (
          <div className="flex flex-col items-center justify-center min-vh-screen py-20 px-4">
            <h1 className="text-4xl font-bold text-nature-900 mb-4 opacity-50">Coming Soon</h1>
            <p className="text-nature-600">This module is under development.</p>
            <button 
              onClick={() => setCurrentPage('home')}
              className="mt-8 text-nature-700 hover:text-nature-900 underline"
            >
              Back to Home
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-grow">
        {renderPage()}
      </main>
    </div>
  );
}
