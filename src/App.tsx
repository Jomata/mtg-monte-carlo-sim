import React, { useEffect, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import YAML from 'yaml'
import {script} from './samples'
import { MTGScript } from './models/classes';
import MTGSim from './models/sim';

//Load file content from script.yaml

function App() {

  const [inputScript, setInputScript] = useState(script)
  const [validScript, setValidScript] = useState(false)
  const [validDeck, setValidDeck] = useState(false)
  const [runningSim, setRunningSim] = useState(false)
  const [log, setLog] = useState("")

  useEffect(() => {
    setValidScript(false)
    setValidDeck(false)
  }, [inputScript])

  const validateScript = () => {
    try {
      let parsedScript = YAML.parse(inputScript) as MTGScript | undefined;

      setValidScript(parsedScript?.deck !== undefined && parsedScript?.on !== undefined)
      setLog("Script OK!")
    } catch (e) {
      setValidScript(false)
      setLog("Invalid script")
    }
  }

  const validateDeck = () => {
    setValidDeck(true)
  }

  const runSim  = () => {
    setRunningSim(true)
    const parsed = YAML.parse(script) as MTGScript;
    let sim = new MTGSim(parsed);
    console.log('Running sim')
    let runsCount = 100
    let results = sim.run(runsCount)
    setRunningSim(false)
    setLog(results.map(r => `${r.turns.length} ${r.name}: Turn avg ${Math.round(r.averageTurn*100)/100}, ${Math.round(r.turns.length*100/runsCount)}%`).join("\n"))
  }

  return (
    //Two large columns
    //Left one with a full size text area to enter the script
    //Right one has 3 buttons (Validate Script, Load Cards, Run Sim) and an output textarea
    <>
    <div id="header">
        <h1>Header</h1>
    </div>
    <div id="wrapper">
        <div id="content">
            <textarea 
              id="script" 
              style={{width:"98%",minHeight:"598px"}} 
              value={inputScript} 
              onChange={(e) => setInputScript(e.target.value)}
            />
        </div>
    </div>
    <div id="navigation">
        <ol>
            <li><button onClick={validateScript}>1. Validate Script</button></li>
            <li><button onClick={validateDeck} disabled={!validScript}>2. Fetch Cards</button></li>
            <li><button onClick={runSim} disabled={!validScript || !validDeck || runningSim}>3. Run Sim</button></li>
        </ol>
    </div>
    <div id="extra">
        <h3>Log</h3>
        <textarea
          id="log"
          style={{width:"98%",minHeight:"474px"}}
          readOnly={true}
          value={log}
        />
    </div>
    <div id="footer"><p>Footer</p>
    </div>
    </>
  );
}

export default App;
