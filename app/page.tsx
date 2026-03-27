import { RentalProvider } from '@/lib/rental-context';
import { RentalFlow } from '@/components/rental/rental-flow';

export default function HomePage() {
  return (
    <RentalProvider>
      <div className="min-h-screen bg-background max-w-md mx-auto">
        <RentalFlow />
      </div>
    </RentalProvider>
  );
}
