import React from 'react';
import ReactDOM from 'react-dom/client';
import BillPage from './BillPage';
import GuidePage from './GuidePage';
import './styles.css';

const isGuidePage = new URLSearchParams(window.location.search).get('page') === 'guide';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isGuidePage ? <GuidePage /> : <BillPage />}
  </React.StrictMode>,
);
