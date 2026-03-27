'use client';

import { useRental } from '@/lib/rental-context';
import { LandingScreen } from './landing-screen';
import { UserInfoScreen } from './user-info-screen';
import { PaymentScreen } from './payment-screen';
import { UnlockingScreen } from './unlocking-screen';
import { ActiveRentalScreen } from './active-rental-screen';
import { ReturningScreen } from './returning-screen';
import { ReturnCompleteScreen } from './return-complete-screen';
import { RewardScreen } from './reward-screen';
import { ErrorScreen } from './error-screen';

export function RentalFlow() {
  const { flow } = useRental();

  switch (flow.step) {
    case 'landing':
      return <LandingScreen />;
    case 'info':
      return <UserInfoScreen />;
    case 'payment':
      return <PaymentScreen />;
    case 'unlocking':
      return <UnlockingScreen />;
    case 'active':
      return <ActiveRentalScreen />;
    case 'returning':
      return <ReturningScreen />;
    case 'complete':
      return <ReturnCompleteScreen />;
    case 'reward':
      return <RewardScreen />;
    case 'error':
      return <ErrorScreen />;
    default:
      return <LandingScreen />;
  }
}
