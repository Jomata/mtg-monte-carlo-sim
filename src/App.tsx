import React, { useEffect, useState } from 'react';
import './App.css';
import "./SampleSplitter.css";
import YAML from 'yaml'
import {script} from './samples'
import { MTGCard, MTGScript } from './models/classes';
import MTGSim, { ARENA_EXPORT_REGEX, loadCardData, storeCardData } from './models/sim';
import * as Scry from "scryfall-sdk";
import { CardIdentifier } from 'scryfall-sdk';
import { useLocalStorage } from '@rehooks/local-storage';
import {useAsync} from './useAsync'
import { countUniqueElements } from './util';
import Resizable from 'react-resizable-layout';
import SampleSplitter from './SampleSplitter';
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-yaml";
import "ace-builds/src-noconflict/theme-kuroir";

function App() {

  const [sidebarWidth, setSidebarWidth]= useLocalStorage<number>('MTGSIM_sidebarWidth', 500)
  const [inputScript, setInputScript] = useLocalStorage<string>('MTGSIM_inputScript', script)
  const [validScript, setValidScript] = useState(false)
  const [validDeck, setValidDeck] = useState(false)
  const [runningSim, setRunningSim] = useState(false)
  const [simCount, setSimCount] = useLocalStorage<number>('MTGSIM_simCount', 100)
  const [log, setLog] = useState("")

  useEffect(() => {
    setValidScript(false)
    setValidDeck(false)
  }, [inputScript])

  const validateScript = () => {
    try {
      let parsedScript = YAML.parse(inputScript) as MTGScript | undefined;

      if(parsedScript?.deck !== undefined && parsedScript?.on !== undefined) {
        setValidScript(true)
        setLog("Script OK!")
      } else {
        setValidScript(false)
        setLog("Script is not valid")
      }
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
        if(line === "Deck") return [];

        let match = regex.exec(line);
        if(match) {
          let [, , cardName, setName, setNumber] = match
          //If we already have the card data stored, we don't do anything
          if(loadCardData(setName, setNumber) !== undefined) return [];
          return Scry.CardIdentifier.bySet(setName, setNumber)
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
        if(cardIds.length > 0) {
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
        } else {
          //No new cards to store, we have everything cached
          setValidDeck(true)
          setLog("Card checking done")
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
      setLog("Error validating deck")
    }
  }, [asyncValidateDeck.status])

  const runSim  = () => {
    setRunningSim(true)
    const parsed = YAML.parse(inputScript) as MTGScript;
    let sim = new MTGSim(parsed);
    console.log('Running sim')
    let results = sim.run(simCount)
    
    //Sorting results from highest to lowest    
    let resultsLog = results.sort((a, b) => b.turns.length - a.turns.length).flatMap(r => 
      [
        `${r.turns.length} ${r.name}: Turn avg ${Math.round(r.averageTurn*100)/100}, ${Math.round(r.turns.length*100/simCount)}%`,
        //Count all the turns
        ... Array.from(countUniqueElements(r.turns)).sort((a, b) => a[0] - b[0]).map(t => ` > Turn ${t[0]}: ${t[1]} (${Math.round(t[1]*100/r.turns.length)}%)`),
      ]
    )
    
    let actionsLog = sim.actionLog
    setRunningSim(false)
    setLog(resultsLog.concat(actionsLog).join("\n"))
  }

  const runTest = () => {
    setRunningSim(true)
    const parsed = YAML.parse(`
deck: |
  Deck
  30 Stitcher's Supplier (M19) 121
  30 Haunted Ridge (Mid) 263

on:
  etb:
  - card: Stitcher's Supplier
    do:
      - mill: 3
  mainOne:
  - name: Cast Supplier
    if:
      - hand: Stitcher's Supplier
      - lands: 1
      - turn: 2
    do:
      - tapLand: 1
      - cast: Stitcher's Supplier
  endStep:
  - name: End
    if:
      - turn: 5
    do:
      - tally: Meh
    `.trim()) as MTGScript;
    let sim = new MTGSim(parsed);
    console.log('Running sim')
    let runsCount = 100
    let results = sim.run(runsCount)
    let resultsLog = results.map(r => `${r.turns.length} ${r.name}: Turn avg ${Math.round(r.averageTurn*100)/100}, ${Math.round(r.turns.length*100/runsCount)}%`)
    let actionsLog = sim.actionLog
    setRunningSim(false)
    setLog(resultsLog.concat(actionsLog).join("\n"))
  }

  return (
    <div className="flex flex-column h-screen bg-dark font-mono color-white overflow-hidden">
      <div className="bg-darker contents" style={{height: `50px`}}>MTG Goldfish Monte Carlo Simulator</div>
      <SampleSplitter dir="horizontal" fixed={true} />

    <Resizable axis="x" initial={sidebarWidth} min={250} reverse={true}>
   {({ position: x, splitterProps }) => { 

     if(x !== sidebarWidth) {
       setTimeout(() => {
         setSidebarWidth(x)
       }, 1000)
     }
     
     return (
     <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
       <div
         id={'yaml-editor'}
         style={{
           width: `calc(100% - ${x}px)`
         }}
       >
         <AceEditor
          mode="yaml"
          theme="kuroir"
          height="100%"
          width="100%"
          value={inputScript}
          onChange={(val, e) => setInputScript(val)}
          editorProps={{ $blockScrolling: true }}
        />
      </div>
      <SampleSplitter id={'splitter'} {...splitterProps} />
      <div 
          id={'right-block'} 
          style={{
            width:x
          }}
        >
        <div style={{height:"20px"}}>
          <button onClick={validateScript}>1. Validate Script</button>
          <button onClick={asyncValidateDeck.execute} disabled={!validScript || asyncValidateDeck.status === "pending"}>2. Validate Deck</button>
          <button onClick={runSim} disabled={!validScript || !validDeck || runningSim}>3. Run Sim</button>
          <input type="number" value={simCount} disabled={runningSim} style={{width:'50px'}} onChange={(e) => setSimCount(Number(e.target.value))} /> times
        </div>
        <div style={{height:`calc(100% - 20px)`}}>
          <textarea
            id="log"
            style={{width:"100%",height:"100%"}}
            readOnly={true}
            value={log}
          />
        </div>
      </div>
    </div>
    )}}
  </Resizable>
  <SampleSplitter dir="horizontal" fixed={true} />
  <div className="bg-darker contents" style={{height: `50px`}}>Credits: scryfall, react-resizable-layout, scryfall-sdk, eemeli.org/yaml, react-ace</div>
  </div>
  )
}

export default App;
