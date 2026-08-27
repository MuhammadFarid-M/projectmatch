import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, getVocab, post } from '../api';
import PostForm from '../components/PostForm';
import { Notice } from '../components/bits';

export default function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vocab, setVocab] = useState(null);
  const [target, setTarget] = useState(null);
  const [denied, setDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { getVocab().then(setVocab); }, []);

  useEffect(() => {
    get(`/api/posts/${id}`)
      .then(p => (p.is_owner ? setTarget(p) : setDenied(true)))
      .catch(() => setDenied(true));
  }, [id]);

  async function save(body) {
    setSaving(true);
    setError(null);
    try {
      await post(`/api/posts/${id}/edit`, body);
      navigate(`/posts/${id}`, { state: { updated: true } });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="wrap narrow">
      <h1>Edit post</h1>
      <p className="sub">Changing the requirements rescores anyone still waiting on a
        decision, so the numbers stay honest.</p>
      {denied && <Notice tone="bad">You can only edit your own posts.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
      {vocab && target && (
        <PostForm post={target} vocab={vocab} submitting={saving} onSubmit={save} />
      )}
    </div>
  );
}
