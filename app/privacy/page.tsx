export const metadata = {
  title: 'Privacy Policy | PowerDon',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 prose prose-neutral dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p>Last updated: June 4, 2026</p>
      <p>
        PowerDon processes personal data to provide power bank rental services, including
        email, payment information handled by Stripe, and session history. We do not sell
        personal data to third parties.
      </p>
      <h2>Data we collect</h2>
      <ul>
        <li>Contact information (email, optional name)</li>
        <li>Rental and payment transaction records</li>
        <li>Support ticket content you submit</li>
      </ul>
      <h2>Your rights</h2>
      <p>
        You may request access, correction, or deletion of your data by contacting support
        through the in-app support form or your event operator.
      </p>
      <p>
        <a href="/">Return to PowerDon</a>
      </p>
    </main>
  )
}
