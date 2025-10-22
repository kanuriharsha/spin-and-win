import './App.css';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import CustomWheel from './pages/CustomWheel';
import Navbar from './pages/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Analytics from './pages/Analytics';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
        {/* Routes without Navbar */}
        <Route element={<NoNavLayout />}>
          {/* <Route path="/" element={<Landing />} /> */}
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Routes with Navbar */}
        <Route element={<MainLayout />}>
          {/* Protected area */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/editor/:id" element={<Editor />} />
            <Route path="/analytics" element={<Analytics />} />
          </Route>
          {/* Public dynamic wheel routes (no auth) */}
          <Route path=":routeName" element={<CustomWheel />} />
        </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

function MainLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

function NoNavLayout() {
  return <Outlet />;
}
//   return <Outlet />;
// }
