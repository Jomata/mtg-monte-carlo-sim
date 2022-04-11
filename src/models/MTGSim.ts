import { Action, CardAction, Condition, MTGCard, MTGScript, PhaseAction, SimTally } from "./types";
import { MTGGame } from "./MTGGame";
import { ARENA_EXPORT_REGEX, loadCardData, MAX_TURNS } from "./utils";

export class MTGSim {
    script: MTGScript;
    game: MTGGame;
    results: SimTally[] = [];
    private gameStopFlag: boolean = false;
    actionLog: string[] = [];

    constructor(script: MTGScript) {
        this.script = script;
        let deck: MTGCard[] = this.parseDeck(script.deck);
        //console.log('Deck',deck);
        this.game = new MTGGame(deck);
    }

    public run(times: number): SimTally[] {
        this.results = [];
        this.actionLog = [];
        for (let i = 0; i < times; i++) {
            this.simulate();
        }
        //console.log('Results',this.results)
        return this.results;
    }

    private parseDeck(deck: string): MTGCard[] {
        const regex = ARENA_EXPORT_REGEX;

        return deck.split("\r").flatMap(line => line.split("\n")).flatMap(line => {
            let match = regex.exec(line);
            if (match) {
                let [, count, cardName, setName, setNumber] = match;
                return Array(parseInt(count)).fill(true).map(() => { return loadCardData(setName, setNumber); });
            } else
                return [];
        });
    }

    private logAction(...args: any[]) {
        this.actionLog.push(args.join(' '));
    }

    private simulate() {
        //We are only executing one action per phase for some reason
        //We need to re-check the actions until we don't run any action
        this.game.onMainOne = this.runPhaseActions.bind(this, this.script.on?.mainOne);
        this.game.onCombat = this.runPhaseActions.bind(this, this.script.on?.combat);
        this.game.onMainTwo = this.runPhaseActions.bind(this, this.script.on?.mainTwo);
        this.game.onEndStep = this.runPhaseActions.bind(this, this.script.on?.endStep);

        this.game.onCast = this.runCardActions.bind(this, this.script.on?.cast || []);
        this.game.onETB = this.runCardActions.bind(this, this.script.on?.etb || []);
        this.game.onMulligan = this.mulliganLogic.bind(this);

        this.game.logger = this.logAction.bind(this);

        //We run the script while we are under the max turn limit
        this.gameStopFlag = false;
        this.game.start();
        while (this.game.turn < MAX_TURNS && !this.gameStopFlag) {
            this.game.playTurn();
        }
    }

    private mulliganLogic(cards: MTGCard[], mulliganCount: number): [MTGCard[] | undefined, MTGCard[]] {
        if (this.script.mulligan) {
            //console.log("Checking for mulligan", cards.map(c => c.name))
            let result = this.checkConditions(this.script.mulligan.until);
            if (result) {
                let bottom: MTGCard[] = [];
                while (bottom.length < mulliganCount) {
                    //Find a card that matches bottom, or a random one if no match
                    let card = MTGGame.findCard(this.script.mulligan.bottom, cards) || cards[0];
                    //Remove from cards
                    cards = cards.filter(c => c !== card);
                    //Insert it into the bottom array
                    bottom.push(card);
                }
                return [cards, bottom];
            } else {
                return [undefined, cards];
            }
        }
        else {
            return [cards, []];
        }
    }

    private runPhaseActions(actions?: PhaseAction[], recursionFailsafe: number = 0) {
        let actionsTaken = (actions || []).map(phaseAction => {
            //console.debug("--- Evaluating Phase Action ---", phase.name)
            if (phaseAction.if) {
                //console.debug(" > Conditions:", phase.if)
                if (this.checkConditions(phaseAction.if)) {
                    //console.debug(" > Conditions met, running actions")
                    return this.doActions(phaseAction.do);
                } else if (phaseAction.else) {
                    //console.debug(" > Conditions not met, running else actions")
                    return this.doActions(phaseAction.else);
                } else {
                    //console.debug(" > Conditions not met, no else actions")
                    return false;
                }
            } else {
                //console.debug(" > No conditions, running actions")
                return this.doActions(phaseAction.do);
            }
        });

        if (recursionFailsafe >= 10 + this.game.turn) {
            console.error("Recursion Failsafe triggered");
        }

        if (!this.gameStopFlag && recursionFailsafe < 10 + this.game.turn && actionsTaken.some(a => a === true)) {
            this.runPhaseActions(actions, recursionFailsafe++);
        }
    }

