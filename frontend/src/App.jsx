import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import Nav from './components/Nav';
import { Empty } from './components/bits';
import { RequireAuth } from './session';

import Activity from './pages/Activity';
import Auth from './pages/Auth';
import CreatePost from './pages/CreatePost';
import Discover from './pages/Discover';
import EditPost from './pages/EditPost';
import MyPosts from './pages/MyPosts';
import Onboarding from './pages/Onboarding';
import Post from './pages/Post';
import Profile from './pages/Profile';
import User from './pages/User';

/* The old site was ten HTML files, so every link anyone has shared points at
   one of them. These keep working: Flask hands any unknown path to this app,
   and the app forwards the .html URLs to their replacements. */
function LegacyRedirect({ to }) {
  const [params] = useSearchParams();
  const id = params.get('id');
  return <Navigate to={typeof to === 'function' ? to(id) : to} replace />;
}

/* Browsers restore scroll position on a client-side navigation, which on a
   long browse page drops you into the middle of the next one. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

const guarded = element => <RequireAuth>{element}</RequireAuth>;

export default function App() {
  return (
    <>
      <Nav />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Discover />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/posts/:id" element={<Post />} />
        <Route path="/users/:id" element={<User />} />

        <Route path="/onboarding" element={guarded(<Onboarding />)} />
        <Route path="/profile" element={guarded(<Profile />)} />
        <Route path="/create" element={guarded(<CreatePost />)} />
        <Route path="/my-posts" element={guarded(<MyPosts />)} />
        <Route path="/activity" element={guarded(<Activity />)} />
        <Route path="/posts/:id/edit" element={guarded(<EditPost />)} />

        <Route path="/index.html" element={<LegacyRedirect to="/" />} />
        <Route path="/auth.html" element={<LegacyRedirect to="/auth" />} />
        <Route path="/onboarding.html" element={<LegacyRedirect to="/onboarding" />} />
        <Route path="/profile.html" element={<LegacyRedirect to="/profile" />} />
        <Route path="/create.html" element={<LegacyRedirect to="/create" />} />
        <Route path="/my-posts.html" element={<LegacyRedirect to="/my-posts" />} />
        <Route path="/invites.html" element={<LegacyRedirect to="/activity" />} />
        <Route path="/post.html" element={<LegacyRedirect to={id => `/posts/${id}`} />} />
        <Route path="/user.html" element={<LegacyRedirect to={id => `/users/${id}`} />} />
        <Route path="/edit-post.html"
               element={<LegacyRedirect to={id => `/posts/${id}/edit`} />} />

        <Route path="*" element={
          <div className="wrap"><Empty>There is nothing at that address.</Empty></div>
        } />
      </Routes>
    </>
  );
}
