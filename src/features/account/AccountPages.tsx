import { useAuth0 } from '@auth0/auth0-react';
import { useState, type FormEvent } from 'react';
import { hasAuth0Configuration } from '../../auth/AuthProvider';
import { OperationsHeading } from '../../components/workspace/OperationsLayout';
import { clearNotificationWorkspace, requestApi } from '../notifications/api';
import { Icon } from '../../lib/icons';

const passwordPath = '/account/password';

function Auth0PasswordChange() {
  const { isLoading, isAuthenticated, loginWithRedirect, user } = useAuth0();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { VITE_AUTH0_DOMAIN: domain, VITE_AUTH0_CLIENT_ID: clientId, VITE_AUTH0_DB_CONNECTION: connection } = import.meta.env;
  const email = user?.email;

  async function sendReset() {
    if (!email || !connection || sending || sent) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch(`https://${domain}/dbconnections/change_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, email, connection }),
      });
      if (!response.ok) throw new Error('Password reset request failed.');
      setSent(true);
    } catch {
      setError('Could not send the reset email. Try again later.');
    } finally {
      setSending(false);
    }
  }

  if (isLoading) return <p role="status">Checking your session…</p>;
  if (!isAuthenticated) return <>
    <p>Sign in to manage your password.</p>
    <button className="button button--primary" type="button" onClick={() =>
      void loginWithRedirect({ appState: { returnTo: passwordPath } }).catch(() => setError('Could not open the sign-in page.'))}>
      Sign in
    </button>
    {error && <p role="alert">{error}</p>}
  </>;

  if (!user?.sub?.startsWith('auth0|')) return <p>Change your password with the provider you use to sign in.</p>;
  if (!connection || !email) return <p>Password reset is unavailable for this account. Contact your workspace administrator.</p>;

  return <>
    <form className="account-reset-form" onSubmit={(event) => { event.preventDefault(); void sendReset(); }}>
      <label>Sign-in email<input type="email" value={email} readOnly /></label>
      <button className="button button--primary" type="submit" disabled={sending || sent}>
        {sending ? 'Sending…' : sent ? 'Reset email requested' : 'Send password reset email'}
      </button>
    </form>
    {sent && <p role="status">Check your email for the password reset link.</p>}
    {error && <p role="alert">{error}</p>}
  </>;
}

function PasswordChangeForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (values.get('newPassword') !== values.get('confirmPassword')) {
      setError('The new passwords do not match.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await requestApi('session/password', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(values)) });
      clearNotificationWorkspace();
      sessionStorage.setItem('flowdeck.password-updated', 'true');
      window.location.replace('/login');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update your password.');
      setBusy(false);
    }
  }

  return <form className="account-reset-form" onSubmit={submit}>
    <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label>
    <label>New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} aria-describedby="password-length" />
      <small id="password-length">Use at least 8 characters</small>
    </label>
    <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
    {error && <p className="field-error" role="alert">{error}</p>}
    <button type="submit" className="button button--primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
  </form>;
}

export default function ChangePasswordPage({ onProfile, passwordMode }: { onProfile: () => void; passwordMode: boolean }) {
  return <div className="operations-page account-page">
    <div className="account-password-page">
      <OperationsHeading section="Account security" title="Change password" description="Manage the password you use to sign in to Flowdeck." />
      <section className="operations-card account-password">
        <span className="operations-tile"><Icon name="key" /></span>
        {passwordMode ? <PasswordChangeForm /> : hasAuth0Configuration() ? <Auth0PasswordChange /> : <>
          <p>The local demo account has no password to change.</p>
          <button className="button button--secondary" type="button" onClick={onProfile}>Back to my profile</button>
        </>}
      </section>
    </div>
  </div>;
}

function SignOutConfirmation({ onCancel, onSignOut, busy, error, local }: {
  onCancel: () => void; onSignOut: () => void; busy?: boolean; error?: string; local?: boolean;
}) {
  return <div className="operations-page account-page">
    <section className="operations-card account-logout">
      <span className="operations-tile"><Icon name="logout" /></span>
      <h1>Sign out of Flowdeck?</h1>
      <p>{local ? 'This ends the local demo session in this tab.' : 'You’ll need to sign in again to access workspace data.'}</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="operations-actions">
        <button type="button" className="button button--secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className="button button--primary" disabled={busy} onClick={onSignOut}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </section>
  </div>;
}

function AccountLogoutPage({ onCancel, passwordMode }: { onCancel: () => void; passwordMode: boolean }) {
  const { logout, isAuthenticated, isLoading } = useAuth0();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const checkingAuth0 = !passwordMode && isLoading;

  async function signOut() {
    if (busy || checkingAuth0) return;
    setError('');
    setBusy(true);
    clearNotificationWorkspace();
    try {
      if (passwordMode) {
        await requestApi('session/logout', { method: 'POST' });
        window.location.replace('/login');
      } else if (isAuthenticated) {
        await logout({ logoutParams: { returnTo: `${window.location.origin}/signed-out` } });
      } else {
        window.location.replace('/login');
      }
    } catch {
      setError('Could not sign out. Try again.');
      setBusy(false);
    }
  }

  return <SignOutConfirmation onCancel={onCancel} onSignOut={() => void signOut()} busy={busy || checkingAuth0} error={error} />;
}

export function LogoutPage({ onCancel, onLocalLogout, passwordMode }: { onCancel: () => void; onLocalLogout: () => void; passwordMode: boolean }) {
  return (passwordMode || hasAuth0Configuration()) ? <AccountLogoutPage passwordMode={passwordMode} onCancel={onCancel} /> :
    <SignOutConfirmation local onCancel={onCancel} onSignOut={onLocalLogout} />;
}

function Auth0SignIn() {
  const { loginWithRedirect } = useAuth0();
  const [error, setError] = useState('');
  return <>
    <button className="button button--primary" type="button" onClick={() =>
      void loginWithRedirect({ appState: { returnTo: '/dashboard' } }).catch(() => setError('Could not open the sign-in page.'))}>
      Sign in
    </button>
    {error && <p role="alert">{error}</p>}
  </>;
}

function PasswordSignIn() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setBusy(true);
    try {
      await requestApi('session/login', { method: 'POST', body: JSON.stringify(values) });
      sessionStorage.removeItem('flowdeck.password-updated');
      window.location.replace('/dashboard');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return <form className="login-form" onSubmit={submit}>
    <div>
      <label htmlFor="login-email">Work email</label>
      <div className="login-input"><Icon name="mail" /><input id="login-email" name="email" type="email" autoComplete="username" required maxLength={254} /></div>
    </div>
    <div>
      <div className="login-label"><label htmlFor="login-password">Password</label>
        <button type="button" className="login-help" aria-expanded={help} onClick={() => setHelp(!help)}>Forgot password?</button>
      </div>
      <div className="login-input"><Icon name="key" /><input id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} />
        <button type="button" className="login-visibility" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}><Icon name="eye" /></button>
      </div>
    </div>
    {help && <p role="status" className="login-note"><Icon name="shield" />Contact your workspace administrator to reset your password.</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">→</span></button>
  </form>;
}

export function SignedOutPage({ onResumeDemo, passwordMode }: { onResumeDemo?: () => void; passwordMode?: boolean }) {
  const updated = passwordMode && sessionStorage.getItem('flowdeck.password-updated') === 'true';
  return <main className="login-page">
    <aside className="login-brand">
      <div className="brand"><span className="brand-mark"><span /></span><span>Flowdeck</span></div>
      <p>One place to manage projects, tasks, and team workload.</p>
    </aside>
    <section className="login-panel" aria-labelledby="login-heading">
      <div className="login-content">
        <span className="operations-tile"><Icon name="lock" /></span>
        <h1 id="login-heading">Welcome back</h1>
        <p>Sign in to continue to your Flowdeck workspace.</p>
        {updated && <p role="status" className="login-note"><Icon name="shield" />Password updated. Sign in with your new password.</p>}
        {passwordMode ? <PasswordSignIn /> : hasAuth0Configuration() ? <Auth0SignIn /> : <>
          <button className="button button--primary" type="button" onClick={onResumeDemo}>Open demo workspace <span aria-hidden="true">→</span></button>
          <p className="login-note"><Icon name="shield" />Demo mode uses the configured local workspace.</p>
        </>}
      </div>
    </section>
  </main>;
}
