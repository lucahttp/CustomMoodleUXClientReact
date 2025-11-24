import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import Frame from 'react-frame-component'

const root = ReactDOM.createRoot(
  document.getElementById('root')
);

root.render(
  <React.StrictMode>
    {/*
    <Frame
      scrolling='yes'
      head={[
        <link
          key='0'
          type='text/css'
          rel='stylesheet'
          href={chrome.runtime.getURL('/react/index.css')}
        />,
      ]}
    >
      <App />
    </Frame>
    */}
    <App />
  </React.StrictMode>
)
