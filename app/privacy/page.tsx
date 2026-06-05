export const metadata = {
  title: 'Privacy Policy | PowerDon',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-background">
      <header className="shrink-0 border-b border-border/60 px-4 py-3">
        <a href="/" className="text-sm font-medium text-primary">
          ← Back
        </a>
        <h1 className="mt-2 text-lg font-semibold tracking-tight">Privacy Policy</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-5 text-sm leading-relaxed text-muted-foreground">
        <p className="text-xs text-muted-foreground/80">Last updated: June 4, 2026</p>
        <p className="mt-4 text-foreground">
          PowerDon processes personal data to provide power bank rental services, including
          email, payment information handled by Stripe, and session history. We do not sell
          personal data to third parties.
        </p>
        <h2 className="mt-6 text-base font-semibold text-foreground">Data we collect</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Contact information (email, optional name)</li>
          <li>Rental and payment transaction records</li>
          <li>Support ticket content you submit</li>
        </ul>
        <h2 className="mt-6 text-base font-semibold text-foreground">Your rights</h2>
        <p className="mt-2">
          You may request access, correction, or deletion of your data by contacting support
          through the in-app support form or your event operator.
        </p>
      </main>
    </div>
  )
}
