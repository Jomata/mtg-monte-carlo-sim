import { MTGCard } from "./types";

export class MTGGame {
    private _deck: MTGCard[];
    private _library: MTGCard[] = [];
    private _battlefield: MTGCard[] = [];
    private _graveyard: MTGCard[] = [];
    private _hand: MTGCard[] = [];
    private _exile: MTGCard[] = [];
    private _lands: MTGCard[] = [];
    private _turn: number = 0;
    private _endFlag = false;

    public get turn(): number { return this._turn; }
    public get battlefield(): readonly MTGCard[] { return this._battlefield; }
    public get graveyard(): readonly MTGCard[] { return this._graveyard; }
    public get exile(): readonly MTGCard[] { return this._exile; }
    public get lands(): readonly MTGCard[] { return this._lands; }
    public get library(): readonly MTGCard[] { return this._library; }
    public get hand(): readonly MTGCard[] { return this._hand; }

    public logger?: (...args: any[]) => void = console.log;

    constructor(deck: MTGCard[]) {
        this._deck = deck;
    }

    private log(...args: any[]) {
        if (this.logger)
            this.logger(`T${this.turn}`, ...args);
    }

    public start() {
        this._endFlag = false;
        this._turn = 0;
        this._library = [];
        this._battlefield = [];
        this._graveyard = [];
        this._exile = [];
        this._hand = [];
        this._lands = [];
        this.log("=== GAME START ===");
        this.initialDraw();
        //this.log("[HAND]", this.hand.map(c => c.name))
    }

    public end() {
        //Set a flag to stop processing events
        this._endFlag = true;
    }

    public onDraw?: (card: MTGCard) => void;
    public onUpkeep?: () => void;
    public onMainOne?: () => void;
    public onCombat?: () => void;
    public onMainTwo?: () => void;
    public onEndStep?: () => void;

    public onCast?: (card: MTGCard) => void;
    public onETB?: (card: MTGCard) => void;
    public onLTB?: (card: MTGCard) => void;
    public onDestroy?: (card: MTGCard) => void;
    public onMulligan?: (cards: MTGCard[], mulliganCount: number) => [hand: MTGCard[] | undefined, bottom: MTGCard[]];

    public playTurn() {
        const deckSize = this._deck.length;
        //If the sum of all cards in play does not match the deck size, we have a problem
        if (this._hand.length + this._battlefield.length + this._exile.length + this._graveyard.length + this._lands.length + this._library.length !== deckSize) {
            console.error('Hand', this.hand);
            console.error('Battlefield', this.battlefield);
            console.error('Exile', this.exile);
            console.error('Graveyard', this.graveyard);
            console.error('Lands', this.lands);
            console.error('Library', this.library.length);
            throw new Error("Deck size does not match cards in game");
        }

        if (this._endFlag)
            return;
        //Untap step
        this._turn++;
        //this.log(`Turn ${this._turn} start`);
        this._battlefield.forEach(card => { card.tapped = false; });
        this._lands.forEach(card => { card.tapped = false; });

        if (this._endFlag)
            return;
        if (this.onUpkeep)
            this.onUpkeep();

        if (this._endFlag)
            return;
        if (this._turn > 1)
            this.draw(1);
        //Main 1
        //Automatically play any one land from hand to battlefield
        if (this._endFlag)
            return;
        this.playLand("Land");

        this.log("[HAND]", this.hand.map(c => c.name).join("|"));
        if (this.battlefield.length > 0)
            this.log("[FIELD]", this.battlefield.map(c => c.name).join("|"));
        if (this.graveyard.length > 0)
            this.log("[YARD]", this.graveyard.map(c => c.name).join("|"));
        if (this.exile.length > 0)
            this.log("[EXILE]", this.exile.map(c => c.name).join("|"));
        this.log(`${this.lands.length} lands`);

        //this.log("[Land]", this.lands.map(c => c.name).join(" | "))
        //this.log("[Yard]", this.graveyard.map(c => c.name).join(" | "))
        if (this._endFlag)
            return;
        if (this.onMainOne)
            this.onMainOne();
        //Combat
        if (this._endFlag)
            return;
        if (this.onCombat)
            this.onCombat();
        //Main 2
        if (this._endFlag)
            return;
        if (this.onMainTwo)
            this.onMainTwo();
        //End step
        if (this._endFlag)
            return;
        if (this.onEndStep)
            this.onEndStep();

        /*if(this.lands.every(c => !c.tapped)) {
            console.warn("Ended turn doing nothing", this.hand.map(c => c.name))
        }*/
    }

