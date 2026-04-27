import { redirect } from 'next/navigation';

// /client/trainers is the legacy URL. Sidebar links to /client/staff (the new
// page that uses correct staff_id field names). The old page UI sent
// `trainer_id` to an API expecting `staff_id`, which silently broke
// Edit/Pause/Remove. Rather than fix dead code, redirect so any old bookmark,
// email link, or doc reference lands on the working page.
export default function TrainersRedirect(): never {
  redirect('/client/staff');
}
