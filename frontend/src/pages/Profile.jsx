import { useEffect, useState } from 'react';
import { getVocab, post } from '../api';
import { useSession } from '../session';
import ProfileForm from '../components/ProfileForm';
import { Notice } from '../components/bits';
import FoldText from '../components/FoldText';

/* Editing what the engine scores. */
export default function Profile() {
  const { me, refresh } = useSession();
  const [vocab, setVocab] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { getVocab().then(setVocab); }, []);

  async function save(profile) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await post('/api/profile', profile);
      await refresh();
      setSaved(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!vocab) return null;

  return (
    <div className="wrap narrow">
      <h1><FoldText text="Your profile" /></h1>
      <p className="sub">This is what the matching engine scores. The more honest the
        availability and skills, the better your matches.</p>
      {saved && <Notice tone="good">Profile saved.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
      <ProfileForm initial={me} vocab={vocab} submitting={saving} onSubmit={save} />
    </div>
  );
}
