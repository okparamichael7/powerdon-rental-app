export const metadata = {
  title: 'Terms of Service | Powerdon',
}

export default function TermsPage() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-background">
      <header className="shrink-0 border-b border-border/60 px-4 py-3">
        <a href="/" className="text-sm font-medium text-primary">
          ← Back
        </a>
        <h1 className="mt-2 text-lg font-semibold tracking-tight">Terms of Service</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-5 text-sm leading-relaxed text-muted-foreground">
        <p className="text-xs text-muted-foreground/80">Last updated: June 4, 2026</p>
        <p className="mt-4 text-foreground">
          By using Powerdon rental services you agree to pay applicable rental fees, return
          equipment to an authorized station, and accept liability for unreturned devices per
          the deposit terms shown at checkout.
        </p>
        <h2 className="mt-6 text-base font-semibold text-foreground">Rental terms</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Deposits are pre-authorized and captured based on actual rental duration.</li>
          <li>Rewards and promotions are subject to campaign rules displayed in the app.</li>
          <li>Abuse of stations or fraudulent activity may result in account suspension.</li>
        </ul>
      </main>
    </div>
  )
}
