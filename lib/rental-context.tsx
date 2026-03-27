'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { RentalFlow } from './types';

interface RentalContextType {
  flow: RentalFlow;
  setFlow: (flow: RentalFlow | ((prev: RentalFlow) => RentalFlow)) => void;
  userEmail: string;
  setUserEmail: (email: string) => void;
  userName: string;
  setUserName: (name: string) => void;
  termsAccepted: boolean;
  setTermsAccepted: (accepted: boolean) => void;
  marketingConsent: boolean;
  setMarketingConsent: (consent: boolean) => void;
  sessionId: string;
  setSessionId: (id: string) => void;
  rewardCode: string;
  setRewardCode: (code: string) => void;
  elapsedMinutes: number;
  setElapsedMinutes: (minutes: number) => void;
  amountCharged: number;
  setAmountCharged: (amount: number) => void;
}

const defaultFlow: RentalFlow = {
  step: 'landing',
  stationId: 'A12',
  stationName: 'Main Stage Hub',
  campaignId: 'CMP-001',
  campaignName: 'Sundance Festival',
  slotNumber: 4,
  hourlyRate: 2.00,
  depositAmount: 25.00,
  rewardThreshold: 60,
  rewardDescription: 'Rent for 60 mins and get a €10 voucher for Sundance merch.',
};

const RentalContext = createContext<RentalContextType | null>(null);

export function RentalProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<RentalFlow>(defaultFlow);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [rewardCode, setRewardCode] = useState('');
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [amountCharged, setAmountCharged] = useState(0);

  return (
    <RentalContext.Provider
      value={{
        flow,
        setFlow,
        userEmail,
        setUserEmail,
        userName,
        setUserName,
        termsAccepted,
        setTermsAccepted,
        marketingConsent,
        setMarketingConsent,
        sessionId,
        setSessionId,
        rewardCode,
        setRewardCode,
        elapsedMinutes,
        setElapsedMinutes,
        amountCharged,
        setAmountCharged,
      }}
    >
      {children}
    </RentalContext.Provider>
  );
}

export function useRental() {
  const context = useContext(RentalContext);
  if (!context) {
    throw new Error('useRental must be used within a RentalProvider');
  }
  return context;
}
