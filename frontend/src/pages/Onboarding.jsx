import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVocab, post } from '../api';
import { useSession } from '../session';
import ProfileForm from '../components/ProfileForm';
import { Notice } from '../components/bits';
import FoldText from '../components/FoldText';

/* First run. Same fields as the profile page, arranged to explain what each
   one buys you — an empty profile matches nothing, and the reason why is
   worth saying once rather than leaving people to discover it. */
export default function Onboarding() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const [vocab, setVocab] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { getVocab().then(setVocab); }, []);

  async function save(profile) {
    setSaving(true);
    setError(null);
    try {
      await post('/api/profile', profile);
      await refresh();
      navigate('/', { state: { welcome: true } });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!vocab) return null;

  return (
    <div className="wrap narrow">
      <h1><FoldText text="Set up your profile" /></h1>
      <p className="sub">Everything here feeds the matching engine. Skip a section and
        you simply stop appearing in the lists that section would have placed you in.</p>
      {error && <Notice tone="bad">{error}</Notice>}
      <ProfileForm guided initial={me} vocab={vocab}
                   submitting={saving} onSubmit={save} />
    </div>
  );
}
