import { redirect } from 'next/navigation';

// Keep existing bookmarks on the single account management entry point.
export default function SettingsPermissionsPage() {
  redirect('/admin');
}
