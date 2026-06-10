import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SEOHead from './components/SEOHead';
import Home from './pages/Home';
import Services from './pages/Services';
import Products from './pages/Products';
import About from './pages/About';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Team from './pages/Team';
import Careers from './pages/Careers';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import ProductDetail from './pages/ProductDetail';
import NotFound from './pages/NotFound';

function LangWrapper({ children }) {
  const { lang } = useParams();
  const { i18n } = useTranslation();
  useEffect(() => {
    if (lang && ['en', 'bg', 'es'].includes(lang) && i18n.language !== lang) i18n.changeLanguage(lang);
  }, [lang, i18n]);
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <SEOHead />
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/en" replace />} />
            <Route path="/:lang" element={<LangWrapper><Home /></LangWrapper>} />
            <Route path="/:lang/services" element={<LangWrapper><Services /></LangWrapper>} />
            <Route path="/:lang/products" element={<LangWrapper><Products /></LangWrapper>} />
            <Route path="/:lang/products/:slug" element={<LangWrapper><ProductDetail /></LangWrapper>} />
            <Route path="/:lang/about" element={<LangWrapper><About /></LangWrapper>} />
            <Route path="/:lang/blog" element={<LangWrapper><Blog /></LangWrapper>} />
            <Route path="/:lang/blog/:slug" element={<LangWrapper><BlogPost /></LangWrapper>} />
            <Route path="/:lang/team" element={<LangWrapper><Team /></LangWrapper>} />
            <Route path="/:lang/careers" element={<LangWrapper><Careers /></LangWrapper>} />
            <Route path="/:lang/contact" element={<LangWrapper><Contact /></LangWrapper>} />
            <Route path="/:lang/privacy" element={<LangWrapper><Privacy /></LangWrapper>} />
            <Route path="/:lang/terms" element={<LangWrapper><Terms /></LangWrapper>} />
            <Route path="/:lang/404" element={<LangWrapper><NotFound /></LangWrapper>} />
            <Route path="*" element={<LangWrapper><NotFound /></LangWrapper>} />
          </Routes>
        </main>
        <Footer />
      </div>
    </>
  );
}
