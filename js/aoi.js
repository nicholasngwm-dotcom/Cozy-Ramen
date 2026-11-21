'use strict';
/* Aoi's story: a slow-burn crush, told in ten hearts.
   Aoi ran this ramen stall for years, handed it to the player and opened Kitsune-ya across the street. She is a
   three-hundred-year-old kitsune: elegant, teasing, a little proud. The closer she gets to the player, the more she
   lets slip, and the warmer (and more flustered) her lines become.

   Her affinity is G.aff.aoi (ten ranks: AOI_AFFINITY in data.js). Points come from:
     serving her at your stall (+4 perfect, +2 close, +1 otherwise), and once a night at Kitsune-ya:
     visiting (+1), buying something (+2) and chatting with her (+2).
   Each heart opens one scene (1-10), told in her shop's talk panel, at most one a night. Between scenes, everything
   she says comes from the tier her hearts are in: 1-3 polite and teasing, 4-6 fond, 7-9 openly sweet and flustered,
   10 together. At hearts 3, 5, 7 and 9 she also leaves a note under her bowl the next time she eats at your stall.
   The player is always "chef": no names, no pronouns. */
const AOI = (() => {
  let H = { toast: () => {}, ding: () => {}, hearts: () => {}, save: () => {} };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const st = () => { const g = window.G; if (!g.aoi) g.aoi = { seen: 0, visit: 0, buy: 0, chat: 0, scene: 0, notes: 0 }; return g.aoi; };
  const pts = () => (window.G.aff && window.G.aff.aoi) || 0;
  const level = () => affLevel(pts(), 'aoi');          // 0-9
  const hearts = () => level() + 1;                   // 1-10
  const tier = () => { const h = hearts(); return h >= 10 ? 3 : h >= 7 ? 2 : h >= 4 ? 1 : 0; };
  const byTier = T => pick(T[tier()]);

  /* ---------- what she says, by tier ---------- */
  const GREET = [
    ['Irasshaimase! Welcome to Kitsune-ya.', 'Ah, the ramen chef. Take your time, the night is long.', 'Welcome back! The cooler is full tonight.', 'Evening, chef. Mind the step. And my tail.'],
    ['There you are. I was starting to think you had found another fox.', 'Evening, chef. I saved the good scallions. Not for you. ...Fine. For you.', 'Ah, my favourite customer. Do not tell the snail lady.', 'Welcome back. Your lantern went out late again. I noticed. From here.'],
    ['You came! I mean. Welcome. Ahem. Irasshaimase.', 'Oh. It is you. *her tail swishes before she can stop it* ...Good evening.', 'I kept the lantern lit a little longer tonight. No reason.', 'Chef! You smell like broth and long days. Come in, come in.'],
    ['There you are. The shop felt too quiet without you.', 'Welcome home. I mean, welcome to Kitsune-ya. ...Both, maybe.', 'I made tea for two. Sit with me a moment before you shop?', 'Hello, you. I was counting the minutes. Only a few hundred of them.']
  ];
  const MENU_LINE = [
    ['What can I get you?', 'Looking for anything in particular?', 'Mm? Ask away.'],
    ['What will it be tonight, chef?', 'Ask me anything. Within reason. I am a fox.', 'Mm? I am listening.'],
    ['Anything you need. Really, anything.', 'What can I do for you? *fidgets with her fan*', 'You have my full attention. The shelves can wait.'],
    ['Anything for you, chef.', 'What shall we do tonight? Shopping first, then tea.', 'Mm? You only have to ask.']
  ];
  const CHAT = [   // "Chat with Aoi" between scenes
    ['I have kept this shop for three hundred years. The prices have changed a little.', 'Blue tails are rare. So is a good ramen chef. We should stick together.',
      'I close at dawn. Foxes need their beauty sleep too.', 'My best customer is the snail lady. She buys one nori sheet. Every night. For years.'],
    ['I can see your stall from my counter. The steam looks lovely from here.', 'You fold your noren the way I used to. Neatly. I like that.',
      'A guest told me your miso is better than mine was. I told them to buy their eggs elsewhere. ...I am joking. Mostly.', 'Do you eat, chef? Properly? Not just tasting the broth?'],
    ['I caught myself humming your shop bell today. That is your fault.', 'You have flour on your cheek. Here. ...There. Gone. Do not look at me like that.',
      'Some nights I think about closing early. Then I remember you might come by.', 'My ears do this when I am happy. Ignore them. Please.'],
    ['Same time tomorrow night? And the night after that?', 'I told the snail lady about you. She approves. She says you are "a good egg." High praise.',
      'Three hundred years, and the best part of every one of them is this hour.', 'Stay a little? The shelves will not mind waiting. Neither will I.']
  ];
  const BYE = [
    ['Come again!', 'Mind the tail on your way out.', 'Good night, chef.'],
    ['Good night, chef. Do not stay up too late. Again.', 'Come back tomorrow. For the stock. Obviously.', 'Sleep well. Your broth needs you rested.'],
    ['Already? ...Good night, chef. Sweet dreams.', 'Come back tomorrow. Promise me. *holds out her little finger*', 'Good night. I will watch your lantern until it goes out.'],
    ['Good night, my chef. Dream of me. Or noodles. Me first.', 'Until tomorrow. It always feels very far away.', 'Go on, before I find another reason to keep you.']
  ];
  const LEAVE_CART = [
    ['I will keep your cart by the till until you come back.'],
    ['Your cart stays right here. I will guard it with my life. Or my fan.'],
    ['I will keep your cart warm. And the kettle. Hurry back.'],
    ['Your cart and I will both be waiting.']
  ];
  const CLOSING = [
    ['Three o\'clock, chef. Kitsune-ya is closing. Come back at four in the morning!'],
    ['Three already? Time runs strange when you are here. Closing up, chef!'],
    ['It is three. I should close. ...I should. Good night, chef!'],
    ['Three o\'clock. Go and sleep, love. I will see you tomorrow night.']
  ];
  const DONE = [
    ['Good night, chef. Cook something lovely.'],
    ['Good night, chef. Cook something lovely. Save me a bowl.'],
    ['Cook something lovely tomorrow. I will come and taste it.'],
    ['Cook something lovely. Then come back and tell me all about it.']
  ];
  const RECEIPT = ['ARIGATOU! COME AGAIN', 'THANK YOU! SEE YOU TOMORROW', 'COME BACK SOON. I MEAN IT', 'SEE YOU TONIGHT. AND ALWAYS'];

  // at your stall: tiered versions of her persona lines (personas.js holds the first tier)
  const STALL = {
    hi: [null,
      ['Evening, chef. I closed my shop for an hour. Do not read into it.', 'I sell you chashu, you sell me ramen. And I get to watch you cook. Fair trade.'],
      ['I told myself I was only hungry. *sits down very straight*', 'Hello, chef. I wore the blue ribbon today. ...You did not have to notice.'],
      ['Hello, love. One bowl, and one smile from the chef, please.', 'I missed you since last night. Is that silly? It feels silly.']],
    call: [null, ['Chef! A hungry fox, over here.'], ['Chef? When you have a moment... I like watching you come over.'], ['Chef! Your favourite customer is here.']],
    wait: [null, ['*fans herself, watching you work*'], ['*watches you cook, chin in her hands*'], ['*hums your shop bell, smiling*']],
    react: [null, ['Ah. You made this one carefully. I can tell.'], ['It looks wonderful. You look... busy. Also wonderful.'], ['Made by you. My favourite kind.']],
    yum: [null, ['Worth closing early for. I might even admit it.', 'Hm. You are getting better than me. I hate it. I love it.'],
      ['Perfect. Like you— like it. Like it. The bowl.', 'That was lovely. *her tail curls happily*'],
      ['Perfect, as always. Thank you, love.', 'You put something extra in that. I think it was you.']],
    idle: [null, ['Come by the shop after closing. I keep the lantern lit.', 'Your hands are so quick. I was never that quick.'],
      ['I kept your seat warm. This one. Next to the steam.', 'Do not mind me. I am just admiring the... noodles.'],
      ['I could sit here all day. I nearly have.', 'Tonight, after closing? I will make the tea.']]
  };
  // folded notes left under her empty bowl (once each, after the matching heart)
  const NOTES = { 3: 'A folded note under her bowl: "Your broth reminded me of a nice night, long ago. Thank you. - A"',
    5: 'A note under her bowl, with a pressed blue flower: "For your counter. It needed something pretty. (Besides the chef.) - A"',
    7: 'A note under her bowl: "I practised what to say for three days and then just ate noodles. Tonight, at the shop? - Aoi"',
    9: 'A note under her bowl, tied with a blue ribbon: "Some foxes wait three hundred years for the right lantern. Worth it. - Aoi"' };

  /* ---------- the ten scenes ----------
     A step is Aoi's line, or { a: line, r: [[your reply, her answer (or null)], ...] }. */
  const SCENES = [
    null,
    // 1: the handover, from her side
    ['You know, I watch your stall from my counter. Every night.',
      { a: 'Do not look so surprised. I ran it for years. A fox does not just walk away from her den.', r: [['Do you miss it?', 'Some days. The steam. The regulars. ...The noise. I miss the noise.'], ['Were you checking on me?', 'Checking on the stall. Only the stall. ...Mostly the stall.']] },
      'But it looks good with you in it. Warmer than it was with me. There. That was a compliment. Do not get used to it.'],
    // 2: the lantern
    ['Your lantern stays lit later than mine ever did.',
      { a: 'I see it from upstairs. When it goes out, I know you have finally gone to bed. Then I go to bed too.', r: [['You wait for me?', 'I— no. It is a coincidence. A very regular coincidence.'], ['I will try to sleep earlier.', 'Good. ...Not too early. I like seeing it.']] },
      'Forget I said that. Buy something. Quickly.'],
    // 3: why ramen
    ['May I ask you something, chef? Why ramen?',
      { a: 'Of everything in this world, you chose a hot stove and long nights. Why?', r: [['I like making people happy.', 'Hm. That is a very good answer. Annoyingly good.'], ['The broth smells like home.', 'Like home... yes. That is how it smelled to me, too, once.'], ['Honestly? I just love noodles.', '*laughs, then covers her mouth* Honest. I like honest.']] },
      'You are not like the other chefs I have known. I mean that kindly. ...Very kindly.'],
    // 4: the tail
    ['...Why are you looking at me like that?',
      { a: 'Oh. My tail. It is wagging, is it not.', r: [['It is very fluffy right now.', 'It does that on its own! It has no manners. *tries to hold it still*'], ['Is that a good sign?', 'It means nothing. Nothing at all. ...It means I am happy. Are you satisfied?']] },
      'Three hundred years of practice at looking elegant, and my own tail betrays me. Only around you, too. How rude of it.'],
    // 5: the first bowl
    ['Do you know why the Moonlight Bowl is on the old menu?',
      'A long time ago, I was a young fox with one tail and nowhere to go. It was raining. A cook at a little stall left a bowl out for me. Sweet fried tofu, on clear broth.',
      { a: 'It was the first warm thing anyone had ever given me. I have been chasing that feeling ever since.', r: [['Did you find it again?', 'For years, no. Then you started cooking across the street. ...Your broth tastes a little like that night.'], ['That is why you ran the stall.', 'Yes. To give someone else that bowl. And now you do. That makes me happier than I can say.']] },
      'There. I have never told anyone that. Not even the snail lady.'],
    // 6: the hidden stock
    ['Can you keep a secret, chef?',
      { a: 'Every evening, before I open, I set aside the best of the stock. The firmest eggs. The prettiest nori.', r: [['For your best customers?', 'For one customer. ...You. It is you, chef. Keep up.'], ['Aoi, is that favouritism?', 'It is outrageous favouritism. I regret nothing.']] },
      'Do not tell anyone. I have a reputation as a cold, mysterious shopkeeper. It took centuries.'],
    // 7: the invitation
    ['Chef, I, um. I rehearsed this.',
      '...And I have completely forgotten it. *hides behind her fan*',
      { a: 'The full moon is on the fifteenth. The roof of Kitsune-ya is the best seat on the whole street. Would you... watch it with me?', r: [['I would love to.', '*her ears shoot straight up* Really? Good. Yes. Wonderful. I will bring tea. And cushions. And— I will stop talking.'], ['Is this a date, Aoi?', 'It is a moon-viewing! A traditional, respectable moon-viewing! ...For two. So, yes. Maybe. Yes.']] },
      'I will see you on the roof, then. Do not be late. The moon will not wait, and neither... well. I would. But do not make me.'],
    // 8: after the moon
    ['I keep thinking about the roof. The moon. You, falling asleep on my shoulder halfway through.',
      { a: 'You snore a little. Very softly. Like a kettle.', r: [['I do not!', 'You do. It was the nicest sound I heard all year.'], ['Sorry about that.', 'Do not be. I did not move for an hour. My leg went numb. Worth it.']] },
      'You know, I should stop calling you "chef." ...No. I like how it sounds when I say it. It sounds like mine.'],
    // 9: the next tail
    ['A kitsune grows a new tail every hundred years. I am due for another soon.',
      { a: 'With each one, you may make a wish. When I was young I wished for power. Then for a shop. Then for quiet.', r: [['What will you wish for now?', 'Ordinary nights. Just like this. With you across the counter. That is all I want now.'], ['You do not need more tails.', '*laughs softly* No. I suppose I already have everything I was missing.']] },
      'Here. My bell charm. Foxes give them to the people they want to find again. Keep it near the stove, so I always know where you are.'],
    // 10: the confession
    ['Chef. Will you let me say something, all the way through, without teasing me?',
      'For three hundred years I closed this shop alone. Lowered the shutters, blew out the lantern, went upstairs. I never minded. Not once.',
      'Lately, I mind. Lately, the best part of my night is the moment your door opens across the street.',
      { a: 'I like you, chef. Not as a customer. Not as a neighbour. I like you. ...There. I said it. My ears are already red, so do not look.', r: [['I like you too, Aoi.', '*her tail wraps around you before she can stop it* ...Good. Very good. I was so nervous I sold a man six umbrellas today.'], ['I was hoping you would say that.', 'You were? You— all this time? *laughs, a little teary* We are both very foolish, then.']] },
      'Then... same time tomorrow night? And the night after that? And all the ones after that?',
      'I will keep the lantern lit. For you. Always.']
  ];

  /* ---------- progress ---------- */
  // Add points (key: once a night, 'visit' | 'buy' | 'chat'); on a new heart, a toast says so.
  function gain(n, key) {
    const s = st(), G = window.G;
    if (key) { if (s[key] === G.day) return false; s[key] = G.day; }
    const was = level();
    G.aff.aoi = pts() + n;
    const now = level();
    if (now > was) {
      H.ding(); H.hearts();
      const more = sceneNext() <= now + 1 && s.scene !== G.day ? (G.where === 'store' ? ' She seems to have something on her mind.' : ' She seems to have something on her mind. Visit Kitsune-ya after closing.') : '';
      H.toast('Aoi: ' + (now + 1) + ' of 10 hearts (' + AOI_AFFINITY[now].name.toLowerCase() + ').' + more);
      return true;
    }
    return false;
  }
  const sceneNext = () => st().seen + 1;
  // the scene ready tonight (1-10), or 0: one a night, and only once you have heard her greeting
  const sceneReady = () => { const s = st(), k = s.seen + 1; return window.G.aoiMet && k <= 10 && k <= hearts() && s.scene !== window.G.day ? k : 0; };
  function finishScene(k) { const s = st(); s.seen = Math.max(s.seen, k); s.scene = window.G.day; H.save(); }
  // her note under the bowl (each once, after hearts 3, 5, 7, 9)
  function note() {
    const s = st(), h = hearts(), k = [9, 7, 5, 3].find(n => h >= n && s.notes < n);
    if (!k) return null;
    s.notes = k; return NOTES[k];
  }

  return {
    init: hooks => { H = Object.assign(H, hooks); },
    level, hearts, tier, gain, sceneReady, finishScene, note,
    scene: k => SCENES[k] || null,
    greet: () => byTier(GREET), menuLine: () => byTier(MENU_LINE), chat: () => byTier(CHAT), bye: () => byTier(BYE),
    leaveCart: () => byTier(LEAVE_CART), closing: () => byTier(CLOSING), done: () => byTier(DONE), receipt: () => RECEIPT[tier()],
    // a tiered stall line for this key, or null (then her usual persona line is used)
    stall: key => { const T = STALL[key]; return T && T[tier()] ? pick(T[tier()]) : null; },
    // Aoi drops by the stall more often as she grows fond of the chef
    visitChance: () => 0.03 + 0.02 * level(),
    state: () => ({ ...st(), pts: pts(), hearts: hearts() })
  };
})();
