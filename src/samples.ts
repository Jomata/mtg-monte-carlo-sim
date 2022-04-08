export const script = `deck: |
  Deck
  4 Haunted Ridge (MID) 263
  4 Greasefang, Okiba Boss (NEO) 220
  1 Hive of the Eye Tyrant (AFR) 258
  4 Goblin Engineer (MH1) 128
  3 Can't Stay Away (MID) 213
  4 Faithless Looting (STA) 38
  4 Parhelion II (WAR) 24
  2 Wishclaw Talisman (ELD) 110
  2 Savai Triome (IKO) 253
  4 Blightstep Pathway (KHM) 252
  2 Godless Shrine (RNA) 248
  4 Brightclimb Pathway (ZNR) 259
  4 Blood Crypt (RNA) 245
  2 Sacred Foundry (GRN) 254
  4 Bone Shards (MH2) 76
  4 Stitcher's Supplier (M19) 121
  4 Undead Butler (VOW) 133
  3 Revival // Revenge (RNA) 228
  1 Skysovereign, Consul Flagship (KLR) 272

mulligan:
  until:
    - hand: land
      count: 2
  bottom: Bone Shards > Undead Butler > Wishclaw Talisman > Skysovereign, Consul Flagship > Stitcher's Supplier > any

on:
  etb:
    - card: Stitcher's Supplier
      do:
        - mill: 3
    - card: Undead Butler
      do:
        - mill: 3
    - card: Goblin Engineer
      do:
        - tutor: Parhelion II
        - discard: Parhelion II
  cast:
    - card: faithless looting #If we don't, we want to keep it
      if:
        - hand: revival // revenge > can't stay away
          exactly: 0
      do:
        - draw: 2
        - discard: Parhelion II > Skysovereign, Consul Flagship > Bone Shards > Undead Butler > land > any
        - discard: Parhelion II > Skysovereign, Consul Flagship > Bone Shards > Undead Butler > land > any
      else:
        - draw: 2
        - discard: Parhelion II > Skysovereign, Consul Flagship > Greasefang, Okiba Boss > Bone Shards > Undead Butler > land > any
        - discard: Greasefang, Okiba Boss > Parhelion II > Skysovereign, Consul Flagship > Bone Shards > Undead Butler > land > any
    - card: Can't stay away
      if:
        - graveyard: Greasefang, Okiba Boss
      do:
        - reanimate: Greasefang, Okiba Boss
    - card: Revival // Revenge
      if:
        - graveyard: Greasefang, Okiba Boss
      do:
        - reanimate: Greasefang, Okiba Boss
  
  mainOne:

  ## By priority
  ## Priority #1 is combing if we can
  - name: Cast Greasefang if parhelion in yard
    if:
      - hand: Greasefang, Okiba Boss
      - lands: 3
      - graveyard: Parhelion II
    do:
      - tapLand: 3
      - cast: Greasefang, Okiba Boss
  - name: Reanimate greasefang w/CSA if both fang and parhelion in yard
    if:
      - hand: Can't Stay Away
      - graveyard: Greasefang, Okiba Boss
      - graveyard: Parhelion II
      - lands: 2
    do:
      - tapLand: 2
      - cast: can't stay away
  - name: Reanimate greasefang w/RR if both fang and parhelion in yard
    if:
      - hand: Revival // Revenge
      - graveyard: Greasefang, Okiba Boss
      - graveyard: Parhelion II
      - lands: 2
    do:
      - tapLand: 2
      - cast: Revival // Revenge

  - name: Wish for a greasefang if none in hand
    if:
      - hand: wishclaw talisman
      - hand: Greasefang, Okiba Boss
        count: 0
      - lands: 3
    do:
      - tapLand: 2
      - cast: wishclaw talisman
  - name: Wish for a goblin engineer if no parhelions in yard and no engineers in hand
    if:
      - hand: wishclaw talisman
      - hand: goblin engineer
        count: 0
      - lands: 3
    do:
      - tapLand: 2
      - cast: wishclaw talisman
  - name: Activate wish talisman for greasefang
    if:
      - battlefield: wishclaw talisman
      - hand: Greasefang, Okiba Boss
        exactly: 0
      - untapped: wishclaw talisman
      - lands: 1
    do:
      - tapLand: 1
      - tap: wishclaw talisman
      - exile: wishclaw talisman
      - tutor: Greasefang, Okiba Boss
  - name: Activate wish talisman for goblin engineer
    if:
      - battlefield: wishclaw talisman
      - hand: goblin engineer
        exactly: 0
      - lands: 1
      - untapped: wishclaw talisman
    do:
      - tapLand: 1
      - tap: wishclaw talisman
      - exile: wishclaw talisman
      - tutor: goblin engineer
  - name: Flashback Faithless Looting
    if:
      - graveyard: faithless looting
      - lands: 3
    do:
      - tapLand: 3
      - flashback: faithless looting
  
  ## 2 mana plays
  - name: Cast goblin engineer if we don't have a parthelion in yard already
    if:
      - hand: goblin engineer
      - lands: 2
      - graveyard: Parhelion II
        exactly: 0
    do:
      - tapLand: 2
      - cast: goblin engineer
  
  - name: Self mill with undead butler
    if:
      - hand: undead butler
      - lands: 2
    do:
      - tapLand: 2
      - cast: undead butler
  
  ## 1 mana plays
  - name: If we have faithless looting and a parhelion, we loot it away
    if: 
      - hand: faithless looting
      - hand: Parhelion II
      - lands: 1
    do:
      - tapLand: 1
      - cast: faithless looting
  
  - name: Self mill with Stitcher
    if:
      - hand: Stitcher's Supplier
      - lands: 1
    do:
      - tapLand: 1
      - cast: Stitcher's Supplier
      
  - name: if no supplier, cast faithless anyway to dig through the deck
    if: 
      - hand: faithless looting
      - lands: 1
    do:
      - tapLand: 1
      - cast: faithless looting
  
  combat:
  - name: If greasefang on battlefield and parhelion in yard, we did the thing
    if:
      - battlefield: Greasefang, Okiba Boss
      - graveyard: Parhelion II
    do:
      - tally: Success
  
  endStep:
  - name: Give up if we failed by turn 5
    if:
      - turn: 10
    do:
      - tally: Failure
`