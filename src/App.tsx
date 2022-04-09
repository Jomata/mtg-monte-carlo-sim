import React, { useEffect, useState } from 'react';
import './App.css';
import YAML from 'yaml'
import {script} from './samples'
import { MTGCard, MTGScript } from './models/classes';
import MTGSim, { ARENA_EXPORT_REGEX, storeCardData } from './models/sim';
import * as Scry from "scryfall-sdk";
import { CardIdentifier } from 'scryfall-sdk';
import { useLocalStorage } from '@rehooks/local-storage';
import {useAsync} from './useAsync'

//Load file content from script.yaml

function App() {

  const [inputScript, setInputScript] = useLocalStorage<string>('MTGSIM_inputScript', script)
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

  const validateDeck = async () => {
    const regex = ARENA_EXPORT_REGEX
    let deck = (YAML.parse(inputScript) as MTGScript | undefined)?.deck.trim()
    if(deck) {
      let collection = deck.split("\r").flatMap(line => line.split("\n")).flatMap(line => {
        if(line === "Deck") return;

        let match = regex.exec(line);
        if(match) {
          //let count = parseInt(match[1]);
          //let cardName = match[2];
          //let setName = match[3];
          //let setNumber = match[4];
          let [, , cardName, setName, setNumber] = match
          return Scry.CardIdentifier.bySet(setName, setNumber)
          //return Scry.CardIdentifier.byName(cardName).
        } else {
          return line;
        }
      })

      let misreads = collection.filter((c):c is string => typeof c === "string")
      if(misreads.length > 0) {
        setValidDeck(false)
        setLog("Invalid cards found:\n" + misreads.join("\n"))
      } else {
        const cardIds = collection.filter((c):c is CardIdentifier => c as CardIdentifier !== undefined)
        try {
          const cards = await Scry.Cards.collection(...cardIds).waitForAll();
          for (const card of cards) {
            //console.log(card.name);
            let myCard = {
              name: card.name,
              types: card.type_line.split("—").flatMap(t => t.split(" ")).map(t => t.trim()).filter(t => t !== ""),
              isPermanent: ["Creature", "Planeswalker", "Artifact", "Enchantment", "Land"].some(t => card.type_line.includes(t)),
              isLand: card.type_line.includes("Land"),
            } as MTGCard
            
            storeCardData(card.set, card.collector_number, myCard)
          }

          setValidDeck(true)
          setLog("Card checking done")
          //console.log(cards)
        } catch (e) {
          setValidDeck(false)
          setLog("Invalid cards found:\n" + e)
        }
      }
    }
    else{
      setValidDeck(false)
      setLog("No deck in script to validate")
    }
  }
  const asyncValidateDeck = useAsync(validateDeck, false)
  useEffect(() => {
    if(asyncValidateDeck.status === "error") {
      setValidDeck(false)
      setLog("Error validating deck:\n" + asyncValidateDeck.error)
    }
  }, [asyncValidateDeck.status])

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
            <li><button onClick={asyncValidateDeck.execute} disabled={!validScript || asyncValidateDeck.status === "pending"}>2. Validate Deck</button></li>
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
