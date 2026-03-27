'use client';

import { motion } from 'framer-motion';
import { MobileHeader } from '@/components/volt/mobile-header';
import { XCircleIcon, HeadphonesIcon } from '@/components/volt/icons';
import { Button } from '@/components/ui/button';
import { useRental } from '@/lib/rental-context';

interface ErrorScreenProps {
  type?: 'connection' | 'payment' | 'station' | 'general';
  message?: string;
}

const errorConfig = {
  connection: {
    title: 'Connection Failed',
    description: 'We could not connect to the station. Please check your internet connection and try again.',
    action: 'Try Again',
  },
  payment: {
    title: 'Payment Failed',
    description: 'Your payment could not be processed. Please try a different payment method or contact your bank.',
    action: 'Try Payment',
  },
  station: {
    title: 'Station Unavailable',
    description: 'This station is currently offline or under maintenance. Please try a nearby station.',
    action: 'Find Nearby',
  },
  general: {
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Our team has been notified. Please try again.',
    action: 'Try Again',
  },
};

export function ErrorScreen({ type = 'general', message }: ErrorScreenProps) {
  const { setFlow } = useRental();
  const config = errorConfig[type];

  const handleRetry = () => {
    setFlow((prev) => ({ ...prev, step: 'landing' }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader />
      
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6"
        >
          <XCircleIcon size={40} className="text-destructive" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center max-w-sm"
        >
          <h1 className="text-2xl font-bold text-foreground mb-2">{config.title}</h1>
          <p className="text-muted-foreground">
            {message || config.description}
          </p>
        </motion.div>

        {type === 'station' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 p-4 bg-muted rounded-xl w-full max-w-sm"
          >
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Error Code:</span> STN_OFFLINE_001
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">Station:</span> A12 - Main Stage Hub
            </p>
          </motion.div>
        )}

        <div className="flex-1" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-sm space-y-3 mt-8"
        >
          <Button 
            onClick={handleRetry}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
          >
            {config.action}
          </Button>
          
          <Button
            variant="outline"
            className="w-full h-14 text-base font-semibold rounded-2xl"
          >
            <HeadphonesIcon size={18} />
            Contact Support
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
