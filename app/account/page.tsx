import Nav from '@/components/Nav';
import ChangePasswordForm from './ChangePasswordForm';

export default function AccountPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Nav />
      <h1 className="font-display font-bold text-2xl tracking-wide mb-1">MY ACCOUNT</h1>
      <p className="text-inkSoft text-sm mb-6">Change your own password. This does not affect anyone else's account.</p>
      <ChangePasswordForm />
    </div>
  );
}
