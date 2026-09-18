import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Retire only the obsolete local photo queue; account/session data is untouched.
try { indexedDB.deleteDatabase('atypibrick-room-captures') } catch { /* Storage may be disabled. */ }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
