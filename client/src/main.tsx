import ReactDOM from 'react-dom/client';
import { VocalBridgeProvider } from '@vocalbridgeai/react';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <VocalBridgeProvider options={{ auth: { tokenUrl: '/api/voice-token' }, participantName: 'JourneyOS traveler', debug: true }}>
    <App />
  </VocalBridgeProvider>,
);
