import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './index.css'
import './styles/editor.css'
import './styles/chrome.css'
import './styles/dialogs.css'
import './styles/review.css'
import './styles/motion.css'
import App from './App.jsx'
import { revealMainWindow, installExternalLinkHandler } from './utils/desktop'
import { installRipple } from './utils/motion'

revealMainWindow()
installExternalLinkHandler()
installRipple()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
