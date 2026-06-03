'use client';

import { useState, useCallback, useEffect } from 'react';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { XCircleIcon, RefreshIcon } from '@/components/volt/icons';
import { Camera, CameraOff, Flashlight, FlashlightOff } from 'lucide-react';

interface QRScannerProps {
  onScan: (stationId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

// Parse QR code data to extract station ID
// Supports formats:
// - Direct station ID: "A12" or "STN-A12"
// - URL format: "https://app.powerdon.com/rent?station=A12"
// - URL format: "https://app.powerdon.com/s/A12"
function parseQRCode(data: string): string | null {
  if (!data) return null;
  
  const trimmed = data.trim();
  
  // Try URL parsing first
  try {
    const url = new URL(trimmed);
    
    // Check for query param format: ?station=A12
    const stationParam = url.searchParams.get('station') || url.searchParams.get('s');
    if (stationParam) {
      return stationParam.toUpperCase();
    }
    
    // Check for path format: /s/A12 or /rent/A12
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      const lastPart = pathParts[pathParts.length - 1];
      if (/^[A-Z0-9-]+$/i.test(lastPart)) {
        return lastPart.toUpperCase();
      }
    }
  } catch {
    // Not a URL, continue with other parsing
  }
  
  // Direct station ID format: "A12" or "STN-A12"
  const stationMatch = trimmed.match(/^(?:STN-)?([A-Z0-9-]+)$/i);
  if (stationMatch) {
    return stationMatch[1].toUpperCase();
  }
  
  // JSON format (some QR generators output JSON)
  try {
    const json = JSON.parse(trimmed);
    if (json.stationId) return json.stationId.toUpperCase();
    if (json.station) return json.station.toUpperCase();
    if (json.id) return json.id.toUpperCase();
  } catch {
    // Not JSON
  }
  
  return null;
}

export function QRScanner({ onScan, onClose, isLoading = false }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Check camera permission on mount
  useEffect(() => {
    async function checkPermission() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      } catch (err) {
        console.error('Camera permission error:', err);
        setHasPermission(false);
        setError('Camera access denied. Please enable camera permissions in your browser settings.');
      }
    }
    checkPermission();
  }, []);

  const handleScan = useCallback((detectedCodes: IDetectedBarcode[]) => {
    if (isLoading || scanResult) return;
    
    for (const code of detectedCodes) {
      const rawValue = code.rawValue;
      if (!rawValue) continue;
      
      const stationId = parseQRCode(rawValue);
      if (stationId) {
        setScanResult(stationId);
        // Haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
        onScan(stationId);
        return;
      }
    }
  }, [onScan, isLoading, scanResult]);

  const handleError = useCallback((err: unknown) => {
    console.error('QR Scanner error:', err);
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please enable camera permissions.');
        setHasPermission(false);
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Unable to access camera. Please try again.');
      }
    }
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setScanResult(null);
    setHasPermission(null);
    // Re-trigger permission check
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      })
      .catch(() => {
        setHasPermission(false);
        setError('Camera access denied.');
      });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="text-white font-medium">Scan Station QR Code</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
          aria-label="Close scanner"
        >
          <XCircleIcon className="w-6 h-6" />
        </Button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <CameraOff className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-white text-lg font-medium mb-2">Camera Error</p>
              <p className="text-white/70 text-sm mb-6">{error}</p>
              <Button onClick={handleRetry} variant="secondary" className="gap-2">
                <RefreshIcon className="w-4 h-4" />
                Try Again
              </Button>
            </motion.div>
          ) : hasPermission === false ? (
            <motion.div
              key="no-permission"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-yellow-400" />
              </div>
              <p className="text-white text-lg font-medium mb-2">Camera Access Required</p>
              <p className="text-white/70 text-sm mb-6">
                Please allow camera access to scan the QR code on the charging station.
              </p>
              <Button onClick={handleRetry} variant="secondary" className="gap-2">
                <RefreshIcon className="w-4 h-4" />
                Request Permission
              </Button>
            </motion.div>
          ) : isLoading || scanResult ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80"
            >
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-white text-lg font-medium">
                {scanResult ? `Loading station ${scanResult}...` : 'Processing...'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="scanner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <Scanner
                onScan={handleScan}
                onError={handleError}
                constraints={{
                  facingMode: 'environment',
                }}
                formats={['qr_code']}
                components={{
                  audio: false,
                  torch: torchEnabled,
                  finder: true,
                }}
                styles={{
                  container: { 
                    width: '100%', 
                    height: '100%',
                  },
                  video: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  },
                }}
              />
              
              {/* Scanning overlay with viewfinder */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Dark overlay with transparent center */}
                <div className="absolute inset-0 bg-black/50" style={{
                  maskImage: 'radial-gradient(ellipse 60% 40% at 50% 50%, transparent 40%, black 41%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 60% 40% at 50% 50%, transparent 40%, black 41%)',
                }} />
                
                {/* Viewfinder frame */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg" />
                  
                  {/* Scanning line animation */}
                  <motion.div
                    className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
                    initial={{ top: '10%' }}
                    animate={{ top: ['10%', '90%', '10%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer with controls */}
      <div className="relative z-10 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-4 mb-4">
          {hasPermission && !error && !isLoading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTorchEnabled(!torchEnabled)}
              className="text-white hover:bg-white/20"
              aria-label={torchEnabled ? 'Turn off flashlight' : 'Turn on flashlight'}
            >
              {torchEnabled ? (
                <FlashlightOff className="w-6 h-6" />
              ) : (
                <Flashlight className="w-6 h-6" />
              )}
            </Button>
          )}
        </div>
        <p className="text-white/70 text-sm text-center">
          Point your camera at the QR code on the charging station
        </p>
      </div>
    </motion.div>
  );
}