    private initialDraw() {
        this._library = this._deck.map(c => c).sort(() => Math.random() - 0.5);
        let cards = this._library.splice(-7);

        if (this.onMulligan) {
            let mulliganCount = 0;
            let hand: MTGCard[] | undefined = [];
            let bottom: MTGCard[] = [];
            do {
                if (mulliganCount > 6) {
                    hand = [];
                    bottom = cards;
                } else {
                    this._hand = cards; //Need to assign to hand for condition checking
                    [hand, bottom] = this.onMulligan(cards, mulliganCount);
                    if (hand === undefined) {
                        mulliganCount++;
                        this.log(`Mulligan to ${7 - mulliganCount}`, cards.map(c => c.name).join("|"));
                        this._library = this._deck.map(c => c).sort(() => Math.random() - 0.5);
                        cards = this._library.splice(-7);
                    }
                }
            } while (hand === undefined);
            //Keep on mulliganing while hand returns undefined, need to pass to onMulligan how many mulligans we're into
            this._hand = hand;
            //this.log("Starting Hand", this.hand.map(c => c.name).join(" | "))
            //this.log("Bottoming", bottom.map(c => c.name).join(" | "))
            if (hand.length + bottom.length !== 7) {
                //throw new Error("Too many cards in mulligan")
                console.error("Too many cards in mulligan");
                console.error("Mulligan count", mulliganCount);
                console.error("Hand", hand.map(c => c.name));
                console.error("Bottom", bottom.map(c => c.name));
                throw new Error("Too many cards in mulligan");
            }
            if (bottom.length > 0) {
                //Add bottom to the start of the library
                this.log("Keeping", hand.map(c => c.name).join("|"));
                this.log("Bottoming", bottom.map(c => c.name).join("|"));
                this._library = bottom.concat(this._library);
            }
        } else {
            this._hand = cards;
        }
    }

    public static isMatch(identifier: string, card: MTGCard): boolean {
        identifier = identifier.trim().toLowerCase();
        if (identifier === "any")
            return true;
        if (identifier === card.name.toLowerCase())
            return true;
        if (card.types.map(t => t.toLowerCase()).includes(identifier))
            return true;

        return false;
    }

    public static findCard(identifier: string, cards: readonly MTGCard[]): MTGCard | undefined {
        //If identifier has X > Y > Z
        //We search for X first, then Y, then Z
        let possibilities = identifier.toLowerCase().split('>');
        for (const i in possibilities) {
            let match = cards.find(c => MTGGame.isMatch(possibilities[i], c));
            if (match)
                return match;
        }

        return undefined;
    }

    public static findManyCards(identifier: string, cards: readonly MTGCard[]): MTGCard[] {
        //Need to fix this, should grab starting from the first identifier
        return cards.flatMap(card => {
            if (MTGGame.findCard(identifier, [card]))
                return [card];
            else
                return [];
        });
    }

