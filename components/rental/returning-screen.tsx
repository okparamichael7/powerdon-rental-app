'use client';

import { motion } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { VoltLogo } from '@/components/volt/icons';

export function ReturningScreen() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        {/* Loading Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative mb-8"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-20 h-20"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-muted"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="70 213"
                transform="rotate(-90 50 50)"
                className="text-primary"
              />
            </svg>
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center">
            <VoltLogo size={28} className="text-primary" />
          </div>
        </motion.div>

        {/* Status Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <p className="text-xs font-medium tracking-wider text-primary uppercase mb-2">Processing</p>
          <h1 className="text-2xl font-bold text-foreground">Returning power bank...</h1>
          <p className="text-muted-foreground mt-2">
            Please wait while we process your return.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
