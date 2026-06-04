export const metadata = {
  title: 'Terms of Service | PowerDon',
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 prose prose-neutral dark:prose-invert">
      <h1>Terms of Service</h1>
      <p>Last updated: June 4, 2026</p>
      <p>
        By using PowerDon rental services you agree to pay applicable rental fees, return
        equipment to an authorized station, and accept liability for unreturned devices per
        the deposit terms shown at checkout.
      </p>
      <h2>Rental terms</h2>
      <ul>
        <li>Deposits are pre-authorized and captured based on actual rental duration.</li>
        <li>Rewards and promotions are subject to campaign rules displayed in the app.</li>
        <li>Abuse of stations or fraudulent activity may result in account suspension.</li>
      </ul>
      <p>
        <a href="/">Return to PowerDon</a>
      </p>
    </main>
  )
}
