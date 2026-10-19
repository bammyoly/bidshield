import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';
import { TendersPage } from './pages/TendersPage';
import { TenderDetail } from './pages/TenderDetail';
import { ProtocolPage } from './pages/ProtocolPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { MyBidsPage } from './pages/MyBidsPage'
// import { TenderPage } from './pages/TenderPage';
// import { CommitPage } from './pages/CommitPage';
// import { RevealPage } from './pages/RevealPage';
// import { AwardPage } from './pages/AwardPage';


export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/protocol" element={<ProtocolPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/my-bids" element={<MyBidsPage />} />
            <Route path="/tenders" element={<TendersPage />} />
            <Route path="/tender/:id" element={<TenderDetail />} />
            {/* <Route path="/tender" element={<TenderPage />} />
            <Route path="/tender/:id" element={<TenderPage />} />
            <Route path="/commit" element={<CommitPage />} />
            <Route path="/reveal" element={<RevealPage />} />
            <Route path="/award" element={<AwardPage />} /> */}

          </Route>
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  );
}