    private runCardActions(actions: CardAction[], card: MTGCard) {
        actions?.filter(a => MTGGame.isMatch(a.card, card)).forEach(action => {
            if (action.if) {
                if (this.checkConditions(action.if)) {
                    this.doActions(action.do);
                } else if (action.else) {
                    this.doActions(action.else);
                } else {
                    //console.debug(" > Conditions not met, no else actions")
                }
            } else {
                this.doActions(action.do);
            }
        });
    }

    private doActions(actions: Action[]): boolean {
        return actions.map(this.doAction.bind(this)).some(a => a === true);
    }

    private doAction(action: Action): boolean {
        let anyAction = false;
        if (this.gameStopFlag)
            return false;


        if (action.mill) {
            this.game.mill(action.mill);
            anyAction = true;
        }
        if (action.draw) {
            this.game.draw(action.draw);
            anyAction = true;
        }
        if (action.tutor) {
            this.game.tutorCard(action.tutor);
            anyAction = true;
        }
        if (action.exile) {
            this.game.exileFromYard(action.exile);
            anyAction = true;
        }
        if (action.discard) {
            this.game.discard(action.discard);
            anyAction = true;
        }
        if (action.reanimate) {
            this.game.reanimate(action.reanimate);
            anyAction = true;
        }
        if (action.tapLand) {
            this.game.tapLand(action.tapLand);
            anyAction = true;
        }
        if (action.cast) {
            this.game.cast(action.cast);
            anyAction = true;
        }
        if (action.flashback) {
            this.game.flashback(action.flashback);
            anyAction = true;
        }

        if (action.tally) {
            //Talies are not considered game actions
            //If we have a tally, we need to add the turn to the tally
            //If we don't, we push a new tally with the current turn
            this.results.find(r => r.name === action.tally)?.turns.push(this.game.turn) || this.results.push(new SimTally(action.tally, this.game.turn));
        }
        //End tallies up AND ends the simulation
        if (action.end) {
            //Ending the game is also not considered a game action
            //If we have a tally, we need to add the turn to the tally
            //If we don't, we push a new tally with the current turn
            this.results.find(r => r.name === action.end)?.turns.push(this.game.turn) || this.results.push(new SimTally(action.end, this.game.turn));
            this.gameStopFlag = true;
            this.game.end();
            this.logAction("ITERATION END: ", action.end?.toUpperCase());
        }
        return anyAction;
    }

    private checkConditions(conditions: Condition[]): boolean {
        //return conditions.every(this.checkCondition.bind(this))
        let results = conditions.map(this.checkCondition.bind(this));
        return results.every(result => result === true);
    }

    private checkCondition(condition: Condition): boolean {
        if (condition.exactly !== undefined) {
            if (condition.battlefield)
                return MTGGame.findManyCards(condition.battlefield, this.game.battlefield).length === condition.exactly;
            if (condition.graveyard)
                return MTGGame.findManyCards(condition.graveyard, this.game.graveyard).length === condition.exactly;
            if (condition.hand)
                return MTGGame.findManyCards(condition.hand, this.game.hand).length === condition.exactly;
            if (condition.exile)
                return MTGGame.findManyCards(condition.exile, this.game.exile).length === condition.exactly;
            if (condition.untapped)
                return MTGGame.findManyCards(condition.untapped, this.game.battlefield).filter(card => !card.tapped).length === condition.exactly;
        } else if (condition.count !== undefined) {
            if (condition.battlefield)
                return MTGGame.findManyCards(condition.battlefield, this.game.battlefield).length >= condition.count;
            if (condition.graveyard)
                return MTGGame.findManyCards(condition.graveyard, this.game.graveyard).length >= condition.count;
            if (condition.hand)
                return MTGGame.findManyCards(condition.hand, this.game.hand).length >= condition.count;
            if (condition.exile)
                return MTGGame.findManyCards(condition.exile, this.game.exile).length >= condition.count;
            if (condition.untapped)
                return MTGGame.findManyCards(condition.untapped, this.game.battlefield).filter(card => !card.tapped).length >= condition.count;
        } else {
            if (condition.battlefield)
                return MTGGame.findCard(condition.battlefield, this.game.battlefield) !== undefined;
            if (condition.graveyard)
                return MTGGame.findCard(condition.graveyard, this.game.graveyard) !== undefined;
            if (condition.hand)
                return MTGGame.findCard(condition.hand, this.game.hand) !== undefined;
            if (condition.exile)
                return MTGGame.findCard(condition.exile, this.game.exile) !== undefined;
            if (condition.untapped)
                return MTGGame.findManyCards(condition.untapped, this.game.battlefield).some(card => !card.tapped);
            if (condition.lands)
                return this.game.lands.filter(c => !c.tapped).length >= condition.lands;
            if (condition.turn)
                return this.game.turn === condition.turn;
        }
        return false;
    }
}
