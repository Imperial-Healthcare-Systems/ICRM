import { redirect } from 'next/navigation'

export default function NewEstimateRedirect() {
  redirect('/quotations/new?as_estimate=true')
}
