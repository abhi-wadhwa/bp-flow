import { useState } from 'react';
import LandingScreen from './LandingScreen';
import FlowWorkspace from './FlowWorkspace';
import { FULL_ROUND_SPEAKERS, TOP_HALF_SPEAKERS } from './constants';

function App() {
  const [config, setConfig] = useState(null);

  const handleStart = (setupData) => {
    const speakers = setupData.roundType === 'full'
      ? FULL_ROUND_SPEAKERS
      : TOP_HALF_SPEAKERS;

    setConfig({
      ...setupData,
      speakers,
    });
  };

  if (!config) {
    return <LandingScreen onStart={handleStart} />;
  }

  return <FlowWorkspace config={config} />;
}

export default App;
