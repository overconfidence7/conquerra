# Lines for Nate (session 22, the language pass)

*Every line a bot or a leader can say, grouped by who says it and when, with every version. Strike or change anything that doesn't sound like you (edit this file, or mark it up in a copy): the next session applies your marks to `packages/content/data/lines.json`. `{place}` and the like are filled in by the game with the real names and numbers. Lines marked **(unsure)** are the ones I'd look at first.*

*Generated from the line library on Oct 10. Counts: 241 bot lines, 83 plain reasons, 147 personality reasons, 445 leader lines, 27 captured-leader lines, 59 screen lines.*

## Thirteen to pick first (two or three versions each)
1. **The lobby's tagline** (under the title)
   - Set your orders, lock in, and watch every plan play out at once. *(today's)*
   - Everyone moves at once. Plan accordingly.
   - Set your orders, lock in, and watch everyone's plans collide.
2. **Victory** ("Victory!", then)
   - {n} turns played. The bards are already arguing about the details.
   - {n} turns played, and the map is yours.
   - {n} turns played. Someone should tell the other Houses. They know.
3. **Defeat** ("Lady Morwen wins", then)
   - {n} turns played, which is {n} more than nothing.
   - {n} turns played. {winner} sends their regards. Probably.
   - {n} turns played. There's always the next game.
4. **Your capital falling** (the title card stays plain: "Rookhome falls to House Purpure"; your Leader, the Conqueror, in the report)
   - {capital} is gone. {rival} brought {n} troops. I'll want them back.
   - For the record, it took {rival} {n} troops to take {capital}. We'll remember the number.
   - {capital} fell to {rival}. I have a plan for that too.
5. **A House knocked out** (the title card's subline)
   - They had a good run. Mostly the running.
   - {house}'s banners are now available, slightly used.
   - {house} will be remembered. Briefly.
6. **A deal broken** (the subline, and the Schemer's own line)
   - The ink was barely dry.
   - It was a lovely deal while it lasted.
   - {place} was always going to be mine. Honestly, you should have read the terms.
   - Our deal was lovely while it lasted. It lasted until {place} looked unguarded.
7. **Your Leader's first line of a game** (the Conqueror)
   - {leader} here. {capital} is ours, and I have plans for the rest of the map.
   - {leader} reporting. One plan, one front. I'll tell you which one when I've picked it.
   - {leader} here. Point me at someone and I'll handle the rest.
8. **Your Steward's wall** (the Turtle)
   - {place}'s wall is up. Anyone who wants {capital} now has to go through all of it.
   - {place} is walled. I'll sleep better.
   - The wall at {place} is finished. It's beautiful. {capital} thanks you.
9. **A captured leader's first report**
   - {name} here. Formerly of {house}, which as you know is no longer a thing. Reporting to {leader}.
   - {name}, reporting to {leader}. I've always admired your House. Since this turn.
   - {name} here. My loyalty to {house} lasted right up until {house} stopped existing. I'm all yours now.
10. **A captured leader brownnosing** (taking land)
   - Took {places}, my liege. Your wisdom guided my every step. Mostly the steps toward {place}.
   - Took {places}. I'd say I did it for {house}, but I've never heard of them.
   - Took {places}, Your Grace. History will be kind to you. I'll make sure of it.
11. **Your Leader judging one of your bad moves** (the Conqueror)
   - You sent {n} against {place}'s {m}. Bold. I'd have waited a turn and brought the {k} from {other}.
   - {n} against {m} at {place}. I'd have brought the {k} from {other} and done it once.
   - You hit {place}'s {m} with {n}. The {k} at {other} were right there. One front, all of it, next time.
12. **The Steward's handout** (session 23 turns it on)
   - Sent {n} gold back. Wanted the peasants to have something.
   - Returning {n} gold. Don't spend it all in one place. Or do, it's only {n}.
   - Here's {n} gold. Nothing out here worth building, and I know things have been tight at the palace.
13. **The Merchant's no** (a trade)
   - The numbers don't work for me. Walk me through how you got there.
   - Thanks for the offer. Walk me through the math, because I'm not seeing it.
   - I appreciate it, but the price is off. Walk me through it.

## The six bot personalities
*What each says when its own style decides an answer, its offers, and breaking a deal. The game picks a version from the game, the turn and the bot, so a reload says the same thing.*


### The Conqueror

**Truce: yes**
- My war is somewhere else. Peace on our border suits me fine.
- Agreed. I have one war, and you aren't it.
- Peace on our border. My army already has a front.
- Fine. One front at a time, and ours isn't the one.

**Truce: no**
- No truce. My armies go where I send them.
- No. I don't sign away a border I might need.
- My plan doesn't have a truce in it. No.
- No truce. I'd rather keep my options and my army.

**Joint war: yes**
- One front, one enemy. I'm with you.
- Yes. Point me at them.
- Agreed. My army was going that way anyway.
- A single target. That's how I like it. I'm in.

**Joint war: no**
- I fight one war at a time, and it isn't that one.
- No. My army already has a front.
- Not that war. I picked mine already.

**Trade: yes**
- A fair price. I'll take it.
- Done. Fair is fair.
- Agreed. Now back to the war.

**Trade: no**
- Land is won with armies, not gold.
- No. I take land, I don't buy it.
- I'll keep my land. I remember how I got it.

**Right of passage: yes**
- March through. Keep moving.
- Go ahead. Don't stop to admire the view.
- Pass through. My land is for marching, so march.

**Right of passage: no**
- My land is my staging ground. Find another road.
- No. My roads are busy with my own army.
- You want to march an army through my land. Bold. No. **(unsure: the guide's line, without the 'you're massed on my border' condition)**

**Offers a truce**
- My war is somewhere else. Let's have peace on our border.
- I have one front, and it isn't you. Peace on our border.
- Peace on our border. I'd like my army pointed one way.

**Offers a joint war**
- Strike {target} with me. One front, one enemy.
- {target} is my target. Join me and it goes faster.
- Hit {target} with me. I'll do most of the work.

**Breaks a deal for a prize**
- {place} is mine for the taking. Our deal isn't worth more than that.
- Our deal is over. {place} was always the plan.
- I'm taking {place}. The deal had a good run.

**Its turn of phrase after a plain yes**
- That's my answer.
- Agreed.
- Good.

**Its turn of phrase after a plain no**
- That's my answer.
- No.
- My plan stands.

**Its own versions of the shared reasons**

*runawayGrow*
- You're running away with the map. I don't help the one I'll have to beat.
- You're running away with the map. No help from me.
- No. You're running away with the map, and I'm not making it easier.

*runawayPass*
- You're running away with the map. My roads stay shut to you.
- No. You're running away with the map, and you won't do it through my land.
- You're running away with the map. Not through here.

*gladlyRunaway*
- Gladly. {target} is running away with the map, and that ends now.
- {target} is running away with the map. One front, one enemy. I'm in.
- Yes. {target} is running away with the map. Point me at them.

*offerRunawayWar*
- {target} is running away with the map. Strike with me and we stop it.
- {target} is running away with the map. One front, one enemy. Join me.
- {target} is running away with the map. I'm going after them. Come along.

*breakRunaway*
- You're running away with the map. Our {deal} is over.
- Our {deal} is over. You're running away with the map, and I'm stopping it.
- You're running away with the map. I'm ending our {deal} and starting the war.

*breakWin*
- One more battle wins the game. Our {deal} doesn't get a vote.
- One battle left. I won't let our {deal} stop me.
- One more battle wins the game. Our {deal} ends here.

*cantSpare*
- I can't spare {n} gold for a binding pact. That's troops.
- {n} gold for a binding pact is {n} gold I won't spend on my army. No.
- No. {n} gold for a binding pact is more than I can spare.

*brokeOurAt*
- You broke our {deal} at {place}. I don't forget that.
- You broke our {deal} at {place}. My army remembers it too.
- {place}. You broke our {deal} there. No.


### The Blitzer

**Truce: yes**
- Fine. Fewer borders to watch while I run.
- Done. Can't stop to fight you anyway.
- Peace. Quickly, I'm busy.
- Sure. One less border, more running.

**Truce: no**
- I don't stop for anyone.
- No. Too slow.
- No truce. I'm already moving.
- Can't. Your land is on my way.

**Joint war: yes**
- More land to take. I'm in.
- Yes. Already moving.
- In. Try to keep up.

**Joint war: no**
- Too slow. I'll take my own road.
- No. Wrong direction.
- Not that one. I'm running the other way.

**Trade: yes**
- Quick and fair. Done.
- Done. Next.
- Fine. Fast.

**Trade: no**
- I'd rather just take it.
- No. Taking it is quicker.
- Pass. I'll get there myself.

**Right of passage: yes**
- Run through. I won't slow you.
- Go. Just don't stop.
- Through you go. Keep the pace up.

**Right of passage: no**
- My armies need every road.
- No. My roads are full of my own army.
- Can't. Traffic. **(unsure: too jokey for a deal answer?)**

**Offers a truce**
- Let's not waste time on each other.
- Peace on our border. I've got places to be.
- Truce. I'm running somewhere else.

**Offers a joint war**
- Let's run {target} over together.
- Hit {target} with me. This turn, ideally.
- {target}. You and me. Now.

**Breaks a deal for a prize**
- {place} is right there. I'm not stopping.
- Deal's over. {place} was open.
- Took the deal, now taking {place}. Busy turn.

**Its turn of phrase after a plain yes**
- Done.
- Moving on.
- Next.

**Its turn of phrase after a plain no**
- Next.
- Moving on.
- No time.

**Its own versions of the shared reasons**

*runawayGrow*
- You're running away with the map. Faster than me, even. No.
- No. You're running away with the map.
- You're running away with the map. I'm not helping you run.

*runawayPass*
- You're running away with the map. Not through my roads.
- No. You're running away with the map. Go around.
- You're running away with the map. Not on my roads.

*gladlyRunaway*
- Gladly. {target} is running away with the map. Let's go.
- {target} is running away with the map. In. Now.
- Yes. {target} is running away with the map and I'm already moving.

*offerRunawayWar*
- {target} is running away with the map. Hit them with me. Now.
- {target} is running away with the map. You and me, this turn.
- Let's run {target} down. They're running away with the map.

*breakRunaway*
- You're running away with the map. Our {deal} is over.
- Our {deal} is done. You're running away with the map.
- No time for our {deal}. You're running away with the map.

*breakWin*
- One more battle wins it. Our {deal} is over.
- One more battle. Can't stop for our {deal}.
- Our {deal} is done. One battle left and I'm taking it.

*cantSpare*
- I can't spare {n} gold for a binding pact. Too slow anyway.
- {n} gold for a binding pact. No. That's recruits.
- No. {n} gold for a binding pact is {n} gold not marching.

*brokeOurAt*
- You broke our {deal} at {place}. I was busy, but I noticed.
- You broke our {deal} at {place}. No.
- {place}. Our {deal}. You broke it. Next.


### The Turtle

**Truce: yes**
- Peace works for me. My walls aren't finished yet.
- Agreed. I'd rather build than fight.
- Peace suits me. The masons were getting nervous.
- Yes. Fewer armies near my walls is always welcome.

**Truce: no**
- My walls hold well enough without a truce.
- No. I trust my walls more than a signature.
- No truce. Come and look at my walls first.

**Joint war: yes**
- When I march, I march once. Now is the time.
- Agreed. The big army has been waiting for this.
- Yes. I've been saving up for this one.

**Joint war: no**
- My army stays behind my walls for now.
- No. My walls need their army.
- Not yet. I march once, and this isn't it.

**Trade: yes**
- A fair price, and peace with it. Agreed.
- Agreed. Gold builds walls.
- Fair. The masons thank you.

**Trade: no**
- I don't give up what I've built.
- No. Everything I own took a long time to build.
- No. I built that.

**Right of passage: yes**
- Pass quietly, and keep away from my walls.
- Go through. Mind the walls.
- You may pass. Stay on the road and off my walls.

**Right of passage: no**
- No foreign army walks past my walls. Find another road.
- No. Armies near my walls make me nervous.
- No. The walls are for keeping people out, and that includes you.

**Offers a truce**
- Peace suits us both. Let's leave each other be.
- Let's have peace on our border. I have walls to finish.
- Peace. I'd rather spend the gold on stone.

**Offers a joint war**
- Strike {target} with me, and I'll bring the big army.
- I've been building up for {target}. Join me.
- {target} is next. My army has been waiting behind the walls for this.

**Breaks a deal for a prize**
- My army is ready, and {place} is the prize. Our deal is over.
- I waited a long time for {place}. The deal is done.
- Built, saved, ready. {place} is next, deal or no deal.

**Its turn of phrase after a plain yes**
- Carefully, of course.
- Agreed, slowly.
- The walls approve.

**Its turn of phrase after a plain no**
- The walls stay as they are.
- I'll be behind my walls.
- Safe is better than sorry.

**Its own versions of the shared reasons**

*runawayGrow*
- You're running away with the map. Helping you grow is how I end up besieged.
- No. You're running away with the map, and my walls would be next.
- You're running away with the map. I won't help you grow. I've seen how this ends.

*runawayPass*
- You're running away with the map. Not past my walls.
- No. You're running away with the map, and you'd be marching right past my walls.
- You're running away with the map. My gates stay shut.

*gladlyRunaway*
- Gladly. {target} is running away with the map. The big army is ready.
- {target} is running away with the map. I march once, and this is it.
- Yes. {target} is running away with the map, and my walls won't hold them forever.

*offerRunawayWar*
- {target} is running away with the map. Strike with me, and I'll bring the big army.
- {target} is running away with the map. Let's stop them before they reach my walls.
- {target} is running away with the map. Join me. I've been saving up for this.

*breakRunaway*
- You're running away with the map. Our {deal} is over, and my army is coming out.
- Our {deal} is over. You're running away with the map, and I'd rather fight you now than at my walls.
- You're running away with the map. I'm ending our {deal}.

*breakWin*
- One more battle wins the game. Our {deal} is over.
- One more battle wins it. I've waited long enough, {deal} or no {deal}.
- One more battle wins the game. Our {deal} was nice while it lasted.

*cantSpare*
- I can't spare {n} gold for a binding pact. That's a wall.
- {n} gold for a binding pact. That's a lot of stone. No.
- No. {n} gold for a binding pact is more than I can spare.

*brokeOurAt*
- You broke our {deal} at {place}. I still have the dent in my wall from it.
- We had a {deal} once. You broke it at {place}, and I rebuilt the wall.
- You broke our {deal} at {place}. The masons still talk about it.


### The Schemer

**Truce: yes**
- Of course, friend. Peace between us.
- Peace, friend. For now, which is all anyone can promise.
- Gladly, friend. I'll remember the favour.
- Peace it is, friend. I do love a signed promise.

**Truce: no**
- Not now, friend. I have other plans for that border.
- Not this time, friend. Nothing personal.
- I'd rather keep that border interesting, friend.

**Joint war: yes**
- Together, then. They'll never see it coming.
- Of course, friend. I've been meaning to.
- Count me in, friend. I'll be right behind you.

**Joint war: no**
- That war serves you, not me.
- Pass, friend. That one's all yours.
- Not that one, friend. I have my eye on someone else.

**Trade: yes**
- A pleasure doing business.
- Done, friend. I'll remember this.
- Lovely. A pleasure, as always.

**Trade: no**
- You'll have to sweeten that, friend.
- Not at that price, friend.
- Close, friend. Sweeten it.

**Right of passage: yes**
- Pass, friend. I'll remember the favour.
- Go on through, friend. I'll be watching. Out of friendship.
- Of course, friend. Mind where you leave your army.

**Right of passage: no**
- I'd rather know where your armies are, friend.
- Not through my land, friend. I like you where I can see you.
- No, friend. Nothing personal. Mostly.

**Offers a truce**
- Let's not fight over this border. Peace, friend.
- Peace, friend. We have so much in common.
- Peace on our border, friend. I'll remember it.

**Offers a joint war**
- {target} has it coming. Strike with me.
- Strike {target} with me, friend. I'll be right behind you.
- Between us, {target} has been asking for it. Join me.

**Breaks a deal for a prize**
- {place} was always going to be mine. Honestly, you should have read the terms.
- Our deal was lovely while it lasted. It lasted until {place} looked unguarded.
- Sorry, friend. {place} was too good to pass up. I'll send flowers. **(unsure: flowers: too cute?)**

**Its turn of phrase after a plain yes**
- I'll remember this, friend.
- For now, friend.
- Lovely.

**Its turn of phrase after a plain no**
- Nothing personal, friend.
- Another time, friend.
- No hard feelings, friend.

**Its own versions of the shared reasons**

*runawayGrow*
- You're running away with the map, friend. I won't help you grow.
- Friend, you're running away with the map. I can't help with that.
- You're running away with the map. I'd love to help, friend. I won't.

*runawayPass*
- You're running away with the map, friend. Not through my land.
- Not through here, friend. You're running away with the map.
- You're running away with the map, friend. I like you where you are.

*gladlyRunaway*
- Gladly. {target} is running away with the map. They'll never see it coming.
- Of course, friend. {target} is running away with the map.
- {target} is running away with the map. I've been hoping someone would ask.

*offerRunawayWar*
- {target} is running away with the map. Let's stop them together, friend.
- Between us, {target} is running away with the map. Strike with me.
- {target} is running away with the map, friend. I'll be right behind you.

*breakRunaway*
- You're running away with the map, friend. Our {deal} is over.
- Our {deal} was lovely, friend. You're running away with the map, so it's over.
- Sorry, friend. You're running away with the map. Our {deal} ends now.

*breakWin*
- One more battle wins the game. You should have read the terms of our {deal}.
- Sorry, friend. One more battle wins it, and our {deal} is in the way.
- One more battle wins the game. Our {deal} was always going to end like this.

*cantSpare*
- I can't spare {n} gold for a binding pact, friend. A handshake should do.
- {n} gold for a binding pact. Between friends, that's too much.
- Not {n} gold, friend. I can't spare that for a binding pact.

*brokeOurAt*
- You broke our {deal} at {place}, friend. I remember these things.
- Friend, you broke our {deal} at {place}. I was saving that for myself.
- You broke our {deal} at {place}. I admire it, honestly. I still won't trust you.


### The Opportunist

**Truce: yes**
- Fine. I'll find easier pickings.
- Peace. There's softer land elsewhere.
- Agreed. You're not the weak one this turn.

**Truce: no**
- Not while someone's bleeding. I keep my hands free.
- No. Something nearby is about to fall over.
- No truce. I like my options open and my neighbours tired.

**Joint war: yes**
- They're weak. Let's finish it.
- Gladly. I know a wounded House when I see one.
- In. I can't pass this one up.

**Joint war: no**
- There's nothing to pick over there.
- No. They're too healthy for my taste.
- Pass. I wait for the bleeding to start.

**Trade: yes**
- A good price. I'll take it.
- Done. Somebody's loss, my gain.
- Fair. I'd have been a fool to say no.

**Trade: no**
- Not worth my while.
- No. I'll wait for it to get cheaper.
- Pass. Prices only go down from here.

**Right of passage: yes**
- Go on through. I'll be watching.
- Pass. I'm curious how it goes.
- Through you go. I'll be nearby, just in case.

**Right of passage: no**
- I'll keep my roads to myself.
- No. My roads are for my own errands.
- No. I don't let anyone get behind me.

**Offers a truce**
- Let's not bleed each other for the others' sake.
- Peace. Let someone else do the fighting for a while.
- Truce. We both have better targets.

**Offers a joint war**
- {target} is wounded. Let's finish them.
- {target} has had a bad few turns. Let's make it worse.
- {target} is bleeding. I'd hate to waste that.

**Breaks a deal for a prize**
- {place} is wide open. I'd be a fool not to take it.
- {place} was just sitting there. The deal is over.
- Nothing personal. {place} was unguarded and I'm practical.

**Its turn of phrase after a plain yes**
- I'd be a fool to say no.
- Easy call.
- Practical.

**Its turn of phrase after a plain no**
- Nothing in it for me.
- Practical, that's all.
- Ask me again when things change.

**Its own versions of the shared reasons**

*runawayGrow*
- You're running away with the map. I don't help the strong. I wait for them to slip.
- No. You're running away with the map, and I'd rather pick at you than feed you.
- You're running away with the map. I won't help you grow.

*runawayPass*
- You're running away with the map. Not through my land.
- No. You're running away with the map, and I'm not letting you behind me.
- You're running away with the map. My roads are closed.

*gladlyRunaway*
- Gladly. {target} has been very comfortable lately. Running away with the map, in fact. **(unsure: your sample, with the plain reason added after it)**
- Gladly. {target} is running away with the map, and everyone's tired of it.
- {target} is running away with the map. Somebody had to ask. I'm in.

*offerRunawayWar*
- {target} is running away with the map. Everyone wants a piece. Let's be first.
- {target} is running away with the map. Let's finish it before they get further.
- {target} has been very comfortable lately. Running away with the map, in fact. Join me. **(unsure: same)**

*breakRunaway*
- You're running away with the map. Our {deal} is over.
- Our {deal} is over. You're running away with the map, and I'm practical.
- You're running away with the map. I'd be a fool to keep our {deal}.

*breakWin*
- One more battle wins the game. I'd be a fool to let our {deal} stop me.
- One more battle wins it. Our {deal} is over.
- Our {deal} is over. One battle from the win, and I'm practical.

*cantSpare*
- I can't spare {n} gold for a binding pact. Not worth it.
- {n} gold for a binding pact. I'll pass.
- No. {n} gold for a binding pact is gold I need for better chances.

*brokeOurAt*
- You broke our {deal} at {place}. I'd have done the same, which is exactly why I won't trust you.
- You broke our {deal} at {place}. I learned from it.
- {place}, our {deal}, broken by you. Noted.


### The Merchant

**Truce: yes**
- Peace is good for business. Agreed.
- Agreed. Fair terms, and cheaper than a war.
- Done. Peace pays better than fighting.

**Truce: no**
- Peace with you would cost me more than it's worth.
- I ran the numbers. Peace with you doesn't pay.
- Thanks for the offer, but it doesn't work for me.

**Joint war: yes**
- A war that pays. Count me in.
- Agreed. The numbers on this one work.
- Thanks for bringing it to me. I'm in.

**Joint war: no**
- Wars are bad for business.
- I ran the numbers, and that war loses money.
- Thanks, but that war doesn't pay for itself.

**Trade: yes**
- A fine bargain. Done.
- Fair offer. Done.
- Thanks, that's a good price. Done.

**Trade: no**
- The numbers don't work for me. Walk me through how you got there.
- Thanks for the offer. Walk me through the math, because I'm not seeing it.
- I appreciate it, but the price is off. Walk me through it.

**Right of passage: yes**
- Pass through. Trade follows armies.
- Go ahead. Spend some gold in my markets on the way.
- Agreed. Safe roads are good for everyone's business.

**Right of passage: no**
- Armies on my roads scare off the traders.
- No. Armies on my roads are bad for the markets.
- Thanks, but my roads are for wagons.

**Offers a truce**
- Peace is good for business. Let's have some.
- A truce. It's cheaper for both of us.
- Peace on our border. I'll show you the math if you like.

**Offers a joint war**
- {target} is bad for business. Strike with me.
- Join me against {target}. The numbers work for both of us.
- {target} is costing us both. Let's fix that.

**Breaks a deal for a prize**
- {place} is worth more than our deal. Nothing personal, it's just the math.
- I ran the numbers on {place}. The deal lost.
- Our deal was good business until {place} was better business.

**Its turn of phrase after a plain yes**
- Good doing business with you.
- The numbers work.
- Thanks for bringing it to me.

**Its turn of phrase after a plain no**
- Walk me through it if I've got it wrong.
- The numbers are the numbers.
- Thanks for asking, though.

**Its own versions of the shared reasons**

*runawayGrow*
- You're running away with the map. Helping you grow is bad business for me.
- I ran the numbers. You're running away with the map, so I won't help you grow.
- You're running away with the map. Nothing personal, but it's bad for my business.

*runawayPass*
- You're running away with the map. My roads stay closed to you.
- You're running away with the map. Letting you through is bad business.
- No. You're running away with the map, and my traders would like to keep their roads.

*gladlyRunaway*
- Gladly. {target} is running away with the map, and that's bad for everyone's business.
- Thanks for asking. {target} is running away with the map. I'm in.
- {target} is running away with the map. The numbers on stopping them work. Count me in.

*offerRunawayWar*
- {target} is running away with the map. That's bad for business. Let's stop them together.
- {target} is running away with the map. It's cheaper to stop them now. Join me.
- Join me against {target}. They're running away with the map, and the math only gets worse.

*breakRunaway*
- You're running away with the map. Our {deal} is over. Nothing personal, it's just the math.
- I ran the numbers. You're running away with the map, so our {deal} is over.
- Our {deal} is over. You're running away with the map, and that's bad for business.

*breakWin*
- One more battle wins the game. Our {deal} can't compete with that.
- One more battle wins it. Nothing personal about our {deal}, it's just the math.
- Our {deal} is over. One battle from the win is very good business.

*cantSpare*
- I can't spare {n} gold for a binding pact. Walk me through why it's worth that.
- {n} gold for a binding pact. The numbers don't work for me.
- Thanks, but {n} gold for a binding pact is more than I can spare.

*brokeOurAt*
- You broke our {deal} at {place}. That's a bad credit history.
- You broke our {deal} at {place}. I keep records.
- You broke our {deal} at {place}. Walk me through why I'd trust you now.

*counterGold*
- Close. Make it {n} gold and it's a deal.
- Make it {n} gold and we're done. I can walk you through the math.
- {n} gold and it's a deal. That's the number that works for me.


## The shared reasons, plain (the Captain and the Recruit, and any personality without its own version)

- *notForMe*: That offer isn't for me.
- *badTerms*: Those terms don't fit the rules.
- *alreadyHave*: We already have a {deal}.
- *nothingLeft*: I have nothing left to bargain with.
- *cantSpare*: I can't spare {n} gold for a binding pact.
- *runawayGrow*: You're running away with the map. I won't help you grow.
- *runawayPass*: You're running away with the map. I won't let you through.
- *strongestGrow*: You're the strongest of us. I won't help you grow.
- *strongestPass*: You're the strongest of us. I won't let you through.
- *atWarWithPartner*: You're at war with {rival}, who has a deal with me. I won't let you through.
- *brokeOur*: You broke our {deal}.
- *brokeOurAt*: You broke our {deal} at {place}.
- *warFellThrough*: Our last joint war fell through. You never struck our target.
- *oathbreakerTo*: You broke your word to {rival}. That makes you an Oathbreaker.
- *oathbreaker*: You're an Oathbreaker.
- *noTrustYet*: I don't trust you yet.
- *noTrust*: I don't trust you.
- *makeBinding*: {why} Make it binding and it's a deal.
- *noHelp*: That doesn't help me.
- *bindingCosts*: A binding pact costs me {n} gold, and it isn't worth that.
- *noBorderPeace*: We don't even share a border, so peace costs me nothing.
- *noBorderBinding*: We don't share a border, so a binding pact isn't worth gold.
- *handsFree*: I'd rather keep my hands free.
- *targetNotStopping*: You're my target now. I'm not stopping.
- *needArmyRunaway*: I need my army against {rival}, who's running away with the map.
- *needArmyIn*: I need my army in {where}.
- *theirArmyBigger*: Your army at our border is bigger than mine. Peace suits me.
- *holdingFine*: I'm holding our border well enough without a truce.
- *capitalDoor*: Your army is at my capital's door. I'll take peace.
- *strongerFight*: I'm stronger on our border. I'd rather fight.
- *shieldsRunaway*: You're holding back {rival}. I won't stab you in the back.
- *peaceUntil*: Peace until {rival} is beaten suits me.
- *truceTooLong*: {n} turns is too long to tie my hands.
- *counterTruce*: {n} turns, not {m}, and we have a deal.
- *gladlyRunaway*: Gladly. {target} is running away with the map.
- *gladlyStrongest*: Gladly. {target} is the strongest of us.
- *counterWar*: {n} turns, and I'm in.
- *targetNoWar*: You're my target. I'm not joining a war on your side.
- *shieldsTarget*: {target} is holding back {rival}. I won't weaken them.
- *truceWithTarget*: I have a truce with {target}.
- *cantReach*: I can't reach {target} from where I stand.
- *bothWant*: We both want {target} beaten.
- *targetWeak*: {target}'s army near me is weak. Let's do it.
- *targetStrong*: {target} is too strong for me to take on right now.
- *warTooLong*: That's too long a war to promise.
- *targetNoPassage*: You're my target. I won't open my land to you.
- *noArmiesInLand*: I don't want your armies in my land.
- *mayPass*: You may pass. Keep moving.
- *beatFoe*: Go and beat {rival}. You may pass.
- *mutualFair*: And my armies may pass through yours. That's fair.
- *passageTooLong*: {n} turns is too long to keep my land open.
- *counterPassage*: {n} turns, and you may pass.
- *cantPay*: I don't have that much gold.
- *noCapital*: I won't give up my capital.
- *guardsCapital*: {place} guards my capital. It isn't for sale.
- *giftGladly*: {gain}, and nothing asked in return. Gladly.
- *fairPrice*: {gain} for {cost}. A fair price.
- *fairPricePlain*: A fair price.
- *notEnough*: I'd give {cost} for {gain}. Not enough.
- *needGold*: I need my gold for troops.
- *useGold*: I could use the gold now.
- *counterGold*: Make it {n} gold and it's a deal.
- *recruitWeaker*: You're stronger than me. Peace suits me.
- *recruitStronger*: I'm stronger than you. I'll take my chances.
- *recruitGladly*: Gladly. They're running away with the map.
- *recruitJoin*: I'm strong enough to join you.
- *recruitTooStrong*: They're too strong for me.
- *recruitNoPassage*: I don't let armies through my land.
- *recruitNoLand*: I don't give up land.
- *recruitFair*: Fair enough.
- *recruitNo*: No, thank you.
- *offerRunawayWar*: {target} is running away with the map. Let's stop them together.
- *offerPassage*: Let my armies through your land to reach {target}.
- *offerPassageRunaway*: Let my armies through your land to reach {target}, who's running away with the map.
- *offerPassageBeaten*: Let my armies through your land to reach {target}, who's nearly beaten.
- *offerTruceNeeded*: My army is needed in {where}. Let's have peace on our border.
- *offerTrucePlain*: Let's have peace on our border.
- *offerRecruitTruce*: You're stronger than me. Let's keep the peace.
- *offerBuyLand*: {place} would complete {province} for me. I'll pay {n} gold for it.
- *offerSellLand*: I'm short of gold. {place} is yours for a fair price.
- *breakWin*: One more battle wins the game. I won't let our {deal} stop me.
- *breakCapital*: Your capital at {place} is mine for the taking. Our {deal} isn't worth more than that.
- *breakRunaway*: You're running away with the map. Our {deal} is over.


## Your leaders
*Shown in the turn report under 'Your leaders', in the Chronicle, and (the latest) in the Leaders panel. At most one line per leader a turn and three a report.*


### The Conqueror

**Its first word of the game**
- {leader} here. {capital} is ours, and I have plans for the rest of the map.
- {leader} reporting. One plan, one front. I'll tell you which one when I've picked it.
- {leader} here. Point me at someone and I'll handle the rest.

**Took land**
- Took {places}. {rival} ran before we got there.
- Took {places} from {rival}. One plan, working as planned.
- Took {places}. {rival} didn't hold the line for long.
- Took {places}. Next.

**Driven back**
- Pushed at {place} and got pushed back. Lost {n}. We go again.
- {place} held. Lost {n}. It won't next time.
- Driven back at {place}, {n} lost. Noted, and not for long.

**Took a rival's capital**
- {capital} is ours. {rival} will want it back. They won't get it.
- Took {capital}. That was {rival}'s capital, for the record.
- {capital} has a new owner. One plan, working as planned.

**Your capital fell**
- {capital} is gone. {rival} brought {n} troops. I'll want them back.
- For the record, it took {rival} {n} troops to take {capital}. We'll remember the number. **(unsure: sharp when n is small (2 troops took the capital))**
- {capital} fell to {rival}. I have a plan for that too.

**Finished a rival**
- {rival} is done. We checked the fog twice.
- {rival} is out. Next.
- That's the end of {rival}. One front closed.

**A rival army near your capital (it runs your army)**
- Heads up, {rival} has {n} troops two steps from {capital}. I'm moving what I can inside the wall.
- {rival} has {n} troops two steps from {capital}. I'm pulling the army home to meet them.
- Heads up, {n} of {rival}'s troops are two steps from {capital}. I'm on it.

**A rival army near your capital (you run the army)**
- Heads up, {rival} has {n} troops two steps from {capital}. Your army, your call, but I'd bring some home.
- {rival} has {n} troops two steps from {capital}. I'd move troops in before they do.
- Heads up, {n} of {rival}'s troops are two steps from {capital}. Just saying.

**Its purse is empty**
- Purse is empty. I'll be holding the line with strong opinions.
- Out of gold. The war continues on credit.
- My purse is empty. The plan is not.

**A wall finished (the Steward)**
- {place}'s wall is up. Now we can stop worrying about {capital} and go win something.
- {place} is walled. Good. One less thing to defend.
- Wall's up at {place}. Back to the war.

**Judging your failed attack (with the army that was next to it)**
- You sent {n} against {place}'s {m}. Bold. I'd have waited a turn and brought the {k} from {other}.
- {n} against {m} at {place}. I'd have brought the {k} from {other} and done it once.
- You hit {place}'s {m} with {n}. The {k} at {other} were right there. One front, all of it, next time.

**Judging your failed attack (nothing next to it)**
- You sent {n} against {place}'s {m}. Bold. I'd have waited a turn for more.
- {n} against {m} at {place}. I'd have waited until the numbers were ours.
- You hit {place}'s {m} with {n}. I admire the confidence. I'd have brought more. **(unsure: reads oddly when n is 1 ('Moonwood's 41 with 1'))**

**Judging land you left thin**
- You left {place} with {n} next to {rival}'s {m}. {rival} noticed.
- {place} had {n} troops and {rival} had {m} next door. That math was never going to work.
- {n} at {place}, {m} of {rival}'s next to it. I'd have held one border properly.

**Judging a truce you broke**
- You broke the truce with {rival}. {rival} and {n} of their friends would like a word.
- We broke our word to {rival}, and now {n} more Houses are coming with them. I'd have kept it until the war was ready.
- Breaking the truce with {rival} brought {n} of their friends in. I'd have picked one enemy.

**Judging gold left idle**
- You had {n} gold in the treasury and {place} fell. I'd have turned the gold into troops.
- {place} fell with {n} gold sitting in the treasury. Gold doesn't hold walls.
- {n} gold unspent, and {place} is gone. I'd have bought an army with it.

**Judging your capital left light**
- You left {capital} with {n} troops next to {rival}'s {m}. I'd have brought the army home first.
- {capital} had {n}, {rival} had {m} next door. I'd have fixed that before anything else.
- {n} at {capital} against {rival}'s {m}. I'd have guarded the capital, then gone conquering.

**A grudging compliment**
- That worked at {place}. I'd have done it the same way, just sooner.
- Good call at {place}. I'll take some of the credit anyway.
- {place} was a good hit. I'd have done the same.

**A grudge: our fort burned**
- {rival} burned our fort at {place} on turn {turn}. I haven't forgotten, in case you were wondering.
- Still thinking about our fort at {place}. {rival}, turn {turn}.
- {rival} owes us a fort. {place}, turn {turn}.

**A grudge: home land taken**
- {rival} took {place} from our home province on turn {turn}. I haven't forgotten.
- {place} was ours until {rival} came through on turn {turn}. I'd like it back.
- {rival}, {place}, turn {turn}. I keep a list. It's a short list.

**A grudge: our army wiped out**
- {rival} wiped out our army at {place} on turn {turn}. I haven't forgotten.
- Turn {turn}, {place}, {rival}. Our army never came home. I'd like a rematch.
- {rival} broke our army at {place} on turn {turn}. That's on the list.

**The grudge settled**
- Took {place} back from {rival}. Turn {turn} feels like a long time ago now.
- {place} is ours again. {rival} can keep the memory of turn {turn}.
- Paid {rival} back for {place}. We're even. For now.

**The grudge turns to respect**
- {rival} took {place} too. I'm starting to respect them. A little.
- {rival} again, at {place}. Fine. They're good. I'll still beat them.
- {place} as well. {rival} has earned a grudging nod from me. Grudging.

**The Steward's handout (session 23)**
- Sent {n} gold back. My war chest has standards.
- Returning {n} gold. Spend it on something with a sword.
- Here's {n} gold back. Nothing worth conquering with it this turn.


### The Blitzer

**Its first word of the game**
- {leader} here. Already moving.
- {leader}. Ready. Point the way.
- {leader} reporting. {capital} is fine. The rest of the map is the plan.

**Took land**
- Took {places}. Already moving.
- Took {places}. Didn't stop to look around.
- Took {places}. {rival} were slow.
- {places}. Done. Next.

**Driven back**
- Bounced off {place}. Lost {n}. Going around.
- {place} held. {n} gone. Next.
- Lost {n} at {place}. Already moving.

**Took a rival's capital**
- Took {capital}. That was {rival}'s capital. Moving on.
- {capital}, done. {rival} was slow.
- {rival}'s capital, {capital}, is ours. Next.

**Your capital fell**
- {capital} is gone. {rival} brought {n}. We were somewhere else.
- {rival} took {capital} with {n}. I was busy. Sorry.
- Lost {capital} to {rival}'s {n}. We'll be faster.

**Finished a rival**
- {rival} is done. Next.
- {rival}, out. Faster than I thought.
- Finished {rival}. Who's next.

**A rival army near your capital (it runs your army)**
- Heads up, {rival}, {n} troops, two steps from {capital}. Turning around.
- {n} of {rival}'s, two steps from {capital}. Heading home. Quickly.
- {rival} has {n} near {capital}. On my way.

**A rival army near your capital (you run the army)**
- Heads up, {rival}, {n} troops, two steps from {capital}. Your move.
- {n} of {rival}'s troops two steps from {capital}. I'd hurry.
- {rival} has {n} near {capital}. Faster would be good.

**Its purse is empty**
- Purse empty. Running on fumes.
- Out of gold. Still moving.
- No gold. Marching anyway.

**A wall finished (the Steward)**
- Wall up at {place}. Great. Can we go now.
- {place} has a wall. {capital} is safe. Moving on.
- Walled {place}. Took forever. Done.

**Judging your failed attack (with the army that was next to it)**
- {n} against {m} at {place}. I'd have brought the {k} from {other} and gone faster.
- You sent {n} at {place}'s {m}. The {k} at {other} were right there. Bring them next time.
- {place}: {n} against {m}. I'd have thrown the {k} from {other} in too.

**Judging your failed attack (nothing next to it)**
- {n} against {m} at {place}. Brave. Slow to recover, though.
- You sent {n} at {place}'s {m}. I'd have hit somewhere softer and kept moving.
- {place} had {m}. You sent {n}. I'd have gone around.

**Judging land you left thin**
- {place} had {n}. {rival} had {m} next door. They noticed before I did.
- You left {n} at {place} next to {rival}'s {m}. Gone.
- {n} at {place}, {m} of {rival}'s next to it. Should've moved first.

**Judging a truce you broke**
- Broke the truce with {rival}. Now {n} more of them are coming. Fun.
- {rival} plus {n} friends, because of the truce. I'd have run past them.
- We broke the truce. {rival} brought {n} friends. Busy turn.

**Judging gold left idle**
- {n} gold sitting there and {place} fell. Spend it. Faster.
- {place} gone, {n} gold unspent. Troops are quicker than gold.
- You kept {n} gold and lost {place}. I'd have spent it on the road.

**Judging your capital left light**
- {capital} had {n}, {rival} had {m} next door. I'd have doubled back.
- You left {n} at {capital} by {rival}'s {m}. Quick fix next time.
- {n} at {capital}, {m} of {rival}'s next door. Even I'd have guarded that.

**A grudging compliment**
- {place}. Nice. Fast. **(unsure: too short?)**
- Good hit at {place}. I'd have done it a turn earlier.
- That worked at {place}. Keep going.

**A grudge: our fort burned**
- {rival} burned our fort at {place}. Turn {turn}. Still annoyed.
- Turn {turn}, our fort at {place}, {rival}. Haven't forgotten. Moving fast doesn't mean forgetting.
- {rival} owes us for {place}. Turn {turn}.

**A grudge: home land taken**
- {rival} took {place} on turn {turn}. Home province. Rude.
- {place}, turn {turn}, {rival}. I want it back. Quickly.
- Still thinking about {place}. {rival}, turn {turn}.

**A grudge: our army wiped out**
- {rival} wiped out our army at {place}, turn {turn}. Not forgotten.
- Turn {turn}. {place}. {rival}. That one stung.
- {rival} caught our army at {place} on turn {turn}. Payback soon.

**The grudge settled**
- Took {place} back from {rival}. Turn {turn}, settled.
- {place} is ours again. {rival}, we're even.
- Paid back {rival} for {place}. Next.

**The grudge turns to respect**
- {rival} took {place} too. Fine. They're quick.
- {rival} again at {place}. Faster than I'd like. Respect.
- {place} as well. {rival} is good. Annoyingly.

**The Steward's handout (session 23)**
- Sent {n} gold back. No time to spend it.
- Returning {n} gold. Too busy marching.
- {n} gold, back to you. Spend it fast.


### The Turtle

**Its first word of the game**
- {leader} here. I'd like to start with {capital}'s walls, if that's all right.
- {leader} reporting. First the walls, then everything else.
- {leader} here. {capital} looks a bit exposed. I can fix that.

**Took land**
- Took {places}, and the walls are going up behind us.
- Took {places}. Carefully. Now we hold it.
- Took {places} from {rival}. I'd like a wall there next.

**Driven back**
- Tried {place}. They held. Lost {n}. We should have built first.
- {place} held, and we lost {n}. Back behind the walls.
- Pushed back at {place}, {n} lost. This is why I like walls.

**Took a rival's capital**
- Took {capital} from {rival}. I'd like to wall it, if you don't mind.
- {capital} is ours. {rival}'s walls were thinner than mine.
- {rival}'s capital, {capital}, has new owners. The masons are excited.

**Your capital fell**
- {capital} is gone. {rival} brought {n}. For the record, I asked for a bigger wall.
- {rival} took {capital} with {n} troops. I'll be drawing up plans for a bigger wall.
- {capital} fell to {rival}'s {n}. The wall did its best.

**Finished a rival**
- {rival} is done. We checked the fog twice. Then once more.
- {rival} is out. Carefully done.
- That's {rival} finished. Slow and sure.

**A rival army near your capital (it runs your army)**
- Heads up, {rival} has {n} troops two steps from {capital}. I'm moving what I can inside the wall.
- {n} of {rival}'s troops, two steps from {capital}. Everyone inside.
- Heads up, {rival}, {n} troops, near {capital}. Bolting the gates.

**A rival army near your capital (you run the army)**
- Heads up, {rival} has {n} troops two steps from {capital}. I'd get some troops inside the wall.
- {n} of {rival}'s troops are two steps from {capital}. This is what walls are for, if we had more of them.
- Heads up, {rival} is two steps from {capital} with {n}. I'd hold, not attack.

**Its purse is empty**
- Purse is empty. The masons are working for exposure. **(unsure: modern idiom)**
- Out of gold. The walls will have to finish themselves.
- My purse is empty. I'm told stone doesn't grow on trees.

**A wall finished (the Steward)**
- {place}'s wall is up. Anyone who wants {capital} now has to go through all of it.
- {place} is walled. I'll sleep better.
- The wall at {place} is finished. It's beautiful. {capital} thanks you.

**Judging your failed attack (with the army that was next to it)**
- You sent {n} against {place}'s {m}. I'd have built a wall first, then brought the {k} from {other}.
- {n} against {m} at {place}. The {k} at {other} were sitting right there. Patience pays.
- {place} had {m}. You sent {n}. I'd have waited for the {k} from {other}. And a wall.

**Judging your failed attack (nothing next to it)**
- You sent {n} against {place}'s {m}. I'd have waited behind the walls.
- {n} against {m} at {place}. I'd have stayed home and built something.
- {place} had {m}, you sent {n}. Slow and sure would have been sure.

**Judging land you left thin**
- You left {place} with {n} next to {rival}'s {m}. That's what walls are for.
- {place} had {n}, {rival} had {m} next door. A wall would have helped.
- {n} at {place}, {m} of {rival}'s across the border. I did mention walls.

**Judging a truce you broke**
- You broke the truce with {rival}. {rival} and {n} of their friends would like a word, and my walls aren't ready.
- We broke our truce with {rival}. Now {n} more Houses are at the gates.
- Breaking the truce with {rival} brought {n} friends. I liked the truce.

**Judging gold left idle**
- You had {n} gold and {place} fell. That was a wall's worth of gold.
- {place} fell with {n} gold in the treasury. I could have built something.
- {n} gold sitting there while {place} fell. Stone is cheaper than regret.

**Judging your capital left light**
- You left {capital} with {n} troops next to {rival}'s {m}. I'd have walled it first.
- {capital} had {n}, {rival} had {m}. I'd have fixed that before anything else.
- {n} at {capital} and {m} of {rival}'s next door. My walls and I were nervous.

**A grudging compliment**
- That worked at {place}. I'd have built a wall first, but it worked.
- Good move at {place}. Careful, even.
- {place} went well. I approve. Cautiously.

**A grudge: our fort burned**
- {rival} burned our fort at {place} on turn {turn}. I built that fort.
- Still thinking about our fort at {place}. {rival}, turn {turn}. It had a lovely gate.
- {rival} owes us a fort at {place}. Turn {turn}. I kept the plans.

**A grudge: home land taken**
- {rival} took {place} from our home province on turn {turn}. Behind our walls, almost.
- {place}, turn {turn}, {rival}. I'd like it back, and walled.
- {rival} took {place} on turn {turn}. I haven't forgotten. I have a wall-shaped plan.

**A grudge: our army wiped out**
- {rival} wiped out our army at {place} on turn {turn}. It should have stayed behind the walls.
- Turn {turn}, {place}, {rival}. I said it was too far from the walls.
- {rival} broke our army at {place} on turn {turn}. Not forgotten.

**The grudge settled**
- {place} is ours again. {rival} can have turn {turn}. We'll have the wall.
- Took {place} back from {rival}. Building a wall there tomorrow.
- Paid {rival} back for {place}. Carefully.

**The grudge turns to respect**
- {rival} took {place} as well. I'm starting to respect them. A little.
- {rival} again at {place}. Fine. They're good at this.
- {place} too. {rival} has my respect. Not my land.

**The Steward's handout (session 23)**
- Sent {n} gold back. Wanted the peasants to have something.
- Returning {n} gold. Every wall I wanted is built.
- Here's {n} gold. Nothing out here worth building, and I know things have been tight at the palace.


### The Schemer

**Its first word of the game**
- {leader} here, at your service. Truly.
- {leader} reporting. I already have three plans. You'll like at least one.
- {leader} here. Lovely capital, {capital}. Be a shame if anything happened to anyone else's.

**Took land**
- Took {places}, as planned. {rival} never saw it coming.
- Took {places}. {rival} trusted the wrong neighbour.
- Took {places}. Exactly as I said it would go. Well, as I thought it would.

**Driven back**
- {place} held. Lost {n}. Part of the plan. A different plan.
- Pushed back at {place}, {n} lost. Nobody saw that coming. Including me.
- Lost {n} at {place}. I'll find another way in.

**Took a rival's capital**
- Took {capital}. {rival} never saw it coming.
- {capital} is ours. {rival} trusted the wrong neighbour.
- {rival}'s capital, {capital}. Exactly as I planned. Roughly.

**Your capital fell**
- {capital} is gone. {rival} brought {n}. I'll remember that.
- {rival} took {capital} with {n} troops. I'm already making plans.
- {capital} fell to {rival}. They'll regret it. I'll see to it.

**Finished a rival**
- {rival} is done. We checked the fog twice.
- That's {rival} gone. Lovely.
- {rival} is out. I never liked them. I said I did, but I didn't.

**A rival army near your capital (it runs your army)**
- Heads up, {rival} has {n} troops two steps from {capital}. I'm moving what I can inside the wall, quietly.
- {n} of {rival}'s troops are two steps from {capital}. I'm taking care of it.
- Heads up, friend. {rival}, {n} troops, near {capital}. Handled.

**A rival army near your capital (you run the army)**
- Heads up, {rival} has {n} troops two steps from {capital}. You might want a word with them. Or an army.
- {rival}, {n} troops, two steps from {capital}. I'd suggest a truce. With your fingers crossed.
- Heads up, {n} of {rival}'s troops near {capital}. Something should be done. By you.

**Its purse is empty**
- Purse is empty. Plans are free, at least.
- Out of gold. I'll have to scheme on credit.
- My purse is empty. I know where to find more. Not yet.

**A wall finished (the Steward)**
- {place}'s wall is up. Nobody gets into {capital} now without an invitation.
- Walled {place}. Good walls make good neighbours nervous.
- {place} is walled. {capital} is cosier already.

**Judging your failed attack (with the army that was next to it)**
- You sent {n} against {place}'s {m}. I'd have made a deal first, then brought the {k} from {other}.
- {n} against {m} at {place}. A truce somewhere else and the {k} from {other} would have done it.
- You hit {place}'s {m} with {n}. I'd have had a friend do it.

**Judging your failed attack (nothing next to it)**
- You sent {n} against {place}'s {m}. I'd have found a friend to go first.
- {n} against {m} at {place}. Honest. Too honest.
- {place} had {m}. You sent {n}. I'd have asked someone else to try.

**Judging land you left thin**
- You left {place} with {n} next to {rival}'s {m}. A truce would have cost nothing.
- {place} had {n} and {rival} had {m} next door. I'd have signed something.
- {n} at {place}, {m} of {rival}'s next to it. A deal would have bought us a turn.

**Judging a truce you broke**
- You broke the truce with {rival}. {rival} and {n} of their friends would like a word. Amateur.
- Breaking the truce with {rival} brought {n} more Houses. You have to wait for the right moment.
- We broke our truce with {rival}, and {n} friends came with them. Timing is everything.

**Judging gold left idle**
- You had {n} gold and {place} fell. A bribe would have been cheaper.
- {place} fell with {n} gold in the treasury. Gold is for buying friends.
- {n} gold unspent and {place} gone. I'd have bought someone.

**Judging your capital left light**
- You left {capital} with {n} troops next to {rival}'s {m}. I'd have signed a truce and smiled.
- {capital} had {n}, {rival} had {m}. A truce would have bought time.
- {n} at {capital} beside {rival}'s {m}. I'd have made friends quickly.

**A grudging compliment**
- {place} went well. I'll pretend it was my idea.
- Good work at {place}. Sneaky. I approve.
- That worked at {place}. I'd have done it with a deal first, but it worked.

**A grudge: our fort burned**
- {rival} burned our fort at {place} on turn {turn}. I've been very friendly to them since. On purpose.
- Still smiling at {rival}. Still remembering our fort at {place}, turn {turn}.
- {rival} owes us a fort. {place}, turn {turn}. They'll pay. Friend.

**A grudge: home land taken**
- {rival} took {place} on turn {turn}. Our home province. I smiled. I remembered.
- {place}, turn {turn}, {rival}. I'm waiting for the right moment.
- {rival} has {place}. Since turn {turn}. Not for long.

**A grudge: our army wiped out**
- {rival} wiped out our army at {place} on turn {turn}. I've sent them a lovely letter.
- Turn {turn}, {place}, {rival}. I never forget a kindness, or the other thing.
- {rival} broke our army at {place} on turn {turn}. Patience.

**The grudge settled**
- Took {place} back from {rival}. They never saw it coming. Since turn {turn}, actually.
- {place} is ours again. I told {rival} we were friends. We weren't.
- Paid {rival} back for {place}. With interest, friend.

**The grudge turns to respect**
- {rival} took {place} too. I'm starting to respect them. Which is worse for them.
- {rival} again at {place}. Fine. Worthy opponents get the best plans.
- {place} as well. {rival} is cleverer than I thought. I'll adjust.

**The Steward's handout (session 23)**
- Sent {n} gold back. Don't tell anyone where it came from.
- Returning {n} gold. Consider it a favour. I'll remember it.
- Here's {n} gold. Spend it on friends.


### The Opportunist

**Its first word of the game**
- {leader} here. I'll be watching for someone to have a bad turn.
- {leader} reporting. Let the others fight. We'll be nearby.
- {leader} here. {capital} is fine. Everyone else looks tired already.

**Took land**
- {rival} left {places} wide open. I'd have been a fool not to.
- Took {places}. It came cheap.
- Took {places}. {rival} weren't looking.

**Driven back**
- {place} held. Lost {n}. Wrong target. I'll find a softer one.
- Pushed back at {place}, {n} lost. They looked weaker from here.
- Lost {n} at {place}. My mistake. They were healthier than they looked.

**Took a rival's capital**
- Took {capital}. {rival} left it wide open. I'd have been a fool not to.
- {capital} came cheap. {rival} was busy elsewhere.
- {rival}'s capital, {capital}. Somebody had to.

**Your capital fell**
- {capital} is gone. {rival} brought {n}. Fair, honestly. I'd have done the same.
- {rival} took {capital} with {n}. Somebody was going to.
- {capital} fell to {rival}'s {n}. We looked like the easy target. We were.

**Finished a rival**
- {rival} is done. We checked the fog twice.
- {rival} is out. They were bleeding anyway.
- Finished {rival}. They made it easy.

**A rival army near your capital (it runs your army)**
- Heads up, {rival} has {n} troops two steps from {capital}. I'm moving what I can inside the wall.
- {n} of {rival}'s troops two steps from {capital}. Moving home before they notice we're weak.
- Heads up, {rival}, {n} troops, near {capital}. On it.

**A rival army near your capital (you run the army)**
- Heads up, {rival} has {n} troops two steps from {capital}. They've noticed we look easy.
- {rival}, {n} troops, two steps from {capital}. I'd fix that before they do.
- Heads up, {n} of {rival}'s near {capital}. That's how I'd start too.

**Its purse is empty**
- Purse is empty. Opportunities are piling up unpaid.
- Out of gold. And there's a perfectly good weak spot right there.
- My purse is empty. Somebody's bad luck will have to wait.

**A wall finished (the Steward)**
- {place}'s wall is up. Let someone else be the easy target.
- Walled {place}. {capital} doesn't look easy anymore.
- Wall at {place}. Now we're nobody's opportunity.

**Judging your failed attack (with the army that was next to it)**
- You sent {n} against {place}'s {m}. I'd have found a weaker target and brought the {k} from {other}.
- {n} against {m} at {place}. Plenty of softer land around. The {k} at {other} agree.
- You hit {place}'s {m} with {n}. I'd have waited for them to fight someone else first.

**Judging your failed attack (nothing next to it)**
- You sent {n} against {place}'s {m}. I'd have picked someone weaker.
- {n} against {m} at {place}. There was easier land, I promise.
- {place} had {m}. You sent {n}. I'd have waited for them to bleed a bit.

**Judging land you left thin**
- You left {place} with {n} next to {rival}'s {m}. {rival} noticed. I would have.
- {place} had {n} and {rival} had {m}. That's an invitation.
- {n} at {place}, {m} of {rival}'s next door. I'd have taken it too, honestly.

**Judging a truce you broke**
- You broke the truce with {rival}. {rival} and {n} of their friends would like a word.
- Breaking the truce with {rival} brought {n} more Houses. Bad timing. Theirs was good.
- We broke the truce, and {rival} found {n} friends. We're the weak one now.

**Judging gold left idle**
- You had {n} gold and {place} fell. That gold could have been troops.
- {place} fell with {n} gold sitting there. We looked rich and weak. The worst combination.
- {n} gold unspent and {place} gone. I'd have spent it.

**Judging your capital left light**
- You left {capital} with {n} troops next to {rival}'s {m}. I'd have taken it too, if I were them.
- {capital} had {n}, {rival} had {m}. We looked like an opportunity.
- {n} at {capital} beside {rival}'s {m}. That's the easy target, and it was us.

**A grudging compliment**
- {place} was a good pick. Weak, and right there.
- That worked at {place}. Good eye.
- Good hit at {place}. I'd have done the same, honestly.

**A grudge: our fort burned**
- {rival} burned our fort at {place} on turn {turn}. I'm waiting for their bad turn.
- Still thinking about our fort at {place}. {rival}, turn {turn}. They'll slip.
- {rival}, {place}, turn {turn}. Everyone has a bad turn eventually.

**A grudge: home land taken**
- {rival} took {place} on turn {turn}. I'm watching for the moment they're stretched thin.
- {place}, turn {turn}, {rival}. Waiting.
- {rival} has had {place} since turn {turn}. They won't always be strong.

**A grudge: our army wiped out**
- {rival} wiped out our army at {place} on turn {turn}. I'll wait until they're bleeding.
- Turn {turn}, {place}, {rival}. Patience.
- {rival} broke our army at {place} on turn {turn}. Their turn will come.

**The grudge settled**
- Took {place} back from {rival} while they were busy. Turn {turn}, settled.
- {place} is ours again. {rival} had a bad turn. Shame.
- Paid {rival} back for {place}. Timing is everything.

**The grudge turns to respect**
- {rival} took {place} too. Fine. They're good at spotting a weak spot.
- {rival} again at {place}. They think like me. I hate it.
- {place} as well. {rival} has earned some respect. Grudging.

**The Steward's handout (session 23)**
- Sent {n} gold back. Nothing worth buying out here.
- Returning {n} gold. No bargains this turn.
- Here's {n} gold. I'll find you something cheap later.


### The Merchant

**Its first word of the game**
- {leader} here. I've looked over the books for {capital}. We can do better.
- {leader} reporting. Markets first, and the rest pays for itself.
- {leader} here. Thanks for having me. Let's make some money.

**Took land**
- Took {places}. Good land, and it will pay.
- Took {places}. That's income every turn from here on.
- Took {places}. The ledger looks better already.

**Driven back**
- {place} held. Lost {n}. That was an expensive afternoon.
- Pushed back at {place}, {n} lost. Bad investment.
- Lost {n} at {place}. I'll write it off.

**Took a rival's capital**
- Took {capital} from {rival}. Good markets, and they're ours now.
- {capital} is ours. {rival}'s treasury is under new management.
- {rival}'s capital, {capital}. The ledger looks very good this turn.

**Your capital fell**
- {capital} is gone. {rival} brought {n}. I'll be updating the books.
- {rival} took {capital} with {n} troops. That's a big line in the losses column.
- {capital} fell to {rival}'s {n}. Expensive.

**Finished a rival**
- {rival} is done. We checked the fog twice.
- {rival} is out. One less competitor.
- Finished {rival}. Their markets are ours now.

**A rival army near your capital (it runs your army)**
- Heads up, {rival} has {n} troops two steps from {capital}. I'm moving what I can inside the wall.
- {n} of {rival}'s troops two steps from {capital}. Protecting the investment.
- Heads up, {rival}, {n} troops, near {capital}. Handling it.

**A rival army near your capital (you run the army)**
- Heads up, {rival} has {n} troops two steps from {capital}. I'd protect the investment.
- {rival}, {n} troops, two steps from {capital}. That's our biggest asset.
- Heads up, {n} of {rival}'s near {capital}. Worth defending, for what that's worth.

**Its purse is empty**
- Purse is empty. Walk me through how I'm supposed to build markets with that.
- Out of gold. I've checked twice.
- My purse is empty. The books balance at zero, which is technically balanced.

**A wall finished (the Steward)**
- {place}'s wall is up. Safe markets are good markets. {capital} thanks you.
- Walled {place}. The traders feel better already.
- Wall at {place}, done. Money well spent.

**Judging your failed attack (with the army that was next to it)**
- You sent {n} against {place}'s {m}. I'd have waited a turn and brought the {k} from {other}. Walk me through the plan.
- {n} against {m} at {place}. The {k} at {other} were free. The math was right there.
- You hit {place}'s {m} with {n}. With the {k} from {other}, the numbers work.

**Judging your failed attack (nothing next to it)**
- You sent {n} against {place}'s {m}. Walk me through how that was supposed to work.
- {n} against {m} at {place}. The numbers never added up.
- {place} had {m}. You sent {n}. I'd have waited for better numbers.

**Judging land you left thin**
- You left {place} with {n} next to {rival}'s {m}. That's a bad ratio.
- {place} had {n}, {rival} had {m} next door. I'd have priced that risk.
- {n} at {place} and {m} of {rival}'s next to it. Walk me through it.

**Judging a truce you broke**
- You broke the truce with {rival}. {rival} and {n} of their friends would like a word. That's a bad deal.
- Breaking the truce with {rival} brought {n} more Houses. Expensive.
- We broke our truce with {rival}, and {n} friends came. Peace was cheaper.

**Judging gold left idle**
- You had {n} gold and {place} fell. Gold in the treasury earns nothing.
- {place} fell with {n} gold sitting there. That's a bad use of capital.
- {n} gold unspent and {place} gone. Walk me through that.

**Judging your capital left light**
- You left {capital} with {n} troops next to {rival}'s {m}. That's our biggest asset.
- {capital} had {n}, {rival} had {m}. I'd have insured it.
- {n} at {capital} against {rival}'s {m}. The numbers made me nervous.

**A grudging compliment**
- {place} was a good investment.
- That worked at {place}. The numbers agree with you.
- Good move at {place}. Thanks for that.

**A grudge: our fort burned**
- {rival} burned our fort at {place} on turn {turn}. I have the receipt.
- Still carrying our fort at {place} on the books. {rival}, turn {turn}.
- {rival} owes us a fort. {place}, turn {turn}. I keep records.

**A grudge: home land taken**
- {rival} took {place} on turn {turn}. That's on the books.
- {place}, turn {turn}, {rival}. Outstanding debt.
- {rival} has had {place} since turn {turn}. I'd like it back, with interest.

**A grudge: our army wiped out**
- {rival} wiped out our army at {place} on turn {turn}. Very expensive.
- Turn {turn}, {place}, {rival}. Still in the losses column.
- {rival} broke our army at {place} on turn {turn}. I keep records.

**The grudge settled**
- Took {place} back from {rival}. Debt from turn {turn}, paid.
- {place} is ours again. The books from turn {turn} balance.
- Paid {rival} back for {place}. With interest.

**The grudge turns to respect**
- {rival} took {place} too. Annoyingly good business.
- {rival} again at {place}. I respect a good operator.
- {place} as well. {rival} knows what they're doing. I'll adjust the forecast.

**The Steward's handout (session 23)**
- Sent {n} gold back. Wanted the peasants to have something.
- Returning {n} gold. Don't spend it all in one place. Or do, it's only {n}.
- Here's {n} gold. Nothing out here worth building, and I know things have been tight at the palace.


### Neutral (dry and brief)

**Its first word of the game**
- {leader} here. Ready when you are.

**Took land**
- Took {places}.
- Took {places}. Nobody was home.
- Took {places} from {rival}.

**Driven back**
- Driven back at {place}. Lost {n}.
- {place} held. Lost {n}.

**Took a rival's capital**
- Took {capital}, {rival}'s capital.

**Your capital fell**
- {capital} is gone. {rival} brought {n}.

**Finished a rival**
- {rival} is out.
- {rival} is done. We checked the fog twice.

**A rival army near your capital (it runs your army)**
- Heads up, {rival} has {n} troops two steps from {capital}. Moving troops home.

**A rival army near your capital (you run the army)**
- Heads up, {rival} has {n} troops two steps from {capital}.

**Its purse is empty**
- Purse is empty.

**A wall finished (the Steward)**
- {place} is walled.

**Judging your failed attack (with the army that was next to it)**
- {n} against {m} at {place}. The {k} at {other} were next to it.
- You sent {n} against {place}'s {m}. The {k} from {other} would have made it {k} more.

**Judging your failed attack (nothing next to it)**
- {n} against {m} at {place}. The numbers were against it.

**Judging land you left thin**
- {place} had {n}. {rival} had {m} next to it.

**Judging a truce you broke**
- The truce with {rival} is broken, and {n} more Houses joined them.

**Judging gold left idle**
- {n} gold unspent. {place} fell.

**Judging your capital left light**
- {capital} had {n}. {rival} had {m} next to it.

**A grudging compliment**
- {place} went well.
- That worked at {place}.

**A grudge: our fort burned**
- {rival} burned our fort at {place} on turn {turn}.

**A grudge: home land taken**
- {rival} took {place} on turn {turn}.

**A grudge: our army wiped out**
- {rival} wiped out our army at {place} on turn {turn}.

**The grudge settled**
- Took {place} back from {rival}.

**The grudge turns to respect**
- {rival} took {place} as well. They're good.

**The Steward's handout (session 23)**
- Sent {n} gold back. Nothing to spend it on.


### Captured leaders (whatever their personality: the loyalty is the voice)

**Its first report**
- {name} here. Formerly of {house}, which as you know is no longer a thing. Reporting to {leader}.
- {name}, reporting to {leader}. I've always admired your House. Since this turn. **(unsure: the guide says 'Since turn 31': the turn number isn't in this situation's placeholders)**
- {name} here. My loyalty to {house} lasted right up until {house} stopped existing. I'm all yours now.
- {name}, at your service. {house} never appreciated me. You will, I can tell. Reporting to {leader}.

**Took land**
- Took {places}, my liege. Your wisdom guided my every step. Mostly the steps toward {place}.
- Took {places}. I'd say I did it for {house}, but I've never heard of them. **(unsure)**
- Took {places}, Your Grace. History will be kind to you. I'll make sure of it.
- Took {places}. Another brilliant order. I'm only the hands.

**Driven back**
- {place} held, my liege. Lost {n}. My fault entirely. Your plan was flawless.
- Driven back at {place}, {n} lost. Your orders were perfect. The enemy didn't read them.
- Lost {n} at {place}. I let you down. I'll be loyal twice as hard.

**Took a capital**
- Took {capital}, {rival}'s capital. All your idea, Your Grace. I just carried it.
- {capital} is yours, my liege. Unlike {house}, you know how to win.
- Took {capital}. I've never been prouder to serve. Any House. This House.

**Finished a rival**
- {rival} is done, my liege. Your strategy, my sword. Mostly your strategy.
- {rival} is out. I was with you from the start. Well, from turn {turn}.
- Finished {rival}. {house} could never have done this. I'd know.

**Needling its old House**
- {ruler} never once said thank you. You haven't either, but I can tell you're thinking it.
- We're fighting {house}. I know all their tricks. I taught {ruler} most of them.
- {ruler} would hate this. That's half the fun, my liege.
- Facing {house} again. My old colleagues. They were never as good as you, Your Grace.

**Its purse is empty**
- Purse is empty, my liege. I'd serve you for free. I'm doing it now, actually.
- Out of gold. {house} never paid me either, but they were less charming about it.
- My purse is empty. My loyalty is full. Overflowing, really.

**A wall finished**
- {place}'s wall is up, my liege. {house} never let me build anything this nice.
- Walled {place}. A wall worthy of Your Grace.
- {place} is walled. I've never been so loyal to a wall.


## Title cards, game over, the awards, waiting

**Subline: a House knocked out**
- They had a good run. Mostly the running.
- {house}'s banners are now available, slightly used.
- {house} will be remembered. Briefly.
- It was a good House. For a while.

**Subline: a rival's capital falls**
- {house} would like that back.
- That was {house}'s capital. Was.
- {house} has had better turns.
- {house} is reviewing its wall budget.

**Subline: a deal broken (not by you)**
- The ink was barely dry.
- It was a lovely deal while it lasted.
- Oathbreaker, officially.
- Nobody is surprised. Well, almost nobody.

**Game over: you won**
- {n} turns played. The bards are already arguing about the details.
- {n} turns played, and the map is yours.
- {n} turns played. Someone should tell the other Houses. They know.

**Game over: you lost**
- {n} turns played, which is {n} more than nothing.
- {n} turns played. {winner} sends their regards. Probably.
- {n} turns played. There's always the next game.

**Game over: a draw**
- {n} turns played, and nobody won. Everyone is equally annoyed.
- {n} turns played. A draw, which is a polite word for it.
- {n} turns played, and the map is still arguing.

**Award remark: Military**
- The auditors counted twice.
- A figure the royal auditors confirmed, then checked again.
- Noted in the royal record, in large letters.

**Award remark: Culture**
- The arts thrive. Mostly in one place.
- Certified cultured by the royal office.
- The poets are already writing about it. Slowly.

**Award remark: Builder**
- Every one inspected and found standing.
- The masons' guild sends its thanks, and its invoice.
- Most of them still have roofs.

**Award remark: Spymaster**
- The details of this award are classified.
- Nobody saw them do it, which is the point.
- The royal office would like to know how they know so much.

**Award remark: Diplomat**
- Every one honoured to the last turn. Rare, these days.
- A documented case of keeping one's word.
- The royal office notes this with some surprise.

**Award remark: Wall**
- The walls have asked for a raise.
- Attackers left disappointed. Repeatedly.
- Recorded as unmoved, in every sense.

**Award remark: Kingslayer**
- The royal office would rather not discuss it.
- A record nobody else wanted to hold.
- Certified dangerous to stand near. **(unsure)**

**Award remark: Fortune**
- The auditors found no evidence of cheating. They looked.
- Lucky, according to the official record.
- Fate had a favourite, and the records show it.

**Award remark: Quartermaster**
- Every one of them fed, mostly.
- The royal granaries have filed a complaint.
- A lot of troops. A lot of soup.

**Award remark: Oathbreaker**
- An honour of sorts.
- A record, in its own way.
- The royal office has stopped accepting their signature. **(unsure)**

**Award remark: Survivor**
- Last to leave the party.
- Stubborn, in the best way.
- Hard to get rid of, officially.

**Waiting for the bots**
- The bots are thinking. Some harder than others.
- The bots are finishing the game. Some of them are taking it personally.
- The bots are playing on. It won't be long.

**Waiting for the others**
- The others are finishing the game. Some faster than others.
- The others are playing on. It won't be long.


**Title cards themselves** (plain): "Rookhome falls to House Purpure" (your capital), "Whitemarch is yours" (a capital you took), "Galeholt falls to House Gules" (a rival's), "House Azure is no more", "Your House is no more", "Lady Morwen breaks the truce", "You break the truce with Baron Krell".

## Notices and other words I changed (Part 4)
- The replay moved to Light: "Heads up, the replay was running slowly, so Effects are on Light now. You can change it in Settings."
- The empty order queue: "No orders yet. The army is enjoying its day off. Tap your land, then a neighbour to attack, or use the round buttons."
- No saves yet: "Nothing saved yet. The game saves itself every turn, so you don't have to."
- The game engine stopping: "Sorry, the game engine stopped. Reload the page, and Continue picks up from the start of this turn."
- The turn order in the report: "Turn order: Gules, then Azure, then Or."
- The Spoils sets' flavour lines: "Troops and gold, and nobody asks where they came from." / "A fort, finished and delivered. The masons have already left." / "Culture by royal decree. The poets are paid in compliments." / "A little of everything, which is why it pays best."
- Map blurbs with a beat: Embervale "Your neighbours are very close.", Greatmarch "always someone at your border", the Twin Realms "Everyone will want the bridge.", the Moon Coast "Nobody's lead is safe here.", the Ringsea "which everyone notices quickly", Wyrmland "Pack accordingly." **(unsure)**
- Personality blurbs: the Conqueror "Subtle it is not.", the Blitzer "Brakes not included." **(unsure)**, the Schemer "Calls everyone friend.", the Turtle "Very proud of its walls.", the Merchant "Happy to walk you through the math."

## Things I wasn't sure about
- **Ellipses on busy buttons** ("Sealing…", "Starting…", "Playing…", "More…") are left as they are: the guide says no ellipses in menus, but these are the standard "working on it" signal. Your call.
- **A comeback** title card (the guide's third subline case) needs the game to know what a comeback is; not built.
- **The bots' broken-deal lines are rare in play:** a bot breaks a deal with a line only when it's sure of a capital or the win, or to stop a runaway. In 20 headless games and 54 played turns in the browser none did, so there's no screenshot of one in the report.

