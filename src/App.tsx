import React from 'react';
import logo from './logo.svg';
import './App.css';
import YAML from 'yaml'
import {script} from './samples'
import { MTGScript } from './models/classes';
import MTGSim from './models/sim';

//Load file content from script.yaml

const parsed = YAML.parse(script) as MTGScript;

let sim = new MTGSim(parsed);

const runSim  = () => {
  console.log('Running sim')
  sim.run(50)
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="#"
          onClick={runSim}
        >
          Run
        </a>
      </header>
    </div>
  );
}

export default App;
