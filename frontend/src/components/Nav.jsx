import { Link, useNavigate } from 'react-router-dom';
import { post } from '../api';
import { useSession } from '../session';

/* Three signals, each doing one job: outlined cyan for navigation, a solid
   pill for your own name, quiet grey for log out. The badges are counts of
   things waiting on you — decisions on your posts, and invites or outcomes
   addressed to you. */
export default function Nav() {
  const { me, notifications, pendingApplications, refresh } = useSession();
  const navigate = useNavigate();

  async function logOut() {
    await post('/api/logout');
    await refresh();
    navigate('/');
  }

  return (
    <nav>
      <Link className="brand" to="/">ProjectMatch</Link>
      {me ? (
        <>
          <Link className="navbtn nav-discover" to="/">Discover</Link>
          <Link className="navbtn nav-teams" to="/my-posts">
            My teams{pendingApplications > 0 && <> <span className="badge">{pendingApplications}</span></>}
          </Link>
          <Link className="navbtn nav-post" to="/create">Post a role</Link>
          <Link className="navbtn nav-activity" to="/activity">
            Activity{notifications > 0 && <> <span className="badge">{notifications}</span></>}
          </Link>
          <span className="spacer" />
          <Link className="navbtn nav-quiet" to="/profile">{me.name || 'Profile'}</Link>
          <button type="button" className="logout" onClick={logOut}>Log out</button>
        </>
      ) : (
        <>
          <Link className="navbtn nav-discover" to="/">Discover</Link>
          <span className="spacer" />
          <Link className="navbtn nav-quiet" to="/auth">Sign in</Link>
        </>
      )}
    </nav>
  );
}
