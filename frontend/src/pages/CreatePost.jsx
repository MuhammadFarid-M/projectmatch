import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVocab, post } from '../api';
import PostForm from '../components/PostForm';
import { Notice } from '../components/bits';
import FoldText from '../components/FoldText';

export default function CreatePost() {
  const navigate = useNavigate();
  const [vocab, setVocab] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { getVocab().then(setVocab); }, []);

  async function create(body) {
    setSaving(true);
    setError(null);
    try {
      const { post_id } = await post('/api/posts', body);
      navigate(`/posts/${post_id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!vocab) return null;

  return (
    <div className="wrap narrow">
      <h1><FoldText text="Post a requirement" /></h1>
      <p className="sub">Add one role block per person you need. Must-haves are
        weighted double when candidates are scored.</p>
      {error && <Notice tone="bad">{error}</Notice>}
      <PostForm vocab={vocab} submitting={saving} onSubmit={create} />
    </div>
  );
}
