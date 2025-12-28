import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Note: StrictMode disabled to prevent duplicate SSE connections in development
// In production, StrictMode doesn't cause double rendering
// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist in index.html
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
