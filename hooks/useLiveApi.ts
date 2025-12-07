import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface UseLiveApiReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  volume: number;
}

export interface UseLiveApiConfig {
  model?: string;
  systemInstruction?: string;
}

export const useLiveApi = (config: UseLiveApiConfig = {}): UseLiveApiReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Helper: Decode base64 to Uint8Array
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // Helper: Encode Uint8Array to base64
  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Helper: Downsample buffer (e.g. 48000 -> 16000)
  const downsample = (buffer: Float32Array, inputRate: number, outputRate: number) => {
    if (inputRate === outputRate) return buffer;
    const ratio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
        const index = i * ratio;
        const floor = Math.floor(index);
        const ceil = Math.ceil(index);
        const t = index - floor;
        
        // Simple linear interpolation
        const v0 = buffer[floor] || 0;
        const v1 = buffer[ceil] || buffer[floor] || 0; // Handle end of buffer
        
        result[i] = v0 + (v1 - v0) * t;
    }
    return result;
  };

  // Helper: Create Blob from Float32Array
  const createBlob = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      // Scale to 16-bit integer range
      int16[i] = Math.max(-1, Math.min(1, data[i])) * 0x7FFF;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  // Helper: Decode Audio Data
  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    
    // Create a buffer with the explicit sample rate (24000)
    // The browser will handle playback on the system context (e.g. 48000) automatically
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Use default sample rates (likely 44100 or 48000) to avoid NotSupportedError
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      inputContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: config.model || 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: config.systemInstruction || "You are BizFlow Pro, a helpful and efficient AI business assistant. You speak clearly and professionally.",
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
        },
        callbacks: {
          onopen: () => {
            console.log('Live Session Opened');
            setIsConnected(true);
            setIsConnecting(false);

            // Audio Processing Chain
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Simple volume meter
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(1, rms * 5)); 

              // Downsample to 16000Hz before sending
              const downsampledData = downsample(inputData, inputCtx.sampleRate, 16000);
              const pcmBlob = createBlob(downsampledData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              if (base64Audio && audioContextRef.current) {
                const ctx = audioContextRef.current;
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio),
                  ctx,
                  24000, // Gemini response is 24kHz
                  1
                );
                
                // Ensure smooth playback
                const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.start(startTime);
                
                nextStartTimeRef.current = startTime + audioBuffer.duration;
                sourcesRef.current.add(source);
                
                source.onended = () => {
                  sourcesRef.current.delete(source);
                };
              }
            }
            
            if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(src => {
                    try { src.stop(); } catch(e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log('Live Session Closed');
            setIsConnected(false);
          },
          onerror: (e) => {
            console.error('Live Session Error', e);
            setError("Connection error. Please try again.");
            setIsConnected(false);
            setIsConnecting(false);
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to Live API");
      setIsConnecting(false);
    }
  }, [config.model, config.systemInstruction]);

  const disconnect = useCallback(() => {
    // Stop Microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Stop Processing
    if (scriptProcessorRef.current && inputContextRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
    }

    // Stop Playback
    sourcesRef.current.forEach(src => {
        try { src.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            if (typeof session.close === 'function') {
                session.close();
            }
        });
        sessionPromiseRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setVolume(0);
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { isConnected, isConnecting, error, connect, disconnect, volume };
};