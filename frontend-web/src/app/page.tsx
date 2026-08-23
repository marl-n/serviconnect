// Root redirect — sends to dashboard if logged in, else login
import { redirect } from 'next/navigation'
export default function Home() {
  redirect('/dashboard')
}
