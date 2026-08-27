import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { post } from '../api';
import { useSession } from '../session';
import { Notice } from '../components/bits';

/* Sign in and sign up, on one page, because at this size a tab strip would
   be more chrome than choice. */

const ERRORS = {
  bad: 'That email and password combination did not match.',
  exists: 'An account with that email already exists.',
  missing: 'Email and password are both required.',
};

export default function Auth() {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const { state } = useLocation();

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);       // 'login' | 'signup'
  const [login, setLogin] = useState({ email: '', password: '' });
  const [signup, setSignup] = useState({ name: '', email: '', password: '' });

  async function submit(which, path, payload) {
    setBusy(which);
    setError(null);
    try {
      const result = await post(path, payload);
      await refresh();
      // A new account goes to onboarding; a returning one goes where it was
      // headed before the sign-in gate got in the way.
      navigate(result.next || state?.from || '/', { replace: true });
    } catch (err) {
      setError(ERRORS[err.code] || 'Something went wrong.');
      setBusy(null);
    }
  }

  return (
    <div className="wrap narrow">
      {error && <Notice tone="bad">{error}</Notice>}

      <h1>Sign in</h1>
      <form onSubmit={e => { e.preventDefault(); submit('login', '/api/login', login); }}>
        <label>Email</label>
        <input type="email" required value={login.email}
               onChange={e => setLogin({ ...login, email: e.target.value })} />
        <label>Password</label>
        <input type="password" required value={login.password}
               onChange={e => setLogin({ ...login, password: e.target.value })} />
        <div className="actions">
          <button disabled={busy !== null}>
            {busy === 'login' ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>

      <h2>New here?</h2>
      <form onSubmit={e => { e.preventDefault(); submit('signup', '/api/signup', signup); }}>
        <label>Name</label>
        <input type="text" required value={signup.name}
               onChange={e => setSignup({ ...signup, name: e.target.value })} />
        <label>Email</label>
        <input type="email" required value={signup.email}
               onChange={e => setSignup({ ...signup, email: e.target.value })} />
        <label>Password</label>
        <input type="password" required value={signup.password}
               onChange={e => setSignup({ ...signup, password: e.target.value })} />
        <div className="actions">
          <button className="ghost" disabled={busy !== null}>
            {busy === 'signup' ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  );
}
