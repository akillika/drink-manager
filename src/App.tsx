import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import AddEntry from './pages/AddEntry';
import History from './pages/History';
import Sessions from './pages/Sessions';
import DrinkLibrary from './pages/DrinkLibrary';
import Goals from './pages/Goals';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/add" element={<AddEntry />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/sessions" element={<Sessions />} />
                    <Route path="/library" element={<DrinkLibrary />} />
                    <Route path="/goals" element={<Goals />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

