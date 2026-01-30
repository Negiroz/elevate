import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnnouncements } from '../AnnouncementContext';
import { useUsers } from '../UserContext';

const WelcomeScreen: React.FC = () => {
    const navigate = useNavigate();
    const { activeAnnouncements, loading } = useAnnouncements();
    const { user } = useUsers();
    const [currentIndex, setCurrentIndex] = useState(0);

    // Auto-advance slider if multiple slides and has images
    useEffect(() => {
        if (activeAnnouncements.length > 1) {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % activeAnnouncements.length);
            }, 5000); // 5 seconds per slide
            return () => clearInterval(interval);
        }
    }, [activeAnnouncements.length]);

    const handleContinue = () => {
        navigate('/dashboard');
    };

    if (loading) return null;

    // If no active announcements, skip directly to dashboard
    if (activeAnnouncements.length === 0) {
        navigate('/dashboard');
        return null;
    }

    const currentAnnouncement = activeAnnouncements[currentIndex];

    return (
        <div className="fixed inset-0 bg-[#0B1118] z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#0B1118] via-transparent to-[#0B1118] z-10" />
                {currentAnnouncement.image_url && (
                    <img
                        key={currentAnnouncement.image_url}
                        src={currentAnnouncement.image_url}
                        className="w-full h-full object-cover opacity-20 blur-sm scale-105 animate-in fade-in duration-1000"
                        alt="Background"
                    />
                )}
            </div>

            <div className="max-w-4xl w-full z-20 relative flex flex-col items-center">

                {/* Main Card */}
                <div className="w-full bg-surface-dark border border-border-dark rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[500px] animate-in slide-in-from-bottom-10 fade-in duration-700">

                    {/* Image Section */}
                    <div className="w-full md:w-1/2 h-64 md:h-auto relative overflow-hidden bg-black/50">
                        {currentAnnouncement.image_url ? (
                            <img
                                src={currentAnnouncement.image_url}
                                className="w-full h-full object-cover"
                                alt={currentAnnouncement.title}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-surface-dark">
                                <span className="material-symbols-outlined text-8xl text-primary/30">campaign</span>
                            </div>
                        )}

                        {/* Pagination Dots (Mobile Overlay) */}
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10 md:hidden">
                            {activeAnnouncements.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-6' : 'bg-white/30'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                                    Novedades
                                </span>
                                <span className="text-text-secondary text-xs font-medium">
                                    {new Date(currentAnnouncement.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            <h1 className="text-3xl md:text-4xl font-black text-white mb-6 leading-tight">
                                {currentAnnouncement.title}
                            </h1>

                            <div className="prose prose-invert prose-sm text-text-secondary max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                <p className="whitespace-pre-line text-lg leading-relaxed">
                                    {currentAnnouncement.message}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 mt-8">
                            {/* Pagination Dots (Desktop) */}
                            {activeAnnouncements.length > 1 && (
                                <div className="hidden md:flex gap-2 mb-4">
                                    {activeAnnouncements.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentIndex(idx)}
                                            className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-primary' : 'w-2 bg-border-dark hover:bg-white/20'}`}
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-6 border-t border-border-dark/30">
                                <button
                                    onClick={() => setCurrentIndex(prev => (prev - 1 + activeAnnouncements.length) % activeAnnouncements.length)}
                                    className="p-2 text-text-secondary hover:text-white disabled:opacity-0"
                                    disabled={activeAnnouncements.length <= 1}
                                >
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>

                                <button
                                    onClick={handleContinue}
                                    className="px-8 py-3 bg-white text-background-dark font-black rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-xl shadow-white/5"
                                >
                                    Continuar al Sistema
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </button>

                                <button
                                    onClick={() => setCurrentIndex(prev => (prev + 1) % activeAnnouncements.length)}
                                    className="p-2 text-text-secondary hover:text-white disabled:opacity-0"
                                    disabled={activeAnnouncements.length <= 1}
                                >
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="mt-8 text-text-secondary text-sm font-medium">
                    Hola, <span className="text-white">{user?.firstName}</span>. ¡Bienvenido de nuevo!
                </p>
            </div>
        </div>
    );
};

export default WelcomeScreen;
