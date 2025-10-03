import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Pehsai from './pages/Pehsai';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import CustomWheel from './pages/CustomWheel';
import Navbar from './pages/Navbar';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/pehsai" element={<Pehsai />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/:routeName" element={<CustomWheel />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
