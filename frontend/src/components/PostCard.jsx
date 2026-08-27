import { Link } from 'react-router-dom';
import { initial, postMeta } from '../format';
import { Score, Tags } from './bits';

/* The candidate's side of the same idea: a team, and how much of its gap
   you close. Takes rows from either /api/feed (post_id, score, reason) or
   /api/posts (id, my_score, my_reason), because they are the same card. */

export function PosterLine({ owner }) {
  if (!owner) return null;
  const bits = [owner.role, owner.experience_level, owner.location].filter(Boolean);
  return (
    <div className="poster">
      <span className="avatar" aria-hidden="true">{initial(owner.name)}</span>
      <div className="grow">
        <Link to={`/users/${owner.id}`}>{owner.name}</Link>
        {bits.length > 0 && <div className="meta">{bits.join(' · ')}</div>}
      </div>
    </div>
  );
}

export default function PostCard({ post: p }) {
  const score = p.my_score ?? p.score;
  const reason = p.my_reason ?? p.reason;
  const id = p.post_id ?? p.id;

  // The feed names the one role you fit best; browse lists everything open.
  const roles = p.role ? [p.role] : (p.slots || []).filter(s => !s.filled_by).map(s => s.role);

  return (
    <div className="card">
      <div className="card-head">
        <div className="grow">
          <h3><Link to={`/posts/${id}`}>{p.title}</Link></h3>
          <div className="meta">{postMeta(p)}</div>
          {reason && <p className="reason">{reason}</p>}
          <Tags must={roles} plain={p.domains || []} />
        </div>
        <Score value={score} />
      </div>
      <PosterLine owner={p.owner} />
    </div>
  );
}