    exileFromYard(identifier: string) {
        let mtgCard = MTGGame.findCard(identifier, this._graveyard);
        if (mtgCard) {
            //(`Exiling` , mtgCard.name)
            this._graveyard = this._graveyard.filter(card => card !== mtgCard);
            this._exile.push(mtgCard);
        }
    }
    flashback(identifier: string) {
        //Cast card from graveyard
        let mtgCard = MTGGame.findCard(identifier, this._graveyard);
        if (mtgCard) {
            this.log(`Flashing back`, mtgCard.name);
            //And then exile it
            this._graveyard = this._graveyard.filter(card => card !== mtgCard);
            if (this.onCast)
                this.onCast(mtgCard);
            this._exile.push(mtgCard);
        } else {
            console.warn(`Couldn't find card to flashback`, identifier, this._graveyard);
        }
    }
    cast(identifier: string) {
        let mtgCard = MTGGame.findCard(identifier, this._hand);
        if (mtgCard) {
            this.log(`Casting`, mtgCard.name);
            this._hand = this._hand.filter(c => c !== mtgCard);
            if (this.onCast)
                this.onCast(mtgCard);
            //If the card is a permanent, we add it to the battlefield and trigger ETB
            if (mtgCard.isPermanent) {
                this._battlefield.push(mtgCard);
                this.log(`${mtgCard.name} ETBs`);
                if (this.onETB)
                    this.onETB(mtgCard);
            }

            //If the card is not a permanent, we send it to the graveyard    
            else {
                this._graveyard.push(mtgCard);
            }
        } else {
            console.warn(`Couldn't find card to cast`, identifier, this._hand);
        }
    }
    playLand(identifier: string) {
        let land = MTGGame.findCard(identifier, this._hand);
        if (land) {
            //this.log(`Playing land`,land.name);
            land.tapped = false;
            this._lands.push(land);
            this._hand = this._hand.filter(c => c !== land);
        }
    }
    tapLand(howMany: number) {
        //We grab howMany untapped lands
        let lands = this._lands.filter(card => !card.tapped).slice(0, howMany);
        //And tap them all
        this.log(`Tapping ${lands.length} lands`);
        lands.forEach(land => land.tapped = true);
    }
    reanimate(identifier: string) {
        //We find the card in the graveyard using findCard
        let card = MTGGame.findCard(identifier, this._graveyard);
        if (card && card.isPermanent) {
            this.log(`Reanimating`, card.name);
            //We remove it from the graveyard
            this._graveyard = this._graveyard.filter(c => c !== card);
            //And add it to the battlefield
            this._battlefield.push(card);
            //And trigger ETB
            this.log(`${card.name} ETBs`);
            if (this.onETB)
                this.onETB(card);
        } else {
            console.warn(`Couldn't find card to reanimate`, identifier, this._graveyard);
        }
    }
    discard(identifier: string) {
        //We find the card in the hand using findCard
        let mtgCard = MTGGame.findCard(identifier, this._hand);
        if (mtgCard) {
            this.log(`Discarding ${mtgCard.name}`);
            //We remove it from the hand
            this._hand = this._hand.filter(c => c !== mtgCard);
            //And add it to the graveyard
            this._graveyard.push(mtgCard);
        }
    }
    tutorCard(identifier: string) {
        //We find the card in the library using findCard
        let mtgCard = MTGGame.findCard(identifier, this._library);
        if (mtgCard) {
            this.log(`Tutoring ${mtgCard.name}`);
            //We remove it from the library
            this._library = this._library.filter(c => c !== mtgCard);
            //And add it to the hand
            this._hand.push(mtgCard);
        }
    }
    draw(howMany: number) {
        let cards = this._library.splice(howMany * -1);
        cards.forEach(card => {
            this.log(`Drawing ${card.name}`);
            this._hand.push(card);
            if (this.onDraw)
                this.onDraw(card);
        });
    }
    mill(howMany: number) {
        let cards = this._library.splice(howMany * -1);
        //this.log(`Milling ${howMany} cards`, cards.map(c => c.name));
        this.log(`Milling`, cards.map(c => c.name).join('|'));
        cards.forEach(card => {
            this._graveyard.push(card);
        });
    }
}
