import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { get, getVocab, qs } from '../api';
import { plural } from '../format';
import { useSession } from '../session';
import HeroBackdrop from '../components/HeroBackdrop';
import PostCard from '../components/PostCard';
import { Empty, Notice } from '../components/bits';

/* The home page, and the argument the product makes in one screen: what the
   engine picked out for you, then everything else so you can see it was a
   choice and not the whole list. */

const EMPTY_FILTERS = { role: '', event_type: '', domain: '', starts_after: '' };

export default function Discover() {
  const { me, profileComplete, loading } = useSession();
  const { state } = useLocation();

  const [vocab, setVocab] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [feed, setFeed] = useState([]);
  const [browse, setBrowse] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => { getVocab().then(setVocab); }, []);

  // The feed is per-user, so it waits for /api/me to say who that is.
  useEffect(() => {
    if (loading) return;
    if (!me) { setFeed([]); return; }
    get('/api/feed').then(setFeed).catch(() => setFeed([]));
  }, [me, loading]);

  useEffect(() => {
    let live = true;
    get(`/api/posts${qs(filters)}`).then(posts => {
      if (!live) return;
      setBrowse(posts);
      // Unfiltered, this is also the headline count of what is going on.
      if (!Object.values(filters).some(Boolean)) {
        setStats({
          teams: posts.length,
          roles: posts.reduce(
            (n, p) => n + (p.slots || []).filter(s => !s.filled_by).length, 0),
        });
      }
    }).catch(() => live && setBrowse([]));
    return () => { live = false; };
  }, [filters]);

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  return (
    <div className="wrap">
      {state?.welcome && <Notice tone="good">Profile saved — here is what you match.</Notice>}
      {me && !profileComplete && !state?.welcome && (
        <Notice>
          Your profile is incomplete, so teams can't match you yet.{' '}
          <Link to="/onboarding">Finish setting it up</Link>.
        </Notice>
      )}

      <header className="hero">
        <HeroBackdrop />
        <div className="hero-inner">
          <h1>Find the people your team is <em>missing</em>.</h1>
          <p>Most teams get built out of whoever you already know. Post what the
            team still needs and everyone here gets ranked by how much of that gap
            they close — the skills, the free dates, the projects they have
            actually shipped.</p>
          {stats && (
            <div className="hero-stats">
              <span><b>{stats.teams}</b> {stats.teams === 1 ? 'team' : 'teams'} building right now</span>
              <span><b>{stats.roles}</b> {stats.roles === 1 ? 'role' : 'roles'} still open</span>
            </div>
          )}
          <div className="hero-cta">
            {!me && !loading && <Link className="btn" to="/auth">Create an account</Link>}
          </div>
        </div>
      </header>

      {feed.length > 0 && (
        <>
          <h2>Matched to you</h2>
          {feed.slice(0, 5).map(p => <PostCard key={p.post_id} post={p} />)}
        </>
      )}

      <h2>Browse everything</h2>
      <div className="filters">
        <div>
          <label htmlFor="f-role">Role needed</label>
          <select id="f-role" value={filters.role}
                  onChange={e => setFilter('role', e.target.value)}>
            <option value="">Any role</option>
            {vocab?.roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-event">Event type</label>
          <select id="f-event" value={filters.event_type}
                  onChange={e => setFilter('event_type', e.target.value)}>
            <option value="">Any type</option>
            {vocab?.event_types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-domain">Domain</label>
          <select id="f-domain" value={filters.domain}
                  onChange={e => setFilter('domain', e.target.value)}>
            <option value="">Any domain</option>
            {vocab?.domains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-date">Starts after</label>
          <input id="f-date" type="date" value={filters.starts_after}
                 onChange={e => setFilter('starts_after', e.target.value)} />
        </div>
      </div>

      {browse === null ? null
        : browse.length
          ? browse.map(p => <PostCard key={p.id} post={p} />)
          : <Empty>No open posts match those filters.</Empty>}
    </div>
  );
}
