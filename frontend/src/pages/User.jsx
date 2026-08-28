import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../api';
import { initial } from '../format';
import { useSession } from '../session';
import { Empty, ExternalLinks, Tags } from '../components/bits';
import FoldText from '../components/FoldText';

/* A public profile. Contact details appear only once two people are on a
   team together, in both directions. */

const OUTCOME_LABEL = {
  prototype: 'prototype',
  completed: 'completed',
  shipped: 'shipped',
  award: 'placed in a competition',
};

const ProjectCard = ({ project: p }) => (
  <div className="card proj-card">
    <h3>{p.title}</h3>
    <div className="proj-meta">
      {p.outcome && (
        <span className="pill outcome">{OUTCOME_LABEL[p.outcome] || p.outcome}</span>
      )}
      {p.duration && <span className="pill">{p.duration}</span>}
      {p.link && (
        <a className="pill" href={p.link} target="_blank" rel="noopener">see it</a>
      )}
    </div>
    <Tags must={p.skills || []} plain={p.domains || []} />
  </div>
);

export default function User() {
  const { id } = useParams();
  const { me } = useSession();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setUser(null);
    setError(null);
    get(`/api/users/${id}`)
      .then(setUser)
      .catch(() => setError('That profile could not be loaded.'));
  }, [id]);

  if (error) return <div className="wrap narrow"><Empty>{error}</Empty></div>;
  if (!user) return <div className="wrap narrow"><Empty>Loading…</Empty></div>;

  const isMe = me && me.id === user.id;
  const bits = [user.role, user.experience_level, user.location].filter(Boolean);
  const projects = user.past_projects || [];

  const availability = [
    user.open_to_join ? 'Open to joining a team' : 'Not currently looking',
    user.available_from && `free ${user.available_from} → ${user.available_to || ''}`,
    user.hours_per_week && `${user.hours_per_week} hrs/week`,
    user.remote_ok && 'remote ok',
    user.willing_to_travel && 'will travel',
  ].filter(Boolean);

  return (
    <div className="wrap narrow">
      <div className="profile-head">
        <span className="avatar lg" aria-hidden="true">{initial(user.name)}</span>
        <div className="grow">
          <h1 style={{ marginBottom: 2 }}><FoldText key={user.id} text={user.name} /></h1>
          <p className="sub" style={{ marginBottom: 6 }}>{bits.join(' · ')}</p>
          <div className="meta">
            <ExternalLinks github={user.github} linkedin={user.linkedin}
                           email={user.email} />
          </div>
        </div>
        {isMe && <Link className="btn ghost" to="/profile">Edit</Link>}
      </div>

      {user.bio && <div className="card"><p style={{ margin: 0 }}>{user.bio}</p></div>}

      <div className="card">
        <div className="meta">
          <strong>{availability[0]}</strong>
          {availability.length > 1 && ` · ${availability.slice(1).join(' · ')}`}
        </div>
      </div>

      <h2>Skills</h2>
      {(user.skills || []).length
        ? <Tags must={user.skills} />
        : <div className="tags"><span className="meta">None listed yet.</span></div>}

      <h2>Interested in</h2>
      {(user.interests || []).length
        ? <Tags plain={user.interests} />
        : <div className="tags"><span className="meta">None listed yet.</span></div>}

      <h2>Past projects</h2>
      {projects.length
        ? projects.map((p, i) => <ProjectCard key={i} project={p} />)
        : <Empty>No projects listed yet.</Empty>}
    </div>
  );
}
