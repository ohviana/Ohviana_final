import { redirect } from 'next/navigation';

/** Customers manage their account on My bookings; old links land there. */
export default function AccountPage() {
  redirect('/my-bookings');
}
