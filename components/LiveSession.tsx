import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, X } from 'lucide-react';
import { useLiveApi } from '../hooks/useLiveApi';

interface LiveSessionProps {
    onClose: () => void;
}

export const LiveSession: React.FC<LiveSessionProps> = ({ onClose }) => {
    const { isConnected, isConnecting, error, connect, disconnect, volume } = useLiveApi({});
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const volumeRef = useRef(0);

    // Sync volume to ref for animation loop
    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);

    // Auto-connect on mount
    useEffect(() => {
        connect();
        return () => {
             // connection cleanup handled by useLiveApi hook on unmount
        };
    }, [connect]);

    // Visualizer Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            const width = canvas.width;
            const height = canvas.height;
            
            ctx.clearRect(0, 0, width, height);
            
            // Draw a simple wave or circle based on volume
            const centerX = width / 2;
            const centerY = height / 2;
            const maxRadius = Math.min(width, height) / 2 - 10;
            
            // Use ref value for animation to avoid re-binding loop
            const currentVolume = volumeRef.current;

            // Base circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
            ctx.fillStyle = isConnected ? '#3b82f6' : '#64748b';
            ctx.fill();

            if (isConnected) {
                // Pulse ring
                const radius = 40 + (currentVolume * (maxRadius - 40));
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(59, 130, 246, ${0.5 - currentVolume * 0.2})`;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Second pulse
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(96, 165, 250, ${0.3})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            animationRef.current = requestAnimationFrame(draw);
        };
        
        draw();
        
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isConnected]); // Only restart loop if connection state changes

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full relative shadow-2xl flex flex-col items-center">
                <button 
                    onClick={() => { disconnect(); onClose(); }} 
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="mb-8 relative w-64 h-64 flex items-center justify-center">
                    <canvas 
                        ref={canvasRef} 
                        width={300} 
                        height={300} 
                        className="absolute inset-0 w-full h-full"
                    />
                    <div className="relative z-10 pointer-events-none">
                         {isConnected ? (
                             <Mic size={40} className="text-white" />
                         ) : (
                             <Activity size={40} className="text-slate-300 animate-pulse" />
                         )}
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                    {isConnecting ? "Connecting..." : isConnected ? "Listening..." : "Disconnected"}
                </h2>
                <p className="text-slate-400 text-center mb-8">
                    {isConnected 
                        ? "BizFlow Pro is ready. Ask about your workflows or business tasks." 
                        : "Establishing secure connection to Gemini Live API..."}
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/50 text-red-200 rounded-lg text-sm border border-red-700/50">
                        {error}
                    </div>
                )}

                <div className="flex space-x-4">
                     {isConnected ? (
                         <button 
                            onClick={disconnect}
                            className="flex items-center space-x-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-colors shadow-lg shadow-red-500/20"
                         >
                            <MicOff size={20} />
                            <span>Stop Session</span>
                         </button>
                     ) : !isConnecting && (
                         <button 
                            onClick={connect}
                            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors shadow-lg shadow-blue-600/20"
                         >
                            <Mic size={20} />
                            <span>Retry Connection</span>
                         </button>
                     )}
                </div>
            </div>
        </div>
    );
};